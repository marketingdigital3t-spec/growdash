import { describe, expect, it } from "vitest";
import { datesCoveredBySync, datesSafeToReconcile, staleActionFactsForDailySnapshot, staleAdIdsForDailySnapshot, syncRangeWithRollingWindow } from "../../supabase/functions/_shared/metaInsightReconciliation";

describe("Meta daily fact reconciliation", () => {
  it("builds a civil inclusive range that includes the selected period and three trailing days", () => {
    expect(syncRangeWithRollingWindow("2026-09-01", "2026-09-30", "2026-10-09")).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-10-09",
      daysCovered: datesCoveredBySync("2026-09-01", "2026-10-09"),
    });
    expect(datesCoveredBySync("2026-10-07", "2026-10-09")).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("does not add host-timezone drift or invalid dates to recorded coverage", () => {
    expect(datesCoveredBySync("invalid", "2026-10-09")).toEqual([]);
    expect(syncRangeWithRollingWindow("2026-10-10", "2026-10-12", "2026-10-09")).toMatchObject({
      startDate: "2026-10-06",
      endDate: "2026-10-09",
      daysCovered: ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"],
    });
  });

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

  it("removes stale action aliases only for ad/day snapshots included in a complete response", () => {
    expect(staleActionFactsForDailySnapshot(
      [
        { ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.lead" },
        { ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.lead_grouped" },
        { ad_id: "ad-2", date: "2026-10-03", action_type: "link_click" },
      ],
      [{ ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.lead_grouped" }],
      [{ ad_id: "ad-1", date: "2026-10-03" }],
    )).toEqual([{ ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.lead" }]);
  });

  it("clears old action rows when a returned ad/day now has no actions", () => {
    expect(staleActionFactsForDailySnapshot(
      [{ ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.messaging_conversation_started_7d" }],
      [],
      [{ ad_id: "ad-1", date: "2026-10-03" }],
    )).toHaveLength(1);
  });

  it("preserves action rows for ad/day pairs omitted from the response", () => {
    expect(staleActionFactsForDailySnapshot(
      [{ ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.lead" }],
      [],
      [{ ad_id: "ad-2", date: "2026-10-03" }],
    )).toEqual([]);
  });
});
