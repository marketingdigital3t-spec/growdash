import { describe, expect, it } from "vitest";
import { dataHealthScopeKey, resolveDataHealthState, throwOnQueryError } from "./dataHealth";

describe("data health scope", () => {
  it("does not turn a database error into an empty result", () => {
    expect(() => throwOnQueryError({ message: "permission denied" }, "sales")).toThrow("sales: permission denied");
    expect(() => throwOnQueryError(null, "sales")).not.toThrow();
  });

  it("changes when the selected funnel changes", () => {
    const first = dataHealthScopeKey({
      workspaceId: "workspace-1",
      adAccountIds: ["account-1"],
      funnelIds: ["funnel-a"],
      startDate: "2026-10-01",
      endDate: "2026-10-24",
    });
    const second = dataHealthScopeKey({
      workspaceId: "workspace-1",
      adAccountIds: ["account-1"],
      funnelIds: ["funnel-b"],
      startDate: "2026-10-01",
      endDate: "2026-10-24",
    });
    expect(first).not.toBe(second);
  });

  it("canonicalizes account and funnel order", () => {
    expect(dataHealthScopeKey({
      workspaceId: "workspace-1",
      adAccountIds: ["account-2", "account-1"],
      funnelIds: ["funnel-b", "funnel-a"],
      startDate: "2026-10-01",
      endDate: "2026-10-24",
    })).toBe(dataHealthScopeKey({
      workspaceId: "workspace-1",
      adAccountIds: ["account-1", "account-2"],
      funnelIds: ["funnel-a", "funnel-b"],
      startDate: "2026-10-01",
      endDate: "2026-10-24",
    }));
  });

  it("exposes a failed first load instead of an infinite spinner", () => {
    expect(resolveDataHealthState({ isLoading: true, hasData: false })).toBe("loading");
    expect(resolveDataHealthState({ isLoading: false, hasData: false, error: new Error("offline") })).toBe("error");
    expect(resolveDataHealthState({ isLoading: false, hasData: true, error: new Error("refresh failed") })).toBe("ready");
  });
});
