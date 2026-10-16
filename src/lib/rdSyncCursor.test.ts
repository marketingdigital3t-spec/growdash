import { describe, expect, it } from "vitest";
import {
  buildPendingRDSyncCursors,
  shouldHydrateRDAnalyticsDeal,
} from "../../supabase/functions/_shared/rdSyncCursor";

describe("RD resumable sync cursors", () => {
  const segments = [
    { name: "won" },
    { name: "ongoing" },
    { name: "lost" },
    { name: "paused" },
  ];

  it("keeps the current page and initializes every remaining segment", () => {
    expect(buildPendingRDSyncCursors(segments, 1, 3)).toEqual([
      { segment: "ongoing", nextPage: 3 },
      { segment: "lost", nextPage: 1 },
      { segment: "paused", nextPage: 1 },
    ]);
  });

  it("does not create checkpoints for completed segments", () => {
    expect(buildPendingRDSyncCursors(segments, segments.length, 8)).toEqual([]);
  });

  it("never persists an invalid page", () => {
    expect(buildPendingRDSyncCursors(segments, 0, 0)[0]).toEqual({ segment: "won", nextPage: 1 });
  });

  it("does not hydrate every deal during a full-history mirror", () => {
    expect(shouldHydrateRDAnalyticsDeal({
      analyticsMode: true,
      skipEnrichment: false,
      fullHistoryRequested: true,
    })).toBe(false);
  });

  it("keeps bounded analytics enrichment available", () => {
    expect(shouldHydrateRDAnalyticsDeal({
      analyticsMode: true,
      skipEnrichment: false,
      fullHistoryRequested: false,
    })).toBe(true);
  });

  it("honors an explicit enrichment opt-out", () => {
    expect(shouldHydrateRDAnalyticsDeal({
      analyticsMode: true,
      skipEnrichment: true,
      fullHistoryRequested: false,
    })).toBe(false);
  });
});
