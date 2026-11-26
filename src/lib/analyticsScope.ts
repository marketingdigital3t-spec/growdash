import { canonicalWonDealsInPeriod, type CanonicalWonDeal } from "@/lib/canonicalMetrics";

export type AnalyticsScope = {
  adAccountIds: string[];
  funnelIds: string[];
  campaignIds: string[];
  startDate: string;
  endDate: string;
  timezoneByAccount: Record<string, string>;
  attributionWindowByAccount: Record<string, string>;
};

function sortedUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

/** Stable identity shared by Dashboard, Funnel Analysis and read-only readers. */
export function normalizeAnalyticsScope(scope: AnalyticsScope): AnalyticsScope {
  return {
    ...scope,
    adAccountIds: sortedUnique(scope.adAccountIds),
    funnelIds: sortedUnique(scope.funnelIds),
    campaignIds: sortedUnique(scope.campaignIds),
    timezoneByAccount: Object.fromEntries(Object.entries(scope.timezoneByAccount).sort(([a], [b]) => a.localeCompare(b))),
    attributionWindowByAccount: Object.fromEntries(Object.entries(scope.attributionWindowByAccount).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function analyticsScopeFingerprint(scope: AnalyticsScope) {
  return JSON.stringify(normalizeAnalyticsScope(scope));
}

export type AnalyticsSnapshotState = "fresh" | "syncing" | "partial" | "stale" | "error" | "unavailable";

export type AnalyticsSnapshot = {
  fingerprint: string;
  status: AnalyticsSnapshotState;
  lastValidSnapshotAt: string | null;
  coveredAccounts: string[];
  failedAccounts: string[];
  coveredFunnels: string[];
  failedFunnels: string[];
  pagesProcessed: number;
  rowsPersisted: number;
  errors: string[];
};

export function buildAnalyticsSnapshot(args: Omit<AnalyticsSnapshot, "fingerprint"> & { scope: AnalyticsScope }): AnalyticsSnapshot {
  const { scope, ...snapshot } = args;
  return { ...snapshot, fingerprint: analyticsScopeFingerprint(scope) };
}

export type ReconciliationSummary = {
  includedDealIds: string[];
  duplicateDealIds: string[];
  outsidePeriodDealIds: string[];
  outsideScopeDealIds: string[];
  financialSaleIdsWithoutRD: string[];
};

export function reconcileCanonicalRDDeals<T extends CanonicalWonDeal>(args: {
  candidates: T[];
  startDate: Date;
  endDate: Date;
  allowedDealIds?: Set<string>;
  financialSaleIds?: Array<{ id?: string; rd_deal_id?: string | null }>;
}): ReconciliationSummary {
  const seen = new Set<string>();
  const duplicateDealIds: string[] = [];
  const includedDealIds: string[] = [];
  const outsidePeriodDealIds: string[] = [];
  const outsideScopeDealIds: string[] = [];
  for (const deal of args.candidates) {
    const id = String(deal.rd_deal_id || "").trim();
    if (!id) continue;
    if (seen.has(id)) duplicateDealIds.push(id);
    seen.add(id);
    if (args.allowedDealIds && !args.allowedDealIds.has(id)) {
      outsideScopeDealIds.push(id);
      continue;
    }
    if (!canonicalWonDealsInPeriod([deal], args.startDate, args.endDate).length) {
      outsidePeriodDealIds.push(id);
      continue;
    }
    includedDealIds.push(id);
  }
  return {
    includedDealIds: Array.from(new Set(includedDealIds)),
    duplicateDealIds: Array.from(new Set(duplicateDealIds)),
    outsidePeriodDealIds: Array.from(new Set(outsidePeriodDealIds)),
    outsideScopeDealIds: Array.from(new Set(outsideScopeDealIds)),
    financialSaleIdsWithoutRD: (args.financialSaleIds || []).filter((sale) => !sale.rd_deal_id).map((sale) => sale.id || "unknown"),
  };
}
