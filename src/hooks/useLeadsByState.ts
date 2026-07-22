import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDateString } from "@/lib/dateRange";


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

// Normalize an RD lead_state string (could be "SP", "São Paulo", "sp", etc.) to UF
function normalizeStateToUF(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Already UF code (2 letters)
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  // Try full name lookup (case-insensitive)
  const direct = NAME_TO_UF[s] || NAME_TO_UF[s.replace(/\b\w/g, (c) => c.toUpperCase())];
  if (direct) return direct;
  // Fallback: case-insensitive search
  const lower = s.toLowerCase();
  for (const [name, uf] of Object.entries(NAME_TO_UF)) {
    if (name.toLowerCase() === lower) return uf;
  }
  return null;
}

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

const fmt = toLocalDateString;

export function useLeadsByState({ adAccountId, campaignIds, startDate, endDate }: Params) {
  return useQuery({
    queryKey: ["leads-by-state-v3", adAccountId ?? "all", (campaignIds || []).join(","), fmt(startDate), fmt(endDate)],
    queryFn: async (): Promise<{ rows: StateRow[]; hasRegionData: boolean; source: "meta_leads" | "rd" | "meta" | "mixed"; coverage: { withState: number; total: number; pct: number } }> => {
      const start = fmt(startDate);
      const end = fmt(endDate);
      const startISO = new Date(`${start}T00:00:00`).toISOString();
      const endISO = new Date(`${end}T23:59:59.999`).toISOString();
      const PAGE = 1000;

      // ------------- 1. Resolve scoped campaigns (used for Meta totals/breakdown & spend) -------------
      let campQ = (supabase as any).from("campaigns").select("id, ad_account_id");
      if (adAccountId) campQ = campQ.eq("ad_account_id", adAccountId);
      const { data: camps, error: e1 } = await campQ;
      if (e1) throw e1;
      let scopedCampaignIds = (camps || []).map((c: any) => c.id as string);
      if (campaignIds && campaignIds.length > 0) {
        const set = new Set(campaignIds);
        scopedCampaignIds = scopedCampaignIds.filter((id) => set.has(id));
      }

      // ------------- 2. Meta region breakdown (spend + leads-by-UF) -------------
      const metaByUF: Record<string, { leads: number; spend: number }> = {};
      let totalRegionRows = 0;
      const CHUNK = 200;
      for (let i = 0; i < scopedCampaignIds.length; i += CHUNK) {
        const chunk = scopedCampaignIds.slice(i, i + CHUNK);
        if (chunk.length === 0) break;
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
            const cur = metaByUF[uf] || { leads: 0, spend: 0 };
            cur.leads += Number(r.leads || 0);
            cur.spend += Number(r.spend || 0);
            metaByUF[uf] = cur;
          }
          if (rows.length < PAGE) break;
        }
      }

      // ------------- 3. Total Meta leads — usa insight_actions (mesma fonte do KPI "Leads") --------
      // Soma: onsite_conversion.lead_grouped (Formulário Nativo) + action_type LP por conta
      // (account_lp_config) + mensagens. Bate com o número exibido no dashboard principal.
      let totalMetaLeads = 0;
      if (scopedCampaignIds.length > 0) {
        // 3a. quais accounts estão no escopo
        const accountIds = new Set<string>();
        if (adAccountId) accountIds.add(adAccountId);
        else for (const c of (camps || []) as any[]) if (c.ad_account_id) accountIds.add(c.ad_account_id);

        // 3b. action_type da LP por account
        const lpActions = new Set<string>();
        if (accountIds.size > 0) {
          const { data: lpCfg } = await supabase
            .from("account_lp_config")
            .select("ad_account_id, action_type")
            .in("ad_account_id", Array.from(accountIds));
          for (const r of (lpCfg || []) as any[]) if (r.action_type) lpActions.add(r.action_type);
        }

        const allowedActions = Array.from(new Set<string>([
          "onsite_conversion.lead_grouped",
          "onsite_conversion.messaging_conversation_started_7d",
          ...lpActions,
        ]));

        // 3c. paginar insight_actions com join via ads->adsets->campaigns
        for (let from = 0; ; from += PAGE) {
          let q = supabase
            .from("insight_actions" as any)
            .select("value, action_type, ads!inner(adsets!inner(campaigns!inner(id, ad_account_id)))")
            .in("action_type", allowedActions)
            .gte("date", start)
            .lte("date", end);
          if (adAccountId) q = q.eq("ads.adsets.campaigns.ad_account_id", adAccountId);
          const { data, error } = await q.range(from, from + PAGE - 1);
          if (error) break;
          const rows = (data || []) as any[];
          for (const r of rows) totalMetaLeads += Number(r.value || 0);
          if (rows.length < PAGE) break;
        }
      }
      const leadsWithRegion = Object.values(metaByUF).reduce((s, m) => s + m.leads, 0);

      // ------------- 3.1. Canonical leads enriched by sync-meta-leads (form -> DDD -> RD) --------
      const canonicalByUF: Record<string, number> = {};
      let canonicalTotal = 0;
      let canonicalWithState = 0;
      let metaLeadsQ = supabase
        .from("meta_leads" as any)
        .select("lead_state, ad_account_id")
        .gte("created_time", startISO)
        .lte("created_time", endISO);
      if (adAccountId) metaLeadsQ = metaLeadsQ.eq("ad_account_id", adAccountId);
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await metaLeadsQ.range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as any[];
        canonicalTotal += rows.length;
        for (const r of rows) {
          const uf = normalizeStateToUF(r.lead_state);
          if (!uf) continue;
          canonicalByUF[uf] = (canonicalByUF[uf] || 0) + 1;
          canonicalWithState++;
        }
        if (rows.length < PAGE) break;
      }

      // ------------- 4. Sales by state — vendas manuais + deals ganhos do RD (sem duplicidade) ----
      const salesByUF: Record<string, { sales: number; revenue: number }> = {};
      const seenRdDealIds = new Set<string>();

      // 4a. vendas da tabela `sales` (inclui as criadas via sync do RD)
      let salesQ = supabase
        .from("sales")
        .select("lead_state, net_revenue, ad_account_id, rd_deal_id, status")
        .gte("sale_date", start)
        .lte("sale_date", end);
      if (adAccountId) salesQ = salesQ.eq("ad_account_id", adAccountId);
      const { data: salesRows, error: e2 } = await salesQ;
      if (e2) throw e2;
      for (const s of (salesRows || []) as any[]) {
        if (s.status && s.status !== "confirmed" && s.status !== "pending") continue;
        if (s.rd_deal_id) seenRdDealIds.add(String(s.rd_deal_id));
        const uf = normalizeStateToUF(s.lead_state);
        if (!uf) continue;
        const cur = salesByUF[uf] || { sales: 0, revenue: 0 };
        cur.sales += 1;
        cur.revenue += Number(s.net_revenue || 0);
        salesByUF[uf] = cur;
      }

      // 4b. deals ganhos no RD que ainda NÃO existam em `sales` — evita dupla contagem
      {
        let rdWonQ = supabase
          .from("rd_deals")
          .select("rd_deal_id, lead_state, amount_total, ad_account_id")
          .eq("win", true)
          .gte("closed_at", startISO)
          .lte("closed_at", endISO);
        if (adAccountId) rdWonQ = rdWonQ.eq("ad_account_id", adAccountId);
        const { data: wonRows } = await rdWonQ;
        for (const d of (wonRows || []) as any[]) {
          const rdId = d.rd_deal_id ? String(d.rd_deal_id) : null;
          if (rdId && seenRdDealIds.has(rdId)) continue;
          if (rdId) seenRdDealIds.add(rdId);
          const uf = normalizeStateToUF(d.lead_state);
          if (!uf) continue;
          const cur = salesByUF[uf] || { sales: 0, revenue: 0 };
          cur.sales += 1;
          cur.revenue += Number(d.amount_total || 0);
          salesByUF[uf] = cur;
        }
      }

      // ------------- 5. Real leads by state: RD first, then Meta breakdown fallback --------
      let rdTotal = 0;
      let rdWithState = 0;
      const leadsByUF: Record<string, number> = {};
      let rdQ = supabase
        .from("rd_deals")
        .select("lead_state, ad_account_id")
        .gte("lead_created_at", startISO)
        .lte("lead_created_at", endISO);
      if (adAccountId) rdQ = rdQ.eq("ad_account_id", adAccountId);
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await rdQ.range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as any[];
        rdTotal += rows.length;
        for (const r of rows) {
          const uf = normalizeStateToUF(r.lead_state);
          if (!uf) continue;
          leadsByUF[uf] = (leadsByUF[uf] || 0) + 1;
          rdWithState++;
        }
        if (rows.length < PAGE) break;
      }

      // ------------- 6. Build rows -------------
      const allUFs = new Set<string>([
        ...Object.keys(canonicalByUF),
        ...Object.keys(leadsByUF),
        ...Object.keys(metaByUF),
        ...Object.keys(salesByUF),
      ]);

      const rows: StateRow[] = Array.from(allUFs).map((uf) => {
        const canonicalLeads = canonicalByUF[uf] || 0;
        const rdLeads = leadsByUF[uf] || 0;
        const meta = metaByUF[uf] || { leads: 0, spend: 0 };
        const s = salesByUF[uf] || { sales: 0, revenue: 0 };
        const leads = canonicalTotal > 0 ? canonicalLeads : rdTotal > 0 ? rdLeads : meta.leads;
        const spend = meta.spend;
        return {
          uf,
          leads,
          spend,
          cpl: leads > 0 ? spend / leads : 0,
          sales: s.sales,
          revenue: s.revenue,
          cpa: s.sales > 0 ? spend / s.sales : 0,
          conv_rate: leads > 0 ? (s.sales / leads) * 100 : 0,
          ticket_medio: s.sales > 0 ? s.revenue / s.sales : 0,
        };
      });

      const usingMeta = totalMetaLeads > 0 || totalRegionRows > 0;
      const source: "meta_leads" | "rd" | "meta" | "mixed" =
        canonicalTotal > 0 ? "meta_leads" : rdTotal > 0 ? "rd" : usingMeta ? "meta" : "meta";

      const coverage = canonicalTotal > 0
        ? { withState: canonicalWithState, total: canonicalTotal, pct: canonicalTotal > 0 ? (canonicalWithState / canonicalTotal) * 100 : 0 }
        : rdTotal > 0
        ? { withState: rdWithState, total: rdTotal, pct: rdTotal > 0 ? (rdWithState / rdTotal) * 100 : 0 }
        : usingMeta
        ? { withState: leadsWithRegion, total: totalMetaLeads || leadsWithRegion, pct: (totalMetaLeads || leadsWithRegion) > 0 ? (leadsWithRegion / (totalMetaLeads || leadsWithRegion)) * 100 : 0 }
        : { withState: 0, total: 0, pct: 0 };

      return { rows, hasRegionData: totalRegionRows > 0 || rdWithState > 0, source, coverage };
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
