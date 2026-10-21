import { describe, expect, it } from "vitest";
import type { RDRevenueDeal } from "./revenueAggregation";
import { aggregateMonthlyGoalRevenue, businessMonthRange, selectMonthlyGoalDeals } from "./monthlyGoalRevenue";

const monthStart = new Date("2026-10-01T12:00:00-03:00");
const monthEnd = new Date("2026-10-31T12:00:00-03:00");

const deal = (overrides: Partial<RDRevenueDeal> & Record<string, unknown> = {}) => ({
  rd_deal_id: "deal-1",
  rd_connection_id: "connection-1",
  ad_account_id: "account-a",
  rd_funnel_id: "funnel-a",
  rd_stage_name: "Venda realizada",
  win: true,
  amount_total: 1_000,
  closed_at: "2026-10-15T12:00:00-03:00",
  stage_updated_at: "2026-10-15T12:00:00-03:00",
  lead_created_at: "2026-10-01T12:00:00-03:00",
  ...overrides,
}) as RDRevenueDeal & Record<string, unknown>;

const scope = (overrides: Partial<Parameters<typeof aggregateMonthlyGoalRevenue>[1]> = {}) => ({
  startDate: monthStart,
  endDate: monthEnd,
  visibleAccountIds: new Set(["account-a", "account-b"]),
  selectedAccountId: "all",
  funnelIds: ["funnel-a", "funnel-b"],
  ...overrides,
});

describe("monthly goal revenue", () => {
  it("builds the month using the Sao Paulo civil date", () => {
    const range = businessMonthRange(new Date("2026-10-01T01:00:00.000Z"));
    expect(range.startDate.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2026-10-01T02:59:59.999Z");
  });

  it("uses the closing date, not the creation date, for the month", () => {
    expect(aggregateMonthlyGoalRevenue([
      deal({ lead_created_at: "2026-10-01T12:00:00-03:00", closed_at: "2026-11-01T12:00:00-03:00" }),
      deal({ rd_deal_id: "deal-2", lead_created_at: "2026-09-01T12:00:00-03:00", closed_at: "2026-10-20T12:00:00-03:00" }),
    ], scope())).toBe(1_000);
  });

  it("falls back to stage_updated_at only when closed_at is absent", () => {
    expect(aggregateMonthlyGoalRevenue([
      deal({ closed_at: null, stage_updated_at: "2026-10-10T12:00:00-03:00" }),
      deal({ rd_deal_id: "deal-2", closed_at: null, stage_updated_at: "2026-11-10T12:00:00-03:00" }),
    ], scope())).toBe(1_000);
  });

  it("keeps a selected account isolated", () => {
    expect(aggregateMonthlyGoalRevenue([
      deal({ amount_total: 700 }),
      deal({ rd_deal_id: "deal-2", ad_account_id: "account-b", rd_funnel_id: "funnel-b", amount_total: 900 }),
    ], scope({ selectedAccountId: "account-a" }))).toBe(700);
  });

  it("sums only visible accounts and includes funnel-only RD deals", () => {
    const deals = [
      deal({ amount_total: 700 }),
      deal({ rd_deal_id: "deal-2", ad_account_id: "account-b", rd_funnel_id: "funnel-b", amount_total: 900 }),
      deal({ rd_deal_id: "deal-3", ad_account_id: "account-hidden", rd_funnel_id: "funnel-hidden", amount_total: 2_000 }),
      deal({ rd_deal_id: "deal-4", ad_account_id: null, rd_funnel_id: "funnel-a", amount_total: 300 }),
    ];
    expect(selectMonthlyGoalDeals(deals, scope()).map((row) => row.rd_deal_id)).toEqual(["deal-1", "deal-2", "deal-4"]);
    expect(aggregateMonthlyGoalRevenue(deals, scope())).toBe(1_900);
  });

  it("supports a multi-account selection narrower than the visible workspace", () => {
    expect(aggregateMonthlyGoalRevenue([
      deal({ amount_total: 700 }),
      deal({ rd_deal_id: "deal-2", ad_account_id: "account-b", rd_funnel_id: "funnel-b", amount_total: 900 }),
    ], scope({ visibleAccountIds: new Set(["account-a"]) }))).toBe(700);
  });

  it("uses the effective amount and deduplicates snapshots", () => {
    expect(aggregateMonthlyGoalRevenue([
      deal({ amount_total: 1_000, amount_total_effective: 1_500 }),
      deal({ amount_total: 9_999, amount_total_effective: 2_000 }),
    ], scope())).toBe(1_500);
  });
});
