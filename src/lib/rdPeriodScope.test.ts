import { describe, expect, it } from "vitest";
import { mergeRDPeriodDeals } from "./rdPeriodScope";

const deal = (overrides: Record<string, unknown> = {}) => ({
  id: "local-1",
  rd_deal_id: "deal-1",
  rd_connection_id: "connection-1",
  ad_account_id: "account-1",
  updated_at: "2026-10-10T12:00:00Z",
  ...overrides,
});

describe("RD period deal scope", () => {
  it("unites period leads with sales closed in the period without collapsing connections", () => {
    const result = mergeRDPeriodDeals(
      [deal({ id: "open", rd_deal_id: "open-deal" }), deal({ id: "connection-a", rd_deal_id: "same-id", rd_connection_id: "connection-a" })],
      [deal({ id: "won", rd_deal_id: "won-deal" }), deal({ id: "connection-b", rd_deal_id: "same-id", rd_connection_id: "connection-b" })],
    );

    expect(result.map((row) => `${row.rd_connection_id}:${row.rd_deal_id}`)).toEqual([
      "connection-1:open-deal",
      "connection-a:same-id",
      "connection-1:won-deal",
      "connection-b:same-id",
    ]);
  });

  it("prefers the closed-period snapshot for a duplicate deal", () => {
    const result = mergeRDPeriodDeals(
      [deal({ id: "lead-snapshot", rd_deal_id: "deal-1", stage_updated_at: "2026-10-09T12:00:00Z" })],
      [deal({ id: "won-snapshot", rd_deal_id: "deal-1", closed_at: "2026-10-10T12:00:00Z" })],
    );

    expect(result).toEqual([expect.objectContaining({ id: "won-snapshot", closed_at: "2026-10-10T12:00:00Z" })]);
  });
});
