import { describe, expect, it } from "vitest";
import { filterCanonicalFunnelSales } from "./funnelRevenue";

describe("funnel revenue multi scope", () => {
  it("aggregates only the selected funnel ids", () => {
    const sales = [
      { status: "confirmed", rd_funnel_id: "one" },
      { status: "confirmed", rd_funnel_id: "two" },
      { status: "confirmed", rd_funnel_id: "outside" },
    ] as any[];
    expect(filterCanonicalFunnelSales(sales as any, { funnelIds: ["one", "two"] })).toHaveLength(2);
  });
});
