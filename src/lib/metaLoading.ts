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
  const corePending = input.insightsPending || input.accountsPending || input.coveragePending;
  return {
    isLoading: corePending && !input.hasUsableSnapshot,
    auxiliaryLoading: input.actionsPending || input.breakdownsPending,
  };
}
