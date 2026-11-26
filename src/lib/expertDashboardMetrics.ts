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
  siteLeads?: number;
  conversations?: number;
  /** Canonical total resolved from Meta insight_actions. */
  total?: number;
};

/**
 * Keeps acquisition sources explicit. The Expert's Meta total follows the Ads
 * Manager Results column (forms/site leads plus initiated conversations),
 * while the conversation component remains separately visible.
 */
export function getExpertDashboardMetrics(
  insights: InsightRow[],
  rdDeals: RDDealLite[],
  sales: Sale[],
  actions: ExpertLeadActions = {},
) {
  // Meta acquisition is resolved exclusively from insight_actions. The
  // persisted `insights.leads` column is a legacy aggregate and may contain
  // aliases that Ads Manager does not classify as a lead. Never use it as a
  // fallback when actions are missing or delayed.
  const forms = Math.max(0, Number(actions.nativeFormLeads ?? 0));
  const siteLeads = Math.max(0, Number(actions.siteLeads ?? 0));
  const conversations = Math.max(0, Number(actions.conversations ?? 0));
  const metaLeads = Math.max(0, Number(actions.total ?? forms + siteLeads + conversations));
  const rdLeads = rdDeals.length;
  const confirmedSales = sales.filter((sale) => sale.status === "confirmed");
  const salesCount = confirmedSales.reduce((total, sale) => total + Math.max(1, Number(sale.quantity ?? 1)), 0);
  // The displayed acquisition KPI is Meta leads, so its conversion rate must
  // use the same population. RD volume remains a separate reconciliation KPI.
  const conversionRate = metaLeads > 0 ? (salesCount / metaLeads) * 100 : 0;
  const spend = insights.reduce((total, insight) => total + Number(insight.spend ?? 0), 0);
  return {
    // DashboardProvider's generic "Leads" KPI must use Meta acquisitions.
    // RD deals are intentionally exposed by the dedicated `rdLeads` metric.
    leads: metaLeads,
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
