import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiagSeverity = "critical" | "warning" | "info";

export interface DiagSample {
  rd_deal_id: string;
  label: string; // human-friendly: contact, campaign, or stage
  extra?: string;
}

export interface DiagIssue {
  id: string;
  severity: DiagSeverity;
  title: string;
  description: string;
  affectedCount: number;
  samples: DiagSample[];
}

export interface RDUTMDiagnostics {
  checkedAt: string;
  totalDealsAnalyzed: number;
  issues: DiagIssue[];
}

// String similarity (normalized Levenshtein-ish via simple normalization)
function normalize(s: string) {
  return s.toLowerCase().replace(/[\s_\-.]+/g, "").trim();
}

export function useRDUTMDiagnostics(adAccountId?: string) {
  return useQuery<RDUTMDiagnostics>({
    queryKey: ["rd_utm_diagnostics", adAccountId ?? "all"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const issues: DiagIssue[] = [];
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

      // ---- 1) Load deals (últimos 30d) ----
      let dealsQuery = (supabase as any)
        .from("rd_deals")
        .select("rd_deal_id, ad_account_id, rd_funnel_id, utm_source, utm_medium, utm_campaign, created_at")
        .gte("created_at", since30);
      if (adAccountId) dealsQuery = dealsQuery.eq("ad_account_id", adAccountId);
      const { data: deals = [] } = await dealsQuery;

      const dealsList = deals || [];
      const total = dealsList.length;

      // ---- 2) Load Meta campaigns (filtered by ad_account) ----
      let campQuery = (supabase as any).from("campaigns").select("id, name, ad_account_id");
      if (adAccountId) campQuery = campQuery.eq("ad_account_id", adAccountId);
      const { data: campaigns = [] } = await campQuery;

      const campaignNames = new Set((campaigns || []).map((c) => c.name).filter(Boolean));
      const normalizedCampaignMap = new Map<string, string>(); // normalized -> original
      (campaigns || []).forEach((c) => {
        if (c.name) normalizedCampaignMap.set(normalize(c.name), c.name);
      });

      // ---- 3) Sample helper ----
      const sampleOf = (rows: typeof dealsList, label: (r: any) => string, extra?: (r: any) => string): DiagSample[] =>
        rows.slice(0, 5).map((r) => ({
          rd_deal_id: r.rd_deal_id,
          label: label(r),
          extra: extra ? extra(r) : undefined,
        }));

      // ---- Check 1: UTMs ausentes ----
      const missingUTM = dealsList.filter(
        (d) => !d.utm_source || !d.utm_medium || !d.utm_campaign,
      );
      if (total > 0) {
        const pct = missingUTM.length / total;
        if (missingUTM.length > 0) {
          issues.push({
            id: "missing-utm",
            severity: pct > 0.2 ? "critical" : "warning",
            title: "Deals sem UTM completo",
            description: `${missingUTM.length} de ${total} deals (${Math.round(pct * 100)}%) nos últimos 30 dias não têm utm_source, utm_medium ou utm_campaign preenchidos — impossível atribuir à campanha.`,
            affectedCount: missingUTM.length,
            samples: sampleOf(
              missingUTM,
              (r) => `Deal ${r.rd_deal_id.slice(0, 8)}`,
              (r) => `source=${r.utm_source ?? "—"} | medium=${r.utm_medium ?? "—"} | campaign=${r.utm_campaign ?? "—"}`,
            ),
          });
        }
      }

      // ---- Check 2: UTM não casa com nenhuma campanha do Meta ----
      const withCampaign = dealsList.filter((d) => d.utm_campaign);
      const unmatched: typeof dealsList = [];
      const unmatchedCounts = new Map<string, number>();
      withCampaign.forEach((d) => {
        if (!d.utm_campaign) return;
        if (!campaignNames.has(d.utm_campaign)) {
          unmatched.push(d);
          unmatchedCounts.set(d.utm_campaign, (unmatchedCounts.get(d.utm_campaign) || 0) + 1);
        }
      });
      if (unmatched.length > 0 && (campaigns?.length ?? 0) > 0) {
        const topValues = Array.from(unmatchedCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        issues.push({
          id: "utm-no-match",
          severity: "warning",
          title: "UTMs não batem com nenhuma campanha do Meta",
          description: `${unmatched.length} deals usam utm_campaign que não corresponde a nenhuma campanha cadastrada. Os valores mais frequentes estão abaixo.`,
          affectedCount: unmatched.length,
          samples: topValues.map(([val, count]) => ({
            rd_deal_id: "—",
            label: val,
            extra: `${count} deal${count > 1 ? "s" : ""}`,
          })),
        });
      }

      // ---- Check 3: Diferença de formatação (similar mas não igual) ----
      const formattingIssues = new Map<string, { rdValue: string; metaValue: string; count: number }>();
      withCampaign.forEach((d) => {
        if (!d.utm_campaign || campaignNames.has(d.utm_campaign)) return;
        const norm = normalize(d.utm_campaign);
        const match = normalizedCampaignMap.get(norm);
        if (match && match !== d.utm_campaign) {
          const key = `${d.utm_campaign}__${match}`;
          const existing = formattingIssues.get(key);
          if (existing) existing.count += 1;
          else formattingIssues.set(key, { rdValue: d.utm_campaign, metaValue: match, count: 1 });
        }
      });
      if (formattingIssues.size > 0) {
        const list = Array.from(formattingIssues.values()).sort((a, b) => b.count - a.count);
        const totalAffected = list.reduce((s, x) => s + x.count, 0);
        issues.push({
          id: "utm-formatting",
          severity: "warning",
          title: "Diferença de formatação entre RD e Meta",
          description: `${list.length} pares de UTMs parecem o mesmo nome com formatação diferente (hífen vs underscore, maiúsculas, etc). Padronizar resolveria ${totalAffected} deals.`,
          affectedCount: totalAffected,
          samples: list.slice(0, 5).map((x) => ({
            rd_deal_id: "—",
            label: `RD: "${x.rdValue}"`,
            extra: `Meta: "${x.metaValue}" • ${x.count} deal${x.count > 1 ? "s" : ""}`,
          })),
        });
      }

      // ---- Check 4: Etapas órfãs em event_classes ----
      let classQuery = (supabase as any)
        .from("event_classes")
        .select("id, title, rd_funnel_id, rd_model_patient_funnel_id, allowed_student_stage_ids, allowed_model_patient_stage_ids, ad_account_id, status");
      if (adAccountId) classQuery = classQuery.eq("ad_account_id", adAccountId);
      const { data: classes = [] } = await classQuery;

      const { data: allStages = [] } = await (supabase as any)
        .from("rd_funnel_stages")
        .select("rd_stage_id, rd_funnel_id");
      const stagesByFunnel = new Map<string, Set<string>>();
      (allStages || []).forEach((s) => {
        if (!stagesByFunnel.has(s.rd_funnel_id)) stagesByFunnel.set(s.rd_funnel_id, new Set());
        stagesByFunnel.get(s.rd_funnel_id)!.add(s.rd_stage_id);
      });

      const orphanSamples: DiagSample[] = [];
      let orphanCount = 0;
      (classes || []).forEach((c: any) => {
        if (c.status === "cancelled" || c.status === "finished") return;
        const studentStages = stagesByFunnel.get(c.rd_funnel_id) || new Set();
        const orphanStudent = (c.allowed_student_stage_ids || []).filter((s: string) => !studentStages.has(s));
        const mpFunnel = c.rd_model_patient_funnel_id;
        const mpStages = mpFunnel ? stagesByFunnel.get(mpFunnel) || new Set() : new Set();
        const orphanMP = (c.allowed_model_patient_stage_ids || []).filter((s: string) => !mpStages.has(s));
        const all = [...orphanStudent.map((s: string) => ({ type: "pessoas", id: s })), ...orphanMP.map((s: string) => ({ type: "paciente-modelo", id: s }))];
        if (all.length > 0) {
          orphanCount += all.length;
          if (orphanSamples.length < 5) {
            orphanSamples.push({
              rd_deal_id: c.id,
              label: c.title,
              extra: `${all.length} etapa(s) órfã(s): ${all.map((x) => `${x.type}:${x.id.slice(0, 6)}`).join(", ")}`,
            });
          }
        }
      });
      if (orphanCount > 0) {
        issues.push({
          id: "orphan-stages",
          severity: "warning",
          title: "Etapas configuradas não existem mais no RD",
          description: `Turmas referenciam etapas (rd_stage_id) que foram renomeadas ou removidas no RD. Sincronize os funis e revise as etapas permitidas.`,
          affectedCount: orphanCount,
          samples: orphanSamples,
        });
      }

      // ---- Check 5: Funis sem deals recentes (>7d) ----
      let funnelsQuery = (supabase as any).from("rd_funnels").select("id, name, is_active, ad_account_id");
      if (adAccountId) funnelsQuery = funnelsQuery.eq("ad_account_id", adAccountId);
      const { data: funnels = [] } = await funnelsQuery;
      const activeFunnels = (funnels || []).filter((f) => f.is_active);

      const staleFunnels: DiagSample[] = [];
      for (const f of activeFunnels) {
        const { data: latest } = await (supabase as any)
          .from("rd_deals")
          .select("created_at")
          .eq("rd_funnel_id", f.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const lastDealAt = latest?.[0]?.created_at;
        if (!lastDealAt || lastDealAt < since7d) {
          staleFunnels.push({
            rd_deal_id: f.id,
            label: f.name,
            extra: lastDealAt
              ? `Último deal: ${new Date(lastDealAt).toLocaleDateString("pt-BR")}`
              : "Nenhum deal sincronizado",
          });
        }
      }
      if (staleFunnels.length > 0) {
        issues.push({
          id: "stale-funnels",
          severity: "info",
          title: "Funis sem deals recentes",
          description: `${staleFunnels.length} funil(s) ativo(s) não recebem deals há mais de 7 dias — pode ser configuração errada ou funil descontinuado.`,
          affectedCount: staleFunnels.length,
          samples: staleFunnels.slice(0, 5),
        });
      }

      return {
        checkedAt: new Date().toISOString(),
        totalDealsAnalyzed: total,
        issues,
      };
    },
  });
}
