import { describe, expect, it } from "vitest";
import { businessCalendarDate, businessDateKey, parseBusinessDate } from "./businessDate";
import { format } from "date-fns";
import { saoPauloDayBounds } from "./canonicalMetrics";
import { resolvePreset } from "@/hooks/useDateFilter";

describe("business calendar dates", () => {
  it("round-trips Hoje in São Paulo without a UTC day shift", () => {
    expect(businessDateKey(parseBusinessDate("2026-10-01"))).toBe("2026-10-01");
  });

  it("keeps a single inclusive calendar day stable at midnight", () => {
    const parsed = parseBusinessDate("2026-10-31");
    expect(businessDateKey(parsed)).toBe("2026-10-31");
  });

  it("renders the São Paulo business date on the same calendar day in a browser west of UTC", () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const selected = parseBusinessDate("2026-10-04");
      expect(format(selected, "yyyy-MM-dd")).toBe("2026-10-03");
      expect(format(businessCalendarDate(selected), "yyyy-MM-dd")).toBe("2026-10-04");
      expect(businessDateKey(selected)).toBe("2026-10-04");
      const today = resolvePreset("today", { from: selected, to: selected }, new Date("2026-10-04T08:00:00.000Z"));
      const bounds = saoPauloDayBounds(today.startDate, today.endDate);
      expect(businessDateKey(today.startDate)).toBe("2026-10-04");
      expect(bounds.start.toISOString()).toBe("2026-10-04T03:00:00.000Z");
      expect(bounds.end.toISOString()).toBe("2026-10-05T02:59:59.999Z");
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});
