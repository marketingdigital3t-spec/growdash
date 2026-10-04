type FlowDealMetric = {
  stage_bucket?: string | null;
  amount_total_effective?: number | null;
  amount_total?: number | null;
  rd_connection_id?: string | null;
};

export type FlowRDScopeEvidence = {
  funnel_id: string;
  start_date: string;
  end_date: string;
  covered_start_date?: string | null;
  covered_end_date?: string | null;
  status: string;
  last_success_at?: string | null;
};

/** A successful empty result is valid only for a watermark covering this scope. */
export function hasGrowdashFlowRDScopeEvidence(
  funnelIds: string[],
  startDate: string,
  endDate: string,
  rows: FlowRDScopeEvidence[],
) {
  return funnelIds.length > 0 && funnelIds.every((funnelId) => rows.some((row) => {
    const coveredStart = row.covered_start_date || row.start_date;
    const coveredEnd = row.covered_end_date || row.end_date;
    return row.funnel_id === funnelId
      && Boolean(row.last_success_at)
      && coveredStart <= startDate
      && coveredEnd >= endDate;
  }));
}

export function isGrowdashFlowRDDataAvailable({ scopeEnabled, confirmed }: {
  scopeEnabled: boolean;
  confirmed: boolean;
}) {
  // Keep the last valid snapshot visible while a new request runs.
  return scopeEnabled && confirmed;
}

/** A watermark cannot turn an unfinished first fetch into a confirmed zero. */
export function hasGrowdashFlowRDQuerySnapshot({ createdDeals, wonDeals }: {
  createdDeals: unknown[] | undefined;
  wonDeals: unknown[] | undefined;
}) {
  // Cached query data remains defined during background refetch, so the last
  // confirmed snapshot stays visible while new results are loading.
  return createdDeals !== undefined && wonDeals !== undefined;
}

/**
 * The global account picker wins over a board's saved account. With no global
 * selection, linked boards retain their saved account; free boards use all.
 */
export function resolveGrowdashFlowAccountIds(
  selectedAccountIds: string[],
  allAccountIds: string[],
  linkedAccountId?: string | null,
) {
  if (selectedAccountIds.length) return Array.from(new Set(selectedAccountIds)).sort();
  if (linkedAccountId) return [linkedAccountId];
  return Array.from(new Set(allAccountIds)).sort();
}

/** Do not apply a board's campaign IDs to an unrelated global account. */
export function resolveGrowdashFlowCampaignIds(
  selectedAccountIds: string[],
  linkedAccountId: string | null | undefined,
  linkedCampaignIds: string[] | undefined,
) {
  if (!linkedCampaignIds?.length) return undefined;
  const selectionMatchesBoard = selectedAccountIds.length === 0
    || (selectedAccountIds.length === 1 && selectedAccountIds[0] === linkedAccountId);
  return selectionMatchesBoard ? linkedCampaignIds : undefined;
}

export function summarizeGrowdashFlowRD(createdDeals: FlowDealMetric[], wonDeals: FlowDealMetric[]) {
  return {
    created: createdDeals.length,
    opportunities: createdDeals.filter((deal) => deal.stage_bucket === "qualified").length,
    won: wonDeals.length,
    revenue: wonDeals.reduce((sum, deal) => sum + Number(deal.amount_total_effective ?? deal.amount_total ?? 0), 0),
  };
}
