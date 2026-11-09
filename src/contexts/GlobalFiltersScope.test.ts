import { describe, expect, it } from "vitest";

export function sanitizeSelectedAdAccountIds(selectedIds: string[], availableAccounts: { id: string }[]): string[] {
  if (!availableAccounts.length) return selectedIds;
  const availableSet = new Set(availableAccounts.map((acc) => acc.id));
  return selectedIds.filter((id) => availableSet.has(id));
}

export function getUserFiltersStorageKey(baseKey: string, userId: string | null | undefined): string {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

describe("GlobalFilters scope sanitization for delegated users", () => {
  it("preserves valid account selections that exist in the user accessible accounts", () => {
    const available = [{ id: "acc-1" }, { id: "acc-2" }];
    const selected = ["acc-1"];
    expect(sanitizeSelectedAdAccountIds(selected, available)).toEqual(["acc-1"]);
  });

  it("strips unauthorized account ids from previous session or another user", () => {
    const available = [{ id: "acc-2" }]; // delegated user only has access to acc-2
    const previousStored = ["acc-1", "acc-2"]; // acc-1 belonged to the admin
    expect(sanitizeSelectedAdAccountIds(previousStored, available)).toEqual(["acc-2"]);
  });

  it("returns empty array when user has no access to any of the previously selected accounts", () => {
    const available = [{ id: "acc-3" }];
    const previousStored = ["acc-1", "acc-2"];
    expect(sanitizeSelectedAdAccountIds(previousStored, available)).toEqual([]);
  });

  it("namespaces storage key per authenticated user to prevent session contamination", () => {
    expect(getUserFiltersStorageKey("growdash:filters", "user-123")).toBe("growdash:filters:user-123");
    expect(getUserFiltersStorageKey("growdash:filters", null)).toBe("growdash:filters");
  });
});
