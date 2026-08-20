import { describe, expect, it } from "vitest";
import { resolvePreset } from "./useDateFilter";

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
});
