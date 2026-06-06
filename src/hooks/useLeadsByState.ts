import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Map Meta region name (Brazilian state full name) -> UF code
const NAME_TO_UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amapa": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Ceara": "CE", "Distrito Federal": "DF",
  "Espírito Santo": "ES", "Espirito Santo": "ES", "Goiás": "GO", "Goias": "GO",
  "Maranhão": "MA", "Maranhao": "MA", "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA", "Para": "PA",
  "Paraíba": "PB", "Paraiba": "PB", "Paraná": "PR", "Parana": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Piaui": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Rondonia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sao Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO",
};

export interface StateRow {
  uf: string;
  leads: number;
  spend: number;
  cpl: number;
  sales: number;
  revenue: number;
  cpa: number;
  conv_rate: number;
  ticket_medio: number;
}

interface Params {
  adAccountId?: string;
  campaignIds?: string[];
  startDate: Date;
  endDate: Date;
}

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

export function useLeadsByState({ adAccountId, campaignIds, startDate, endDate }: Params) {
  return useQuery({
    queryKey: ["leads-by-state", adAccountId ?? "all", (campaignIds || []).join(","), fmt(startDate), fmt(endDate)],
    staleTime: 10_000,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous ?? { rows: [], hasRegionData: false },
    queryFn: async (): Promise<{ rows: StateRow[]; hasRegionData: boolean }> => {
      // 1. Resolve campaign ids in scope (RLS already filters per user)
      let campQ = supabase.from("campaigns").select("id, ad_account_id");
      if (adAccountId) campQ = campQ.eq("ad_account_id", adAccountId);
      const { data: camps, error: e1 } = await campQ;
      if (e1) throw e1;
      let scopedCampaignIds = (camps || []).map((c: any) => c.id as string);
      if (campaignIds && campaignIds.length > 0) {
        const set = new Set(campaignIds);
        scopedCampaignIds = scopedCampaignIds.filter((id) => set.has(id));
      }

      const start = fmt(startDate);
      const end = fmt(endDate);

      // 2. Region breakdowns
      const byUF: Record<string, { leads: number; spend: number }> = {};
      let totalRegionRows = 0;
      const CHUNK = 200;
      for (let i = 0; i < scopedCampaignIds.length; i += CHUNK) {
        const chunk = scopedCampaignIds.slice(i, i + CHUNK);
        if (chunk.length === 0) break;
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("insights_breakdowns" as any)
            .select("segment_key, leads, spend")
            .eq("breakdown_type", "region")
            .in("campaign_id", chunk)
            .gte("date", start)
            .lte("date", end)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data || []) as any[];
          totalRegionRows += rows.length;
          for (const r of rows) {
            const uf = NAME_TO_UF[String(r.segment_key)] || null;
            if (!uf) continue;
            const cur = byUF[uf] || { leads: 0, spend: 0 };
            cur.leads += Number(r.leads || 0);
            cur.spend += Number(r.spend || 0);
            byUF[uf] = cur;
          }
          if (rows.length < PAGE) break;
        }
      }

      // 3. Sales by state (RLS scopes to user)
      const salesByUF: Record<string, { sales: number; revenue: number }> = {};
      let salesQ = supabase
        .from("sales")
        .select("lead_state, net_revenue, ad_account_id")
        .gte("sale_date", start)
        .lte("sale_date", end);
      if (adAccountId) salesQ = salesQ.eq("ad_account_id", adAccountId);
      const { data: salesRows, error: e2 } = await salesQ;
      if (e2) throw e2;
      for (const s of (salesRows || []) as any[]) {
        if (!s.lead_state) continue;
        const uf = String(s.lead_state).toUpperCase();
        const cur = salesByUF[uf] || { sales: 0, revenue: 0 };
        cur.sales += 1;
        cur.revenue += Number(s.net_revenue || 0);
        salesByUF[uf] = cur;
      }

      // 4. Merge
      const allUFs = new Set([...Object.keys(byUF), ...Object.keys(salesByUF)]);
      const rows: StateRow[] = Array.from(allUFs).map((uf) => {
        const l = byUF[uf] || { leads: 0, spend: 0 };
        const s = salesByUF[uf] || { sales: 0, revenue: 0 };
        return {
          uf,
          leads: l.leads,
          spend: l.spend,
          cpl: l.leads > 0 ? l.spend / l.leads : 0,
          sales: s.sales,
          revenue: s.revenue,
          cpa: s.sales > 0 ? l.spend / s.sales : 0,
          conv_rate: l.leads > 0 ? (s.sales / l.leads) * 100 : 0,
          ticket_medio: s.sales > 0 ? s.revenue / s.sales : 0,
        };
      });

      return { rows, hasRegionData: totalRegionRows > 0 };
    },
  });
}

export const UF_TO_NAME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};
