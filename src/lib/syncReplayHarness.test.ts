import { describe, expect, it } from "vitest";
import { replayAttributionFixture, replayFailure, replaySyncScenario, SYNC_REPLAY_FIXTURES, SYNC_REPLAY_SCENARIOS } from "./syncReplayHarness";

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

  it("covers the controlled failure matrix and keeps recovery evidence", () => {
    expect(SYNC_REPLAY_SCENARIOS).toHaveLength(11);
    expect(replaySyncScenario("pagination-resume")).toMatchObject({ status: "success", cursor: "page-2", recordsUpserted: 2 });
    expect(replaySyncScenario("rate-limit")).toMatchObject({ status: "success", retries: 3 });
    expect(replaySyncScenario("duplicate-event")).toMatchObject({ status: "success", duplicateRecords: 1, recordsUpserted: 0 });
    expect(replaySyncScenario("rd-unavailable")).toMatchObject({ status: "partial", outboxQueued: 1 });
    expect(replaySyncScenario("interrupted-run")).toMatchObject({ status: "stale", cursor: "page-4", previousSnapshotPreserved: true });
  });

  it("blocks credentials and permissions instead of converting them to success", () => {
    expect(replaySyncScenario("token-expired")).toMatchObject({ status: "blocked", errorCode: "TOKEN_EXPIRED", deadLettered: 1 });
    expect(replaySyncScenario("permission-denied")).toMatchObject({ status: "blocked", errorCode: "PERMISSION_DENIED", deadLettered: 1 });
    expect(replaySyncScenario("database-error")).toMatchObject({ status: "stale", previousSnapshotPreserved: true });
  });
});
