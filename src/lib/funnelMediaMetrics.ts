import type { InsightRow } from "@/hooks/useInsights";

export interface FunnelMediaMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
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
  leadGap: number;
  rdCoverage: number | null;
}

export function computeFunnelMediaMetrics(
  insights: InsightRow[],
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

  return {
    ...totals,
    rdLeads,
    sales,
    revenue,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    metaCpl: totals.metaLeads > 0 ? totals.spend / totals.metaLeads : null,
    rdCpl: rdLeads > 0 ? totals.spend / rdLeads : null,
    cac: sales > 0 ? totals.spend / sales : null,
    roas: totals.spend > 0 ? revenue / totals.spend : null,
    leadGap: rdLeads - totals.metaLeads,
    rdCoverage: totals.metaLeads > 0 ? (rdLeads / totals.metaLeads) * 100 : null,
  };
}
