import { describe, expect, it } from "vitest";
import { RD_AUTO_SYNC_INTERVAL_MS } from "./rdAutoSyncPolicy";

describe("RD automatic synchronization policy", () => {
  it("runs no more often than every fifteen minutes", () => {
    expect(RD_AUTO_SYNC_INTERVAL_MS).toBe(15 * 60_000);
  });
});
