import { canonicalWonDealsInPeriod } from "@/lib/canonicalMetrics";
import { businessDateKey, parseBusinessDate } from "@/lib/businessDate";
import { isDealInRDAccountOrFunnelScope } from "@/lib/rdQueryScope";
import { aggregateRevenueSources, type RDRevenueDeal } from "@/lib/revenueAggregation";

export type MonthlyGoalDeal = RDRevenueDeal & {
  rd_funnel_id?: string | null;
  closed_at?: string | null;
  stage_updated_at?: string | null;
};

export interface MonthlyGoalRevenueScope {
  startDate: Date;
  endDate: Date;
  visibleAccountIds: ReadonlySet<string>;
  selectedAccountId: string;
  funnelIds?: readonly string[];
}

export function businessMonthRange(now: Date = new Date()) {
  const monthKey = businessDateKey(now).slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonthKey = businessDateKey(new Date(Date.UTC(year, month, 15))).slice(0, 7);
  const nextMonthStart = parseBusinessDate(`${nextMonthKey}-01`);
  return {
    startDate: parseBusinessDate(`${monthKey}-01`),
    endDate: new Date(nextMonthStart.getTime() - 1),
  };
}

function accountScope(scope: MonthlyGoalRevenueScope) {
  if (scope.selectedAccountId !== "all") {
    return scope.visibleAccountIds.has(scope.selectedAccountId) ? [scope.selectedAccountId] : [];
  }
  return Array.from(scope.visibleAccountIds);
}

/** Selects the canonical RD sales for the exact visible account/funnel scope. */
export function selectMonthlyGoalDeals(deals: MonthlyGoalDeal[], scope: MonthlyGoalRevenueScope) {
  const accountIds = accountScope(scope);
  if (!accountIds.length) return [];
  const funnelIds = Array.from(new Set((scope.funnelIds ?? []).filter(Boolean)));
  const scoped = deals.filter((deal) => isDealInRDAccountOrFunnelScope(deal, accountIds, funnelIds));
  return canonicalWonDealsInPeriod(scoped, scope.startDate, scope.endDate);
}

/** Returns the official monthly revenue used by the dashboard goal bar. */
export function aggregateMonthlyGoalRevenue(deals: MonthlyGoalDeal[], scope: MonthlyGoalRevenueScope) {
  return aggregateRevenueSources([], selectMonthlyGoalDeals(deals, scope)).rdRevenue;
}
