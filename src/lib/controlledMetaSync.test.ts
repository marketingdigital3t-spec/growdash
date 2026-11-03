import { describe, expect, it } from "vitest";
import { canRunSelectedMetaLeadSync, controlledFunctionError, controlledSyncErrorMessage, selectedMetaSyncIsPartial } from "./controlledMetaSync";

describe("selected Meta sync blocks", () => {
  it("runs leads after a partial Insights response", () => {
    expect(canRunSelectedMetaLeadSync({ data: { status: "partial" } })).toBe(true);
  });

  it("does not run leads after a failed or blocked Insights response", () => {
    expect(canRunSelectedMetaLeadSync({ data: { status: "failed" } })).toBe(false);
    expect(canRunSelectedMetaLeadSync({ data: { status: "blocked" } })).toBe(false);
    expect(canRunSelectedMetaLeadSync({ error: new Error("Insights failed") })).toBe(false);
  });

  it("keeps the combined sync partial when either independent block is partial or failed", () => {
    expect(selectedMetaSyncIsPartial({ data: { status: "partial" } }, { data: { status: "success" } })).toBe(true);
    expect(selectedMetaSyncIsPartial({ data: { status: "success" } }, { data: { status: "partial" } })).toBe(true);
    expect(selectedMetaSyncIsPartial({ data: { status: "success" } }, { error: new Error("Leads failed") })).toBe(true);
    expect(selectedMetaSyncIsPartial({ data: { status: "success" } }, { data: { status: "success" } })).toBe(false);
  });

  it("keeps the provider error code when an auxiliary function returns a terminal status", () => {
    expect(controlledSyncErrorMessage("sync-meta-leads", null, {
      status: "failed",
      error_code: "PROVIDER_TIMEOUT",
      errors: ["Meta excedeu 90s; snapshot anterior preservado."],
    })).toBe("PROVIDER_TIMEOUT: [\"Meta excedeu 90s; snapshot anterior preservado.\"]");
  });

  it("preserves an HTTP provider failure when the Edge Function returns no JSON", () => {
    expect(controlledFunctionError("rd-sync-deals", 504, null)).toEqual({
      error: "PROVIDER_TIMEOUT: rd-sync-deals failed with HTTP 504",
      data: { status: "failed", error_code: "PROVIDER_TIMEOUT" },
    });
  });
});
