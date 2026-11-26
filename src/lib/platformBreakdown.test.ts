import { describe, expect, it } from "vitest";
import { buildPlatformBreakdown } from "./platformBreakdown";

describe("buildPlatformBreakdown", () => {
  it("inclui receita e vendas de negócios RD ganhos mesmo sem linha em sales", () => {
    const rows = buildPlatformBreakdown({
      metaLeads: 0,
      rdDeals: [{
        id: "local-1",
        rd_deal_id: "deal-1",
        rd_connection_id: "connection-1",
        ad_account_id: null,
        rd_funnel_id: "funnel-1",
        rd_stage_name: "Venda realizada",
        win: true,
        amount_total: 17000,
        amount_total_effective: 17000,
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
      } as any],
      sales: [],
      platformRules: [],
    });

    expect(rows.reduce((sum, row) => sum + row.sales, 0)).toBe(1);
    expect(rows.reduce((sum, row) => sum + row.revenue, 0)).toBe(17000);
  });
});
