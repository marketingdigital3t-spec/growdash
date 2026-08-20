import type { Sale } from "@/hooks/useSales";
import { normalizePaymentMethod } from "@/hooks/useSales";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { InsightRow } from "@/hooks/useInsights";

export type ExpertAttribution = {
  campaign: string;
  creative: string;
  sales: number;
  revenue: number;
  payments: string[];
};

export type ExpertLeadActions = {
  nativeFormLeads?: number;
  conversations?: number;
};

/**
 * Keeps acquisition sources explicit. A native Meta lead and a messaging
 * conversation are distinct events, so neither may replace the other (or the
 * RD total) when the expert is viewing more than one authorised account.
 */
export function getExpertDashboardMetrics(
  insights: InsightRow[],
  rdDeals: RDDealLite[],
  sales: Sale[],
  actions: ExpertLeadActions = {},
) {
  const leadsReportedByMeta = insights.reduce((total, insight) => total + Number(insight.leads ?? 0), 0);
  const forms = Math.min(leadsReportedByMeta, Math.max(0, Number(actions.nativeFormLeads ?? 0)));
  const siteLeads = Math.max(0, leadsReportedByMeta - forms);
  const conversations = Math.max(0, Number(actions.conversations ?? 0));
  const metaLeads = forms + siteLeads;
  const rdLeads = rdDeals.length;
  const confirmedSales = sales.filter((sale) => sale.status === "confirmed");
  const salesCount = confirmedSales.reduce((total, sale) => total + Math.max(1, Number(sale.quantity ?? 1)), 0);
  const conversionRate = rdLeads > 0 ? (salesCount / rdLeads) * 100 : 0;
  const spend = insights.reduce((total, insight) => total + Number(insight.spend ?? 0), 0);
  return {
    // `leads` is retained for the existing "Leads RD" KPI.
    leads: rdLeads,
    forms,
    siteLeads,
    conversations,
    metaLeads,
    rdLeads,
    salesCount,
    conversionRate,
    cpl: metaLeads > 0 ? spend / metaLeads : 0,
  };
}

export function getExpertAttribution(sales: Sale[]): ExpertAttribution[] {
  const rows = new Map<string, ExpertAttribution & { paymentSet: Set<string> }>();
  sales.filter((sale) => sale.status === "confirmed").forEach((sale) => {
    const campaign = sale.utm_campaign?.trim() || sale.rd_campaign_name?.trim() || "Não atribuída";
    const creative = sale.utm_content?.trim() || sale.ad_id?.trim() || "Criativo não identificado";
    const key = `${campaign}\u0000${creative}`;
    const row = rows.get(key) ?? { campaign, creative, sales: 0, revenue: 0, payments: [], paymentSet: new Set<string>() };
    row.sales += Math.max(1, Number(sale.quantity ?? 1));
    row.revenue += Number(sale.net_revenue ?? 0);
    row.paymentSet.add(normalizePaymentMethod(sale.payment_method));
    rows.set(key, row);
  });
  return Array.from(rows.values())
    .map(({ paymentSet, ...row }) => ({ ...row, payments: Array.from(paymentSet) }))
    .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);
}
