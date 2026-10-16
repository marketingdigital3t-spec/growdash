import { describe, expect, it } from "vitest";
import { buildPendingRDSyncCursors } from "../../supabase/functions/_shared/rdSyncCursor";

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
});
