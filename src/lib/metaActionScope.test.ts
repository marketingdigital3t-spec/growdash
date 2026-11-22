import { describe, expect, it, vi } from "vitest";
import {
  ACTION_SCOPE_PAGE_SIZE,
  fetchActionRows,
  MAX_ACTION_SCOPE_PAGES,
  normalizeActionScopeAccountIds,
} from "./metaActionScope";

describe("normalizeActionScopeAccountIds", () => {
  it("keeps only unique, non-empty account ids", () => {
    expect(
      normalizeActionScopeAccountIds([
        { id: "acc-1" },
        { id: "acc-1" },
        { id: "acc-2" },
        { id: "" },
        { id: null },
      ]),
    ).toEqual(["acc-1", "acc-2"]);
  });

  it("drops the 'all' pseudo account", () => {
    expect(normalizeActionScopeAccountIds([{ id: "all" }, { id: "acc-1" }])).toEqual(["acc-1"]);
  });

  it("returns an empty list for a missing account scope", () => {
    expect(normalizeActionScopeAccountIds(undefined)).toEqual([]);
  });
});

describe("fetchActionRows", () => {
  it("never queries without an account scope", async () => {
    const fetchPage = vi.fn();
    const rows = await fetchActionRows({ accountIds: [], fetchPage });
    expect(rows).toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("stops paginating once a short page is returned", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ rows: new Array(ACTION_SCOPE_PAGE_SIZE).fill({ id: 1 }), error: null })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], error: null });
    const rows = await fetchActionRows({ accountIds: ["acc-1"], fetchPage });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(ACTION_SCOPE_PAGE_SIZE + 1);
  });

  it("bounds the number of pages so a huge table cannot exhaust the pool", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      rows: new Array(ACTION_SCOPE_PAGE_SIZE).fill({ id: 1 }),
      error: null,
    });
    const rows = await fetchActionRows({ accountIds: ["acc-1"], fetchPage });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_ACTION_SCOPE_PAGES);
    expect(rows).toHaveLength(MAX_ACTION_SCOPE_PAGES * ACTION_SCOPE_PAGE_SIZE);
  });

  it("propagates a page error instead of returning a partial catalog", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ rows: [], error: { message: "boom" } });
    await expect(fetchActionRows({ accountIds: ["acc-1"], fetchPage })).rejects.toThrow("boom");
  });
});
