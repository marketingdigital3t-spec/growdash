import { describe, expect, it } from "vitest";
import { replayAttributionFixture, replayFailure, SYNC_REPLAY_FIXTURES } from "./syncReplayHarness";

describe("Meta/RD replay harness", () => {
  it("replays form, conversation and incomplete attribution without inference", () => {
    const results = SYNC_REPLAY_FIXTURES.map(replayAttributionFixture);
    expect(results.map((result) => result.status)).toEqual(["captured", "captured", "partial"]);
    expect(results[0].idempotencyKey).toContain("lead-form-001");
    expect(results[1].idempotencyKey).toContain("conversation-001");
  });

  it("keeps provider failures separate from a preserved snapshot", () => {
    expect(replayFailure("failed")).toBe("failed");
    expect(replayFailure("failed", true)).toBe("failed");
    expect(replayFailure("stale", true)).toBe("stale");
    expect(replayFailure("blocked")).toBe("blocked");
  });
});
