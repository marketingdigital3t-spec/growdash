import { describe, expect, it } from "vitest";
import { buildFastManualSyncRequest, shouldRefreshStoredMetaToken } from "./syncRequestPlan";

describe("buildFastManualSyncRequest", () => {
  it("keeps the selected period but marks the manual refresh as fast", () => {
    expect(buildFastManualSyncRequest({
      adAccountId: "account-1",
      startDate: "2026-10-14",
      endDate: "2026-10-20",
    })).toEqual({
      adAccountId: "account-1",
      startDate: "2026-10-14",
      endDate: "2026-10-20",
      force: true,
      fast: true,
      syncMode: "selected_period",
    });
  });
});

describe("shouldRefreshStoredMetaToken", () => {
  it("does not block a fast refresh on token health revalidation", () => {
    expect(shouldRefreshStoredMetaToken(true)).toBe(false);
    expect(shouldRefreshStoredMetaToken(false)).toBe(true);
  });
});
