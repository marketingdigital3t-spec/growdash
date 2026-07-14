import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CheckStatus = "ok" | "warning" | "error";

export interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  action?: { label: string; kind: "reconnect-token" | "link-funnel" | "sync-funnel" | "sync-deals" | "review-utm"; funnelId?: string };
}

export interface FunnelComparison {
  funnelId: string;
  funnelName: string;
  rdWins: number;
  salesLinked: number;
  revenueRD: number;
  revenueSales: number;
  matchRate: number; // 0..1
}

export interface RDHealth {
  overall: CheckStatus;
  checkedAt: string;
  checks: HealthCheck[];
  comparison: FunnelComparison[];
  totals: {
    rdWins: number;
    salesLinked: number;
    revenueRD: number;
    revenueSales: number;
    matchRate: number;
  };
}

function worst(a: CheckStatus, b: CheckStatus): CheckStatus {
  const rank: Record<CheckStatus, number> = { ok: 0, warning: 1, error: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export function useRDHealthCheck() {
  return useQuery<RDHealth>({
    queryKey: ["rd_health_check"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const checks: HealthCheck[] = [];
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

      // 1) Token RD CRM
      const { data: integration } = await supabase
        .from("integrations")
        .select("id, is_active")
        .eq("provider", "rd_station_crm")
        .maybeSingle();

      const isConnected = !!integration?.is_active;
      if (!isConnected) {
        checks.push({
          id: "token",
          label: "Token RD Station CRM",
          status: "error",
          detail: "Token ausente ou integração desativada.",
          action: { label: "Reconectar", kind: "reconnect-token" },
        });
      } else {
        // ping
        try {
          const { data, error } = await supabase.functions.invoke("rd-test-connection", {
            body: { check: true },
          });
          if (error || data?.error) throw new Error(data?.error || error?.message);
          checks.push({ id: "token", label: "Token RD Station CRM", status: "ok", detail: "Conexão validada." });
        } catch (e: any) {
          checks.push({
            id: "token",
            label: "Token RD Station CRM",
            status: "error",
            detail: e.message || "Token rejeitado pelo RD.",
            action: { label: "Reconectar", kind: "reconnect-token" },
          });
        }
      }

      // 2) Funis vinculados
      const { data: funnels = [] } = await supabase
        .from("rd_funnels")
        .select("id, name, rd_funnel_id, is_active, ad_account_id");

      const activeLinked = (funnels ?? []).filter((f) => f.is_active && f.rd_funnel_id);
      if (activeLinked.length === 0) {
        checks.push({
          id: "funnels",
          label: "Funis vinculados",
          status: "error",
          detail: "Nenhum funil RD vinculado a contas Meta.",
          action: { label: "Vincular funil", kind: "link-funnel" },
        });
      } else {
        checks.push({
          id: "funnels",
          label: "Funis vinculados",
          status: "ok",
          detail: `${activeLinked.length} funil${activeLinked.length > 1 ? "is" : ""} ativo${activeLinked.length > 1 ? "s" : ""}.`,
        });
      }

      // 3) Estágios + 4) Deals recentes + 5) Webhook por funil
      const comparison: FunnelComparison[] = [];

      for (const f of activeLinked) {
        const [{ count: stageCount }, deals30, deals7Latest, rdWinsAgg, salesAgg] = await Promise.all([
          supabase.from("rd_funnel_stages").select("id", { count: "exact", head: true }).eq("rd_funnel_id", f.id),
          supabase.from("rd_deals").select("id", { count: "exact", head: true }).eq("rd_funnel_id", f.id).gte("created_at", since30),
          supabase.from("rd_deals").select("updated_at").eq("rd_funnel_id", f.id).order("updated_at", { ascending: false }).limit(1),
          supabase.from("rd_deals").select("amount_total").eq("rd_funnel_id", f.id).eq("win", true).gte("closed_at", since30),
          supabase.from("sales").select("gross_revenue, matched_campaign_id, rd_deal_id").eq("rd_funnel_id", f.id).gte("sale_date", since30.slice(0, 10)),
        ]);

        if (!stageCount || stageCount === 0) {
          checks.push({
            id: `stages-${f.id}`,
            label: `Estágios — ${f.name}`,
            status: "warning",
            detail: "Estágios reais ainda não sincronizados.",
            action: { label: "Sincronizar", kind: "sync-funnel", funnelId: f.id },
          });
        }

        const dealsCount = deals30.count ?? 0;
        if (dealsCount === 0) {
          checks.push({
            id: `deals-${f.id}`,
            label: `Deals (30d) — ${f.name}`,
            status: "warning",
            detail: "Sem deals nos últimos 30 dias.",
            action: { label: "Sincronizar", kind: "sync-deals", funnelId: f.id },
          });
        }

        const lastUpdated = deals7Latest.data?.[0]?.updated_at;
        if (lastUpdated && lastUpdated < since7) {
          checks.push({
            id: `webhook-${f.id}`,
            label: `Webhook — ${f.name}`,
            status: "warning",
            detail: `Último evento há mais de 7 dias (${new Date(lastUpdated).toLocaleDateString("pt-BR")}).`,
            action: { label: "Sincronizar", kind: "sync-deals", funnelId: f.id },
          });
        }

        // Confronto
        const rdWins = rdWinsAgg.data ?? [];
        const sales = salesAgg.data ?? [];
        const revenueRD = rdWins.reduce((s, r) => s + Number(r.amount_total || 0), 0);
        const linkedSales = sales.filter((s) => s.rd_deal_id);
        const revenueSales = linkedSales.reduce((s, r) => s + Number(r.gross_revenue || 0), 0);
        const matched = linkedSales.filter((s) => s.matched_campaign_id).length;
        const matchRate = linkedSales.length > 0 ? matched / linkedSales.length : 1;

        comparison.push({
          funnelId: f.id,
          funnelName: f.name,
          rdWins: rdWins.length,
          salesLinked: linkedSales.length,
          revenueRD,
          revenueSales,
          matchRate,
        });
      }

      // 6) Confronto agregado
      const totals = comparison.reduce(
        (acc, c) => ({
          rdWins: acc.rdWins + c.rdWins,
          salesLinked: acc.salesLinked + c.salesLinked,
          revenueRD: acc.revenueRD + c.revenueRD,
          revenueSales: acc.revenueSales + c.revenueSales,
          matchRate: 0,
        }),
        { rdWins: 0, salesLinked: 0, revenueRD: 0, revenueSales: 0, matchRate: 0 },
      );
      totals.matchRate = totals.salesLinked > 0
        ? comparison.reduce((s, c) => s + c.matchRate * c.salesLinked, 0) / totals.salesLinked
        : 1;

      if (totals.rdWins > 0) {
        const diffCount = Math.abs(totals.rdWins - totals.salesLinked) / Math.max(totals.rdWins, 1);
        const diffRev = Math.abs(totals.revenueRD - totals.revenueSales) / Math.max(totals.revenueRD, 1);
        const reconcile = Math.max(diffCount, diffRev);
        if (reconcile > 0.1) {
          checks.push({
            id: "reconcile",
            label: "Confronto RD ↔ Campanhas",
            status: "warning",
            detail: `Divergência de ${Math.round(reconcile * 100)}% entre vendas do RD e vendas atribuídas.`,
            action: { label: "Sincronizar tudo", kind: "sync-deals" },
          });
        } else {
          checks.push({
            id: "reconcile",
            label: "Confronto RD ↔ Campanhas",
            status: "ok",
            detail: `Números batem (${Math.round((1 - reconcile) * 100)}% de aderência).`,
          });
        }
      }

      // 7) Taxa de match com campanha
      if (totals.salesLinked > 0) {
        if (totals.matchRate < 0.8) {
          checks.push({
            id: "match-rate",
            label: "Match de vendas com campanhas",
            status: "warning",
            detail: `${Math.round(totals.matchRate * 100)}% das vendas estão linkadas a campanhas (meta: 80%).`,
            action: { label: "Revisar UTMs", kind: "review-utm" },
          });
        } else {
          checks.push({
            id: "match-rate",
            label: "Match de vendas com campanhas",
            status: "ok",
            detail: `${Math.round(totals.matchRate * 100)}% das vendas linkadas.`,
          });
        }
      }

      const overall = checks.reduce<CheckStatus>((acc, c) => worst(acc, c.status), "ok");

      return { overall, checkedAt: new Date().toISOString(), checks, comparison, totals };
    },
  });
}
