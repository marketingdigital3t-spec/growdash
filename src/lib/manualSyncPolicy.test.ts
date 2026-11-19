import { describe, expect, it } from "vitest";
import {
  MANUAL_SYNC_COOLDOWN_MS,
  canRunAutomaticSync,
  manualSyncCooldownRemainingMs,
  recordManualSync,
} from "./manualSyncPolicy";

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
}

describe("manual sync cooldown policy", () => {
  it("blocks the automatic sync right after a manual refresh", () => {
    const storage = createStorage();
    recordManualSync(storage, "scope-1", 1_000_000);

    expect(canRunAutomaticSync(storage, "scope-1", 1_000_000)).toBe(false);
    expect(manualSyncCooldownRemainingMs(storage, "scope-1", 1_000_000)).toBe(MANUAL_SYNC_COOLDOWN_MS);
  });

  it("allows the automatic sync once 15 minutes have passed", () => {
    const storage = createStorage();
    const start = 1_000_000;
    recordManualSync(storage, "scope-1", start);

    const afterCooldown = start + MANUAL_SYNC_COOLDOWN_MS + 1;
    expect(canRunAutomaticSync(storage, "scope-1", afterCooldown)).toBe(true);
    expect(manualSyncCooldownRemainingMs(storage, "scope-1", afterCooldown)).toBe(0);
  });

  it("keeps the cooldown scoped per account/period", () => {
    const storage = createStorage();
    recordManualSync(storage, "scope-1", 1_000_000);

    expect(canRunAutomaticSync(storage, "scope-2", 1_000_000)).toBe(true);
    expect(canRunAutomaticSync(storage, "scope-1", 1_000_000)).toBe(false);
  });

  it("allows the automatic sync when no manual refresh happened", () => {
    const storage = createStorage();
    // Um timestamp no passado distante equivale a "nunca houve clique".
    recordManualSync(storage, "scope-1", 0);
    expect(canRunAutomaticSync(storage, "scope-1", 1_000_000)).toBe(true);
  });

  it("counts the remaining window down", () => {
    const storage = createStorage();
    const start = 1_000_000;
    recordManualSync(storage, "scope-1", start);

    const fiveMinutes = start + 5 * 60_000;
    expect(manualSyncCooldownRemainingMs(storage, "scope-1", fiveMinutes)).toBe(10 * 60_000);
  });
});
