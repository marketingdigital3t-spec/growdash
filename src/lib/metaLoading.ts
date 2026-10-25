export interface MetaLoadingInputs {
  insightsPending: boolean;
  accountsPending: boolean;
  coveragePending: boolean;
  actionsPending: boolean;
  breakdownsPending: boolean;
  hasUsableSnapshot: boolean;
}

/**
 * Meta Insights is the core snapshot. Actions and breakdowns enrich it, but
 * must not keep already confirmed spend/impressions cards in a full-screen
 * loading state while their paginated queries finish.
 */
export function resolveMetaLoadingState(input: MetaLoadingInputs) {
  // Coverage is a reconciliation watermark. It can be unavailable or slow
  // while the persisted Insights facts are already enough to paint spend and
  // impressions. Keep it auxiliary so the first useful snapshot is not held
  // behind a second provider request.
  const corePending = input.insightsPending || input.accountsPending;
  return {
    isLoading: corePending && !input.hasUsableSnapshot,
    auxiliaryLoading: input.coveragePending || input.actionsPending || input.breakdownsPending,
  };
}
