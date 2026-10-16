export type RDSyncSegment = { name: string };

export type RDSyncPendingCursor = {
  segment: string;
  nextPage: number;
};

export type RDAnalyticsHydrationOptions = {
  analyticsMode: boolean;
  skipEnrichment: boolean;
  fullHistoryRequested: boolean;
};

/**
 * A full-history reconciliation mirrors the provider list payload. Hydrating
 * every deal through detail/contact endpoints can exhaust the Edge runtime
 * before the page cursor is persisted. Bounded analytics runs still hydrate
 * incomplete records, and missing contact fields have a separate path.
 */
export function shouldHydrateRDAnalyticsDeal({
  analyticsMode,
  skipEnrichment,
  fullHistoryRequested,
}: RDAnalyticsHydrationOptions): boolean {
  return analyticsMode && !skipEnrichment && !fullHistoryRequested;
}

/**
 * Builds the durable checkpoints for a resumable RD status walk.
 * The current segment resumes at its current page; later segments start at
 * page one. Completed segments are intentionally excluded.
 */
export function buildPendingRDSyncCursors(
  segments: RDSyncSegment[],
  startIndex: number,
  currentPage: number,
): RDSyncPendingCursor[] {
  return segments.slice(startIndex).map((segment, offset) => ({
    segment: segment.name,
    nextPage: offset === 0 ? Math.max(1, currentPage) : 1,
  }));
}
