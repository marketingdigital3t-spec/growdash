import { describe, expect, it } from "vitest";
import { shouldForceSyncForContextChange } from "@/lib/nearRealtimeSyncPolicy";

describe("near realtime sync policy", () => {
  const base = { scope: "account-a:2026-10-01:2026-10-27", navigationKey: "/" };

  it("does not force a full selected-period sync on the initial mount", () => {
    expect(shouldForceSyncForContextChange(null, base)).toBe(false);
  });

  it("forces a sync when the account or date scope changes", () => {
    expect(shouldForceSyncForContextChange(base, { ...base, scope: "account-b:2026-10-01:2026-10-27" })).toBe(true);
    expect(shouldForceSyncForContextChange(base, { ...base, scope: "account-a:2026-10-02:2026-10-27" })).toBe(true);
  });

  it("forces a sync when the app tab changes", () => {
    expect(shouldForceSyncForContextChange(base, { ...base, navigationKey: "/crm" })).toBe(true);
  });

  it("does not force a duplicate sync when context is unchanged", () => {
    expect(shouldForceSyncForContextChange(base, base)).toBe(false);
  });
});
