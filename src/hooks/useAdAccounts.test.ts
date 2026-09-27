import { describe, expect, it } from "vitest";
import { isActiveMetaAccount } from "./useAdAccounts";

describe("active Meta account visibility", () => {
  it("accepts only connected accounts", () => {
    expect(isActiveMetaAccount({ connection_status: "connected" })).toBe(true);
    expect(isActiveMetaAccount({ connection_status: "disconnected" })).toBe(false);
    expect(isActiveMetaAccount({ connection_status: "blocked" })).toBe(false);
  });

  it("rejects a profile-disconnected account even if its row is stale", () => {
    expect(isActiveMetaAccount({ connection_status: "connected", metadata: { profile_disconnected: true } })).toBe(false);
  });
});
