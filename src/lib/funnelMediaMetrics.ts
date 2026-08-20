import type { InsightRow } from "@/hooks/useInsights";

export interface FunnelMediaMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  /** Leads de formulário/site reportados nos insights da Meta. */
  formLeads: number;
  /** Conversas iniciadas por anúncios Meta no período selecionado. */
  conversations: number;
  /** Aquisições Meta: leads de formulário/site + conversas iniciadas. */
  metaLeads: number;
  rdLeads: number;
  sales: number;
  revenue: number;
  ctr: number;
  cpm: number;
  cpc: number;
  metaCpl: number | null;
  rdCpl: number | null;
  cac: number | null;
  roas: number | null;
  /** Vendas confirmadas ÷ aquisições Meta no mesmo período e escopo. */
  salesConversionRate: number | null;
  leadGap: number;
  rdCoverage: number | null;
}

export function computeFunnelMediaMetrics(
  insights: InsightRow[],
  conversations: number,
  rdLeads: number,
  sales: number,
  revenue: number,
): FunnelMediaMetrics {
  const totals = insights.reduce(
    (acc, row) => {
      acc.spend += Number(row.spend) || 0;
      acc.impressions += Number(row.impressions) || 0;
      acc.reach += Number(row.reach) || 0;
      acc.clicks += Number(row.clicks) || 0;
      acc.metaLeads += Number(row.leads) || 0;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, metaLeads: 0 },
  );
  const safeConversations = Math.max(0, Number(conversations) || 0);
  const formLeads = totals.metaLeads;
  const metaLeads = formLeads + safeConversations;

  return {
    ...totals,
    formLeads,
    conversations: safeConversations,
    metaLeads,
    rdLeads,
    sales,
    revenue,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    metaCpl: metaLeads > 0 ? totals.spend / metaLeads : null,
    rdCpl: rdLeads > 0 ? totals.spend / rdLeads : null,
    cac: sales > 0 ? totals.spend / sales : null,
    roas: totals.spend > 0 ? revenue / totals.spend : null,
    salesConversionRate: metaLeads > 0 ? (sales / metaLeads) * 100 : null,
    leadGap: rdLeads - metaLeads,
    rdCoverage: metaLeads > 0 ? (rdLeads / metaLeads) * 100 : null,
  };
}
