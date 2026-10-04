import { describe, expect, it } from "vitest";
import { resolveMetaLookbackDateRange } from "../../supabase/functions/_shared/metaLookbackWindow";

describe("Meta conversion lookback window", () => {
  it("revisits seven complete prior civil days plus today in Sao Paulo", () => {
    expect(resolveMetaLookbackDateRange(
      new Date("2026-10-04T02:30:00.000Z"),
      "America/Sao_Paulo",
      "account_default",
    )).toEqual({
      startDate: "2026-09-26",
      endDate: "2026-10-03",
      lookbackDays: 7,
      timezone: "America/Sao_Paulo",
    });
  });

  it("uses the maximum explicit click/view attribution window", () => {
    expect(resolveMetaLookbackDateRange(
      new Date("2026-10-04T17:00:00.000Z"),
      "America/Sao_Paulo",
      "1d_view,28d_click",
    )).toMatchObject({ startDate: "2026-09-06", endDate: "2026-10-04", lookbackDays: 28 });
  });

  it("resolves today in the account timezone rather than the worker timezone", () => {
    expect(resolveMetaLookbackDateRange(
      new Date("2026-10-04T02:30:00.000Z"),
      "Pacific/Kiritimati",
      "7d_click",
    )).toMatchObject({ startDate: "2026-09-27", endDate: "2026-10-04", timezone: "Pacific/Kiritimati" });
    expect(resolveMetaLookbackDateRange(
      new Date("2026-10-04T02:30:00.000Z"),
      "America/Los_Angeles",
      "7d_click",
    ).endDate).toBe("2026-10-03");
  });

  it("handles month and year boundaries with inclusive civil dates", () => {
    expect(resolveMetaLookbackDateRange(
      new Date("2026-01-02T17:00:00.000Z"),
      "America/Sao_Paulo",
      "2d_click",
    )).toMatchObject({ startDate: "2025-12-31", endDate: "2026-01-02" });
  });
});
