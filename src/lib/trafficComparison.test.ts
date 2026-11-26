import { describe, expect, it } from "vitest";
import { aggregateTrafficComparison, percentDelta, resolveComparisonPeriod } from "./trafficComparison";

describe("traffic comparison", () => {
  it("creates an adjacent period with the same number of calendar days", () => {
    const result = resolveComparisonPeriod(new Date(2026, 9, 1), new Date(2026, 9, 7));
    expect(result.previousStart).toEqual(new Date(2026, 8, 24));
    expect(result.previousEnd).toEqual(new Date(2026, 8, 30));
  });

  it("aggregates canonical media, RD and confirmed sales", () => {
    const result = aggregateTrafficComparison({
      insights: [{ spend: 100, impressions: 1000, reach: 800, clicks: 100, form_leads: 4, site_leads: 1, conversations: 2 }],
      deals: [{ stage_bucket: "opportunity", win: false }, { stage_bucket: "won", win: true }],
      sales: [{ status: "confirmed", quantity: 2, net_revenue: 500 }, { status: "pending", quantity: 1, net_revenue: 300 }],
    });
    expect(result).toMatchObject({ spend: 100, leads: 7, deals: 2, opportunities: 1, sales: 2, revenue: 500 });
  });

  it("does not invent a delta when there is no previous base", () => {
    expect(percentDelta(10, 0)).toBeNull();
    expect(percentDelta(120, 100)).toBe(20);
  });
});
