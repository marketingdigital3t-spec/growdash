import { addDays, differenceInCalendarDays } from "date-fns";

export interface TrafficComparisonPeriod {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

export interface TrafficComparisonSnapshot {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  deals: number;
  opportunities: number;
  sales: number;
  revenue: number;
}

export function resolveComparisonPeriod(start: Date, end: Date): TrafficComparisonPeriod {
  const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const previousEnd = addDays(start, -1);
  return { currentStart: start, currentEnd: end, previousStart: addDays(previousEnd, -(days - 1)), previousEnd };
}

export function percentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function emptyTrafficComparisonSnapshot(): TrafficComparisonSnapshot {
  return { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, deals: 0, opportunities: 0, sales: 0, revenue: 0 };
}

export function aggregateTrafficComparison({ insights = [], deals = [], sales = [] }: {
  insights?: Array<{ spend?: number | null; impressions?: number | null; reach?: number | null; clicks?: number | null; form_leads?: number | null; site_leads?: number | null; conversations?: number | null }>;
  deals?: Array<{ win?: boolean | null; stage_bucket?: string | null }>;
  sales?: Array<{ status?: string | null; quantity?: number | null; net_revenue?: number | null }>;
}): TrafficComparisonSnapshot {
  const snapshot = emptyTrafficComparisonSnapshot();
  for (const row of insights) {
    snapshot.spend += Number(row.spend || 0);
    snapshot.impressions += Number(row.impressions || 0);
    snapshot.reach += Number(row.reach || 0);
    snapshot.clicks += Number(row.clicks || 0);
    snapshot.leads += Number(row.form_leads || 0) + Number(row.site_leads || 0) + Number(row.conversations || 0);
  }
  snapshot.deals = deals.length;
  snapshot.opportunities = deals.filter((deal) => ["qualified", "opportunity", "client"].includes(String(deal.stage_bucket || "").toLowerCase()) && !deal.win).length;
  for (const sale of sales) {
    if (String(sale.status || "").toLowerCase() !== "confirmed") continue;
    snapshot.sales += Math.max(1, Number(sale.quantity || 1));
    snapshot.revenue += Number(sale.net_revenue || 0);
  }
  return snapshot;
}
