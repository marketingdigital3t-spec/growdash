import { describe, expect, it } from "vitest";
import { isActiveMetaAccount } from "./useAdAccounts";

describe("active Meta account visibility", () => {
  it("accepts only connected accounts", () => {
    expect(isActiveMetaAccount({ connection_status: "connected" })).toBe(true);
    expect(isActiveMetaAccount({ connection_status: "disconnected" })).toBe(false);
    expect(isActiveMetaAccount({ connection_status: "blocked" })).toBe(false);
  });

  it("keeps a manually reactivated account visible after its old marker remains", () => {
    expect(isActiveMetaAccount({ connection_status: "connected", metadata: { profile_disconnected: true } })).toBe(true);
    expect(isActiveMetaAccount({ connection_status: "disconnected", metadata: { profile_disconnected: true } })).toBe(false);
  });
});
