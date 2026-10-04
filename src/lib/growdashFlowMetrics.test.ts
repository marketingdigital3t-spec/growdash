import { describe, expect, it } from "vitest";
import { hasGrowdashFlowRDSnapshotEvidence, isGrowdashFlowRDDataAvailable, resolveGrowdashFlowAccountIds, resolveGrowdashFlowCampaignIds, summarizeGrowdashFlowRD } from "./growdashFlowMetrics";

describe("Growdash Flow analytics scope", () => {
  it("only confirms RD metrics after a successful, completed, linked-scope query", () => {
    expect(isGrowdashFlowRDDataAvailable({ scopeEnabled: true, loading: true, error: false, confirmed: true })).toBe(false);
    expect(isGrowdashFlowRDDataAvailable({ scopeEnabled: true, loading: false, error: true, confirmed: true })).toBe(false);
    expect(isGrowdashFlowRDDataAvailable({ scopeEnabled: true, loading: false, error: false, confirmed: false })).toBe(false);
    expect(isGrowdashFlowRDDataAvailable({ scopeEnabled: true, loading: false, error: false, confirmed: true })).toBe(true);
  });
  it("accepts a persisted scoped snapshot for an active legacy link without a sync timestamp", () => {
    expect(hasGrowdashFlowRDSnapshotEvidence(
      ["selected"],
      [{ id: "rd-connection", accountId: "selected", status: "connected", lastSuccessAt: null }],
      ["rd-connection"],
    )).toBe(true);
    expect(hasGrowdashFlowRDSnapshotEvidence(
      ["selected"],
      [{ id: "rd-connection", accountId: "selected", status: "connected", lastSuccessAt: null }],
      [],
    )).toBe(false);
    expect(hasGrowdashFlowRDSnapshotEvidence(
      ["selected"],
      [{ id: "rd-connection", accountId: "selected", status: "disconnected", lastSuccessAt: null }],
      ["rd-connection"],
    )).toBe(false);
    expect(hasGrowdashFlowRDSnapshotEvidence(
      ["selected", "other"],
      [
        { id: "rd-connection", accountId: "selected", status: "connected", lastSuccessAt: null },
        { id: "other-connection", accountId: "other", status: "connected", lastSuccessAt: null },
      ],
      ["rd-connection"],
    )).toBe(false);
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
