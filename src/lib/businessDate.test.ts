import { describe, expect, it } from "vitest";
import { businessDateKey, parseBusinessDate } from "./businessDate";

describe("business calendar dates", () => {
  it("round-trips Hoje in São Paulo without a UTC day shift", () => {
    expect(businessDateKey(parseBusinessDate("2026-10-01"))).toBe("2026-10-01");
  });

  it("keeps a single inclusive calendar day stable at midnight", () => {
    const parsed = parseBusinessDate("2026-10-31");
    expect(businessDateKey(parsed)).toBe("2026-10-31");
  });
});
