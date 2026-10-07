import { describe, expect, it } from "vitest";
import { normalizeCustomDateRange, resolvePreset } from "./useDateFilter";
import { businessDateKey } from "@/lib/businessDate";

describe("date filter maximum history", () => {
  it("uses the same Graph API lookback for the maximum preset", () => {
    const now = new Date("2026-10-05T12:00:00-03:00");
    const range = resolvePreset("max", { from: now, to: now }, now);
    expect(range.startDate).toEqual(new Date("2023-10-05T00:00:00-03:00"));
  });

  it("advances the Hoje preset when São Paulo crosses midnight even if the browser is on UTC", () => {
    const yesterday = resolvePreset("today", { from: new Date(2026, 9, 1), to: new Date(2026, 9, 1) }, new Date("2026-10-04T02:59:59.000Z"));
    const today = resolvePreset("today", { from: new Date(2026, 9, 1), to: new Date(2026, 9, 1) }, new Date("2026-10-04T03:00:01.000Z"));

    expect(businessDateKey(yesterday.startDate)).toBe("2026-10-03");
    expect(businessDateKey(today.startDate)).toBe("2026-10-04");
  });

  it("uses the seven previous complete São Paulo days for Últimos 7 dias", () => {
    const range = resolvePreset("7days", { from: new Date("2026-10-01"), to: new Date("2026-10-01") }, new Date("2026-10-06T12:00:00-03:00"));
    expect(businessDateKey(range.startDate)).toBe("2026-09-29");
    expect(businessDateKey(range.endDate)).toBe("2026-10-05");
  });

  it("keeps both custom range boundaries inclusive", () => {
    const range = resolvePreset("custom", {
      from: new Date(2026, 7, 10, 15, 30),
      to: new Date(2026, 7, 12, 9, 15),
    });
    expect(range.startDate).toEqual(new Date(2026, 7, 10, 0, 0, 0, 0));
    expect(range.endDate).toEqual(new Date(2026, 7, 12, 23, 59, 59, 999));
  });

  it("preserves the selected November 2026 calendar year", () => {
    const range = resolvePreset("custom", {
      from: new Date(2026, 10, 1, 12, 0),
      to: new Date(2026, 10, 30, 12, 0),
    });
    expect(businessDateKey(range.startDate)).toBe("2026-11-01");
    expect(businessDateKey(range.endDate)).toBe("2026-11-30");
  });

  it("falls back safely when a persisted range contains an invalid date", () => {
    const range = resolvePreset("custom", {
      from: new Date("invalid"),
      to: new Date(2026, 7, 12),
    });

    expect(Number.isNaN(range.startDate.getTime())).toBe(false);
    expect(Number.isNaN(range.endDate.getTime())).toBe(false);
    expect(range.startDate.getTime()).toBeLessThanOrEqual(range.endDate.getTime());
  });

  it("normalizes an inverted stored range", () => {
    const range = normalizeCustomDateRange({
      from: new Date(2026, 7, 12),
      to: new Date(2026, 7, 10),
    });

    expect(range.from).toEqual(new Date(2026, 7, 10));
    expect(range.to).toEqual(new Date(2026, 7, 12));
  });
});
