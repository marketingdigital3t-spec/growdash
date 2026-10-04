import { describe, expect, it } from "vitest";
import { findMetaSyncCoverage, findMetaSyncIssue, getMetaCoverageGaps, type MetaSyncCoverageRow } from "./metaSyncCoverage";

const base: MetaSyncCoverageRow = {
  ad_account_id: "account-1",
  campaign_scope: "all-campaigns",
  start_date: "2026-10-01",
  end_date: "2026-10-03",
  covered_start_date: "2026-10-01",
  covered_end_date: "2026-10-03",
  timezone: "America/Sao_Paulo",
  attribution_window: "account_default",
  status: "fresh",
  block_status: {
    insights: { status: "fresh", rowsPersisted: 2 },
    actions: { status: "fresh", rowsPersisted: 1, leadRowsPersisted: 1, sourceInsightRows: 2 },
  },
  updated_at: "2026-10-03T12:00:00Z",
};

const account = { accountId: "account-1", timezone: "America/Sao_Paulo", attributionWindow: "account_default" };

describe("Meta sync coverage", () => {
  it("requires the selected account, inclusive date coverage, timezone, and attribution", () => {
    expect(findMetaSyncCoverage([base], account, "2026-10-02", "2026-10-02")).toEqual(base);
    expect(findMetaSyncCoverage([base], { ...account, timezone: "UTC" }, "2026-10-02", "2026-10-02")).toBeNull();
    expect(findMetaSyncCoverage([base], { ...account, attributionWindow: "7d_click" }, "2026-10-02", "2026-10-02")).toBeNull();
    expect(findMetaSyncCoverage([base], account, "2026-09-30", "2026-10-02")).toBeNull();
  });

  it("requires the action block to be confirmed and does not treat missing rows as zero", () => {
    expect(findMetaSyncCoverage([{ ...base, block_status: { actions: { status: "pending" } } }], account, "2026-10-02", "2026-10-02")).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, status: "partial", block_status: { actions: { status: "partial" } } }], account, "2026-10-02", "2026-10-02")).toBeNull();
  });

  it("rejects legacy watermarks without evidence that rows were persisted", () => {
    expect(findMetaSyncCoverage([{ ...base, block_status: { insights: { status: "fresh" }, actions: { status: "fresh" } } }], account, "2026-10-02", "2026-10-02", [], "insights")).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { insights: { status: "fresh", rowsPersisted: 2 }, actions: { status: "fresh", rowsPersisted: 0 } } }], account, "2026-10-02", "2026-10-02", [], "actions")).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { insights: { status: "fresh", rowsPersisted: 2 }, actions: { status: "fresh", rowsPersisted: 0, sourceInsightRows: 2 } } }], account, "2026-10-02", "2026-10-02", [], "actions")).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { insights: { status: "fresh", rowsPersisted: 2 }, actions: { status: "fresh", rowsPersisted: 18, sourceInsightRows: 2 } } }], account, "2026-10-02", "2026-10-02", [], "actions")).toBeNull();
  });

  it("accepts zero leads only with complete v2 response and verified persistence evidence", () => {
    const zeroActions = {
      status: "fresh",
      sourceInsightRows: 3,
      rowsPersisted: 0,
      leadRowsPersisted: 0,
      allActionRowsPersisted: 4,
      allActionRowsExpected: 4,
      evidenceVersion: 2,
      responseComplete: true,
      persistenceVerified: true,
      zeroResultConfirmed: true,
    };
    expect(findMetaSyncCoverage([{ ...base, block_status: { ...base.block_status, actions: zeroActions } }], account, "2026-10-02", "2026-10-02")).not.toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { ...base.block_status, actions: { ...zeroActions, persistenceVerified: false } } }], account, "2026-10-02", "2026-10-02")).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { ...base.block_status, actions: { ...zeroActions, allActionRowsPersisted: 3 } } }], account, "2026-10-02", "2026-10-02")).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { ...base.block_status, actions: { ...zeroActions, evidenceVersion: 1 } } }], account, "2026-10-02", "2026-10-02")).toBeNull();
  });

  it("accepts an empty Insights result only when the complete response and zero are confirmed", () => {
    const confirmedZero = {
      status: "fresh",
      rowsPersisted: 0,
      evidenceVersion: 2,
      responseComplete: true,
      persistenceVerified: true,
      zeroResultConfirmed: true,
    };
    expect(findMetaSyncCoverage([{ ...base, block_status: { insights: confirmedZero } }], account, "2026-10-02", "2026-10-02", [], "insights")).not.toBeNull();
    expect(findMetaSyncCoverage([{ ...base, block_status: { insights: { ...confirmedZero, responseComplete: false } } }], account, "2026-10-02", "2026-10-02", [], "insights")).toBeNull();
  });

  it("accepts an all-campaign snapshot or an explicit superset, never a different campaign", () => {
    expect(findMetaSyncCoverage([{ ...base, campaign_scope: "campaign-1,campaign-2" }], account, "2026-10-02", "2026-10-02", ["campaign-1"])).not.toBeNull();
    expect(findMetaSyncCoverage([{ ...base, campaign_scope: "campaign-2" }], account, "2026-10-02", "2026-10-02", ["campaign-1"])).toBeNull();
    expect(findMetaSyncCoverage([{ ...base, campaign_scope: "campaign-1" }], account, "2026-10-02", "2026-10-02")).toBeNull();
  });

  it("marks multi-account scopes incomplete when one account lacks confirmed coverage", () => {
    const second = { ...account, accountId: "account-2" };
    expect(getMetaCoverageGaps([base], [account, second], "2026-10-02", "2026-10-02")).toEqual([second]);
  });

  it("returns the actual failed sync reason for the exact scope without treating it as coverage", () => {
    const failed = {
      ...base,
      status: "error",
      last_error: "Meta não retornou linhas de Insights para 2026-10-02.",
      block_status: { insights: { status: "error", reasonCode: "meta_returned_no_rows" } },
    };
    expect(findMetaSyncCoverage([failed], account, "2026-10-02", "2026-10-02", [], "insights")).toBeNull();
    expect(findMetaSyncIssue([failed], account, "2026-10-02", "2026-10-02", [], "insights")?.last_error).toContain("Meta não retornou linhas");
    expect(findMetaSyncIssue([failed], { ...account, timezone: "UTC" }, "2026-10-02", "2026-10-02", [], "insights")).toBeNull();
  });
});
