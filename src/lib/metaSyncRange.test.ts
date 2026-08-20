import { describe, expect, it } from "vitest";
import { getMetaSyncRange } from "./metaSyncRange";

describe("getMetaSyncRange", () => {
  it("limita a reconciliação manual aos últimos 36 meses", () => {
    expect(getMetaSyncRange(new Date("2026-08-20T12:00:00-03:00"))).toEqual({
      startDate: "2023-08-20",
      endDate: "2026-08-20",
    });
  });
});
