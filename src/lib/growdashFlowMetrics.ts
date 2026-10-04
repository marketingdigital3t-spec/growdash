type FlowDealMetric = {
  stage_bucket?: string | null;
  amount_total_effective?: number | null;
  amount_total?: number | null;
};

export function isGrowdashFlowRDDataAvailable({ scopeEnabled, loading, error, confirmed }: {
  scopeEnabled: boolean;
  loading: boolean;
  error: boolean;
  confirmed: boolean;
}) {
  return scopeEnabled && !loading && !error && confirmed;
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
