import { describe, expect, it } from "vitest";
import { hasGrowdashFlowRDScopeEvidence, isGrowdashFlowRDDataAvailable, resolveGrowdashFlowAccountIds, resolveGrowdashFlowCampaignIds, summarizeGrowdashFlowRD } from "./growdashFlowMetrics";

describe("Growdash Flow analytics scope", () => {
  it("only confirms RD metrics after a successful, completed, linked-scope query", () => {
    expect(isGrowdashFlowRDDataAvailable({ scopeEnabled: true, confirmed: true })).toBe(true);
    expect(isGrowdashFlowRDDataAvailable({ scopeEnabled: true, confirmed: false })).toBe(false);
  });
  it("confirms an empty RD result only when every linked funnel covered the requested dates", () => {
    const coverage = [{ funnel_id: "funnel-1", start_date: "2026-10-01", end_date: "2026-10-05", covered_start_date: "2026-10-01", covered_end_date: "2026-10-05", status: "success", last_success_at: "2026-10-05T12:00:00Z" }];
    expect(hasGrowdashFlowRDScopeEvidence(["funnel-1"], "2026-10-04", "2026-10-04", coverage)).toBe(true);
    expect(hasGrowdashFlowRDScopeEvidence(["funnel-1"], "2026-10-04", "2026-10-04", [{ ...coverage[0], status: "syncing" }])).toBe(true);
    expect(hasGrowdashFlowRDScopeEvidence(["funnel-1"], "2026-09-30", "2026-10-04", coverage)).toBe(false);
    expect(hasGrowdashFlowRDScopeEvidence(["funnel-1", "funnel-2"], "2026-10-04", "2026-10-04", coverage)).toBe(false);
    expect(hasGrowdashFlowRDScopeEvidence(["funnel-1"], "2026-10-04", "2026-10-04", [{ ...coverage[0], last_success_at: null }])).toBe(false);
  });
  it("uses the account selected in the global toolbar", () => {
    expect(resolveGrowdashFlowAccountIds(["selected"], ["selected", "other"], "saved"))
      .toEqual(["selected"]);
  });

  it("retains the linked board account when there is no global selection", () => {
    expect(resolveGrowdashFlowAccountIds([], ["one", "two"], "saved")).toEqual(["saved"]);
  });

  it("uses all accounts for a free board when the global picker is set to all", () => {
    expect(resolveGrowdashFlowAccountIds([], ["two", "one", "one"])).toEqual(["one", "two"]);
  });

  it("never leaks a linked campaign scope into another selected account", () => {
    expect(resolveGrowdashFlowCampaignIds(["other"], "saved", ["campaign-1"])).toBeUndefined();
    expect(resolveGrowdashFlowCampaignIds(["saved"], "saved", ["campaign-1"])).toEqual(["campaign-1"]);
  });

  it("keeps RD creation, opportunity, sales, and revenue separate", () => {
    expect(summarizeGrowdashFlowRD(
      [{ stage_bucket: "open" }, { stage_bucket: "qualified" }],
      [{ amount_total_effective: 150 }, { amount_total: 50 }],
    )).toEqual({ created: 2, opportunities: 1, won: 2, revenue: 200 });
  });
});
