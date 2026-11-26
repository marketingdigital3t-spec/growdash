import { describe, expect, it } from "vitest";
import { isSameQueryScope } from "./queryScope";

describe("query scope placeholder safety", () => {
  const metaScope = ["insights", ["account-ca01"], "campaign-a", "2026-10-04", "2026-10-04", "account_default"];

  it("retains a snapshot only for the exact same scope", () => {
    expect(isSameQueryScope(metaScope, [...metaScope])).toBe(true);
  });

  it("rejects previous snapshots when account, campaign, period, or attribution changes", () => {
    expect(isSameQueryScope(metaScope, ["insights", ["account-ca02"], "campaign-a", "2026-10-04", "2026-10-04", "account_default"])).toBe(false);
    expect(isSameQueryScope(metaScope, ["insights", ["account-ca01"], "campaign-b", "2026-10-04", "2026-10-04", "account_default"])).toBe(false);
    expect(isSameQueryScope(metaScope, ["insights", ["account-ca01"], "campaign-a", "2026-10-03", "2026-10-04", "account_default"])).toBe(false);
    expect(isSameQueryScope(metaScope, ["insights", ["account-ca01"], "campaign-a", "2026-10-04", "2026-10-04", "7d_click"])).toBe(false);
  });

  it("does not retain a snapshot when there is no previous query", () => {
    expect(isSameQueryScope(undefined, metaScope)).toBe(false);
  });
});
