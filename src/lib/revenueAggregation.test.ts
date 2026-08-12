import { describe, expect, it } from "vitest";
import { aggregateRevenueSources } from "./revenueAggregation";
import type { RevenueSale, RDRevenueDeal } from "./revenueAggregation";

const sale = (overrides: Partial<Sale> = {}) => ({
  id: "sale-1", user_id: "user-1", product_id: null, ad_account_id: "account-1", campaign_ids: [], sale_date: "2026-08-01", gross_revenue: 100, net_revenue: 90, tax_amount: 10, refund_amount: 0, chargeback_amount: 0, payment_method: "pix", status: "confirmed", quantity: 1, notes: null, lead_state: null, lead_formation: null, contact_name: null, contact_phone: null, contact_email: null, lead_city: null, lead_entry_date: null, adset_id: null, ad_id: null, rd_deal_id: null, rd_campaign_name: null, rd_product_name: null, rd_funnel_id: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, manual_platform: null, matched_campaign_id: null, match_method: null, manual_campaign_id: null, manual_adset_id: null, manual_ad_id: null, manual_override: false, workspace_id: null, business_unit_id: null, source_provider: null, source_record_id: null, source_closed_at: null, attribution_confidence: null, attribution_reason: null, created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-01T12:00:00Z", ...overrides,
}) as RevenueSale;
const deal = (overrides: Partial<RDRevenueDeal> = {}) => ({ rd_deal_id: "rd-1", rd_stage_name: "Vendas realizadas", win: true, amount_total: 1500, ...overrides }) as RDRevenueDeal;

describe("aggregateRevenueSources", () => {
  it("inclui nove negócios ganhos do RD que ainda não viraram vendas internas", () => {
    const result = aggregateRevenueSources([], Array.from({ length: 9 }, (_, index) => deal({ rd_deal_id: `rd-${index}`, amount_total: 500 })));
    expect(result.totalNet).toBe(4500);
    expect(result.confirmedSalesCount).toBe(9);
  });
  it("não duplica uma negociação RD já representada em venda confirmada", () => {
    const result = aggregateRevenueSources([sale({ rd_deal_id: "rd-1" })], [deal(), deal({ rd_deal_id: "rd-2", amount_total: 200 })]);
    expect(result.totalNet).toBe(290);
    expect(result.totalTax).toBe(10);
    expect(result.confirmedSalesCount).toBe(2);
  });
  it("ignora negócios perdidos, abertos, sem valor e repetidos no RD", () => {
    const result = aggregateRevenueSources([], [deal({ win: false, rd_stage_name: "Perdido" }), deal({ win: false, rd_stage_name: "Em negociação" }), deal({ rd_deal_id: "zero", amount_total: 0 }), deal({ rd_deal_id: "rd-1", amount_total: 1500 })]);
    expect(result.totalNet).toBe(1500);
    expect(result.confirmedSalesCount).toBe(1);
  });
});
