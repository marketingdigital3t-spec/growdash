import { describe, expect, it } from "vitest";
import { isCivilDate, parseCivilDateRange } from "./civilDateRange";

describe("civil Meta date ranges", () => {
  it("keeps one selected calendar date unchanged", () => {
    expect(parseCivilDateRange("2026-10-04", "2026-10-04")).toEqual({ startDate: "2026-10-04", endDate: "2026-10-04" });
  });

  it("accepts inclusive ranges across month boundaries", () => {
    expect(parseCivilDateRange("2026-09-30", "2026-10-02")).toEqual({ startDate: "2026-09-30", endDate: "2026-10-02" });
  });

  it("rejects impossible dates and reversed ranges", () => {
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(() => parseCivilDateRange("2026-10-05", "2026-10-04")).toThrow("posterior");
  });
});
