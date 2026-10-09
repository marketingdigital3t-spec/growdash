import { describe, expect, it } from "vitest";
import { shouldInvalidateLiveQuery } from "./liveQueryInvalidation";

describe("live query invalidation", () => {
  it("refreshes Meta action coverage after a sync watermark changes", () => {
    expect(shouldInvalidateLiveQuery(["meta-action-sync-coverage", ["account-1"]])).toBe(true);
  });

  it("refreshes canonical lead actions after the selected Meta sync completes", () => {
    expect(shouldInvalidateLiveQuery(["action-totals-by-ads", "ad-1", "account-1"])).toBe(true);
  });

  it("refreshes RD stage distribution when deal or funnel-stage snapshots change", () => {
    expect(shouldInvalidateLiveQuery(["rd_deals", "funnel-1", "history"])).toBe(true);
    expect(shouldInvalidateLiveQuery(["rd_funnel_stages", "funnel-1"])).toBe(true);
    expect(shouldInvalidateLiveQuery(["rd_deal_stage_history", "funnel-1"])).toBe(true);
  });

  it("does not invalidate unrelated cached module data", () => {
    expect(shouldInvalidateLiveQuery(["agent-office-directors", "workspace-1"])).toBe(false);
  });
});
