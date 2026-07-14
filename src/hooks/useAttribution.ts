import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";

export type AttributionModel = "first" | "last" | "linear";

export interface AttributionRow {
  campaign_id: string | null;
  campaign_label: string;
  sales_credit: number;
  revenue_credit: number;
}

interface TouchJoin {
  rd_deal_id: string;
  utm_campaign: string | null;
  matched_campaign_id: string | null;
  touch_order: number;
  touch_at: string;
}

/**
 * Carrega toques dos deals "ganhos" no período e calcula crédito por campanha
 * usando 3 modelos: first-touch, last-touch e linear.
 */
export function useAttribution(model: AttributionModel = "last") {
  const { startDate, endDate, adAccountId } = useDashboard();

  return useQuery({
    queryKey: ["attribution", startDate, endDate, adAccountId, model],
    queryFn: async () => {
      // 1) Buscar deals ganhos no período (e na conta, se filtrado)
      let dealsQ = supabase
        .from("rd_deals")
        .select("rd_deal_id, ad_account_id, amount_total, closed_at, win")
        .eq("win", true)
        .gte("closed_at", startDate.toISOString())
        .lte("closed_at", endDate.toISOString());
      if (adAccountId) dealsQ = dealsQ.eq("ad_account_id", adAccountId);

      const { data: deals, error: dealsErr } = await dealsQ.limit(5000);
      if (dealsErr) throw dealsErr;
      if (!deals || deals.length === 0) return [] as AttributionRow[];

      const dealIds = deals.map((d) => d.rd_deal_id);
      const dealValue = new Map<string, number>();
      deals.forEach((d) => dealValue.set(d.rd_deal_id, Number(d.amount_total) || 0));

      // 2) Buscar toques desses deals
      const { data: touches, error: tErr } = await supabase
        .from("rd_deal_touches")
        .select("rd_deal_id, utm_campaign, matched_campaign_id, touch_order, touch_at")
        .in("rd_deal_id", dealIds)
        .order("touch_order", { ascending: true });
      if (tErr) throw tErr;

      // 3) Agrupar toques por deal
      const byDeal = new Map<string, TouchJoin[]>();
      (touches ?? []).forEach((t) => {
        if (!byDeal.has(t.rd_deal_id)) byDeal.set(t.rd_deal_id, []);
        byDeal.get(t.rd_deal_id)!.push(t as TouchJoin);
      });

      // 4) Calcular crédito por campanha
      const credit = new Map<string, AttributionRow>();
      const keyOf = (t: TouchJoin) =>
        t.matched_campaign_id ?? `utm:${(t.utm_campaign ?? "(sem utm)").toLowerCase()}`;
      const labelOf = (t: TouchJoin) =>
        t.utm_campaign ?? (t.matched_campaign_id ? "(campanha)" : "(sem utm)");

      for (const [dealId, ts] of byDeal.entries()) {
        if (ts.length === 0) continue;
        const value = dealValue.get(dealId) ?? 0;

        let selected: TouchJoin[];
        let weight: number;
        if (model === "first") { selected = [ts[0]]; weight = 1; }
        else if (model === "last") { selected = [ts[ts.length - 1]]; weight = 1; }
        else {
          // linear: uma fração por campanha única no caminho
          const uniqueMap = new Map<string, TouchJoin>();
          ts.forEach((t) => uniqueMap.set(keyOf(t), t));
          selected = Array.from(uniqueMap.values());
          weight = 1 / selected.length;
        }

        for (const t of selected) {
          const k = keyOf(t);
          if (!credit.has(k)) {
            credit.set(k, {
              campaign_id: t.matched_campaign_id,
              campaign_label: labelOf(t),
              sales_credit: 0,
              revenue_credit: 0,
            });
          }
          const row = credit.get(k)!;
          row.sales_credit += weight;
          row.revenue_credit += value * weight;
        }
      }

      // 5) Resolver nome de campanha quando temos id
      const ids = Array.from(credit.values()).map((r) => r.campaign_id).filter(Boolean) as string[];
      if (ids.length > 0) {
        const { data: camps } = await supabase.from("campaigns").select("id, name").in("id", ids);
        const nameById = new Map((camps ?? []).map((c) => [c.id, c.name]));
        credit.forEach((row) => {
          if (row.campaign_id && nameById.has(row.campaign_id)) {
            row.campaign_label = nameById.get(row.campaign_id)!;
          }
        });
      }

      return Array.from(credit.values()).sort((a, b) => b.sales_credit - a.sales_credit);
    },
  });
}
