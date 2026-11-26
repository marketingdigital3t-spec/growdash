import { describe, expect, it } from "vitest";
import { buildCrmVisualScopeKey } from "./crmVisualScope";

describe("CRM visual scope", () => {
  it("changes only for the user-selected scope, not resolved provider IDs", () => {
    const first = buildCrmVisualScopeKey({ accountId: "all", accountIds: ["a"], startDate: "2026-10-27", endDate: "2026-10-27" });
    const second = buildCrmVisualScopeKey({ accountId: "all", accountIds: ["a"], startDate: "2026-10-27", endDate: "2026-10-27" });
    expect(second).toBe(first);
  });

  it("keeps account and funnel ordering stable", () => {
    expect(buildCrmVisualScopeKey({ accountId: "all", accountIds: ["b", "a"], startDate: null, endDate: null }))
      .toBe(buildCrmVisualScopeKey({ accountId: "all", accountIds: ["a", "b"], startDate: null, endDate: null }));
  });
});
