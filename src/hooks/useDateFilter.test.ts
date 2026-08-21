import { describe, expect, it } from "vitest";
import { normalizeCustomDateRange, resolvePreset } from "./useDateFilter";

describe("date filter maximum history", () => {
  it("does not turn the maximum preset into a rolling one-year window", () => {
    const range = resolvePreset("max", { from: new Date(2026, 0, 1), to: new Date(2026, 7, 13) });
    expect(range.startDate).toEqual(new Date(2000, 0, 1));
  });

  it("keeps both custom range boundaries inclusive", () => {
    const range = resolvePreset("custom", {
      from: new Date(2026, 7, 10, 15, 30),
      to: new Date(2026, 7, 12, 9, 15),
    });
    expect(range.startDate).toEqual(new Date(2026, 7, 10, 0, 0, 0, 0));
    expect(range.endDate).toEqual(new Date(2026, 7, 12, 23, 59, 59, 999));
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
