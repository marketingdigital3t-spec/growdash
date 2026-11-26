import { describe, expect, it } from "vitest";
import { readBackgroundSyncAttempt, recordBackgroundSyncAttempt } from "./backgroundSyncStorage";

describe("backgroundSyncStorage", () => {
  it("continues with in-memory deduplication when browser storage is full", () => {
    const storage = {
      getItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
      setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
    };

    expect(() => recordBackgroundSyncAttempt(storage, "scope-full", 1234)).not.toThrow();
    expect(readBackgroundSyncAttempt(storage, "scope-full")).toBe(1234);
  });

  it("uses cross-tab storage when it is available", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    recordBackgroundSyncAttempt(storage, "scope-ok", 5678);
    expect(readBackgroundSyncAttempt(storage, "scope-ok")).toBe(5678);
  });
});
