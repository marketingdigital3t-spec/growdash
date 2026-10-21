import { describe, expect, it } from "vitest";
import { mergeCanonicalExpertSales } from "./expertRevenueSales";

describe("mergeCanonicalExpertSales", () => {
  it("materializa um negócio RD ganho antes da linha financeira chegar", () => {
    const rows = mergeCanonicalExpertSales([], [{
      id: "local-1",
      rd_deal_id: "deal-1",
      rd_connection_id: "connection-1",
      ad_account_id: "account-1",
      rd_funnel_id: "funnel-1",
      rd_stage_name: "Venda realizada",
      rd_stage_id: null,
      rd_stage_order: null,
      stage_bucket: "client",
      win: true,
      lost_reason: null,
      amount_total: 17000,
      amount_total_effective: 17000,
      closed_at: "2026-10-20T12:00:00-03:00",
      stage_updated_at: null,
      lead_created_at: "2026-10-01T12:00:00-03:00",
      contact_name: "Cliente",
    } as any]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rd_deal_id: "deal-1", net_revenue: 17000, status: "confirmed" });
  });
});
