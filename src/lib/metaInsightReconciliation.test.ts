import { describe, expect, it } from "vitest";
import { datesSafeToReconcile, staleAdIdsForDailySnapshot } from "../../supabase/functions/_shared/metaInsightReconciliation";

describe("Meta daily fact reconciliation", () => {
  it("preserves prior snapshot dates omitted by an otherwise non-empty range response", () => {
    expect(datesSafeToReconcile("2026-10-02", "2026-10-04", [
      { date_start: "2026-10-02", ad_id: "ad-1" },
      { date_start: "2026-10-04", ad_id: "ad-2" },
    ])).toEqual(["2026-10-02", "2026-10-04"]);
  });

  it("does not reconcile any date when the response has no ad rows", () => {
    expect(datesSafeToReconcile("2026-10-03", "2026-10-03", [])).toEqual([]);
  });

  it("keeps date matching civil and inclusive across month boundaries", () => {
    expect(datesSafeToReconcile("2026-10-31", "2026-11-02", [
      { date_start: "2026-10-31", ad_id: "ad-1" },
      { date_start: "2026-11-02", ad_id: "ad-2" },
    ])).toEqual(["2026-10-31", "2026-11-02"]);
  });

  it("deletes only explicitly stale ads and always preserves incoming facts", () => {
    expect(staleAdIdsForDailySnapshot(["old-ad", "present-1", "present-2"], ["present-1", "present-2"]))
      .toEqual(["old-ad"]);
    expect(staleAdIdsForDailySnapshot(["present-1", "present-2"], ["present-1", "present-2"]))
      .toEqual([]);
  });

  it("does not reconcile a date when the completed response has no rows", () => {
    expect(datesSafeToReconcile("2026-10-03", "2026-10-03", [])).toEqual([]);
  });
});
