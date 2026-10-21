import { describe, expect, it } from "vitest";
import { buildFastManualSyncRequest } from "./syncRequestPlan";

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
