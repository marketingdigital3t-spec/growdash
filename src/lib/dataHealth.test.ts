import { describe, expect, it } from "vitest";
import { dataHealthScopeKey, resolveDataHealthState, throwOnQueryError } from "./dataHealth";

describe("data health contracts", () => {
  it("does not turn a database error into an empty result", () => {
    expect(() => throwOnQueryError({ message: "permission denied" }, "sales")).toThrow("sales: permission denied");
    expect(() => throwOnQueryError(null, "sales")).not.toThrow();
  });

  it("keeps workspace, accounts and date range in the effective scope", () => {
    expect(dataHealthScopeKey({ workspaceId: "w1", adAccountIds: ["b", "a"], startDate: "2026-10-16", endDate: "2026-10-22" }))
      .toBe("w1:a,b:2026-10-16:2026-10-22");
  });

  it("exposes a failed first load instead of an infinite spinner", () => {
    expect(resolveDataHealthState({ isLoading: true, hasData: false })).toBe("loading");
    expect(resolveDataHealthState({ isLoading: false, hasData: false, error: new Error("offline") })).toBe("error");
    expect(resolveDataHealthState({ isLoading: false, hasData: true, error: new Error("refresh failed") })).toBe("ready");
  });
});
