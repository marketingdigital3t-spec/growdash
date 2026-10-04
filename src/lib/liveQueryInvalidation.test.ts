import { describe, expect, it } from "vitest";
import { shouldInvalidateLiveQuery } from "./liveQueryInvalidation";

describe("live query invalidation", () => {
  it("refreshes Meta action coverage after a sync watermark changes", () => {
    expect(shouldInvalidateLiveQuery(["meta-action-sync-coverage", ["account-1"]])).toBe(true);
  });

  it("does not invalidate unrelated cached module data", () => {
    expect(shouldInvalidateLiveQuery(["agent-office-directors", "workspace-1"])).toBe(false);
  });
});
