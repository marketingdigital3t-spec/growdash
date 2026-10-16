export type RDSyncSegment = { name: string };

export type RDSyncPendingCursor = {
  segment: string;
  nextPage: number;
};

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
