import { describe, expect, it } from "vitest";
import type { Sale } from "@/hooks/useSales";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { filterCanonicalFunnelSales, reconcileFunnelRevenue } from "./funnelRevenue";

const base = {
  totalLeads: 10, qualifiedLeads: 4, conversions: 99, lostDeals: 1,
  conversionRate: 990, qualificationRate: 40, avgDaysToConvert: 2,
  avgTicket: 999, revenue: 99999, stages: [], stageConversion: [],
  evolution: [{ date: "2026-07-21", leads: 2, opportunities: 1, conversions: 99 }],
  agingBuckets: { gt3: 0, gt7: 0, gt15: 0 }, bottleneck: null,
  sourceBreakdown: [{ source: "meta", leads: 10, sales: 99, conversionRate: 990, revenue: 99999 }],
  lostReasons: [], stateBreakdown: [{ state: "SP", leads: 10, conversions: 99, conversionRate: 990 }],
  weekdayBreakdown: Array.from({ length: 7 }, (_, weekday) => ({ weekday, label: String(weekday), leads: weekday === 2 ? 2 : 0, conversions: 99, conversionRate: 0, revenue: 999 })),
  hourBreakdown: (["Manhã", "Tarde", "Noite", "Madrugada"] as const).map((period) => ({ period, leads: 0, conversions: 99, conversionRate: 0, hours: [] })),
  ownerBreakdown: [],
} satisfies FunnelAnalytics;

const makeSale = (overrides: Partial<Sale> = {}) => ({
  id: "sale-1", user_id: "user-1", product_id: null, ad_account_id: "account-1", campaign_ids: [],
  sale_date: "2026-07-21", gross_revenue: 200, net_revenue: 180, tax_amount: 20, refund_amount: 0,
  chargeback_amount: 0, payment_method: "outros", status: "confirmed", quantity: 1, notes: null,
  lead_state: "SP", lead_formation: null, contact_name: null, contact_phone: null, contact_email: null,
  lead_city: null, lead_entry_date: null, adset_id: null, ad_id: null, rd_deal_id: "deal-1",
  rd_campaign_name: "Campanha A", rd_product_name: "Produto A", rd_funnel_id: "funnel-1",
  utm_source: "meta", utm_medium: null, utm_campaign: "Campanha A", utm_term: null, utm_content: null,
  manual_platform: null, matched_campaign_id: null, match_method: null, manual_campaign_id: null,
  manual_adset_id: null, manual_ad_id: null, manual_override: false, workspace_id: null,
  business_unit_id: null, source_provider: "rd_station", source_record_id: "deal-1", source_closed_at: null,
  attribution_confidence: 0.95, attribution_reason: "rd_utm_campaign_name_exact",
  created_at: "2026-07-21T12:00:00Z", updated_at: "2026-07-21T12:00:00Z", ...overrides,
}) as Sale;

describe("canonical funnel revenue", () => {
  it("substitui valores paralelos pela venda confirmada canônica", () => {
    const result = reconcileFunnelRevenue(base, [makeSale()]);
    expect(result.conversions).toBe(1);
    expect(result.revenue).toBe(180);
    expect(result.avgTicket).toBe(180);
    expect(result.sourceBreakdown[0]).toMatchObject({ source: "meta", sales: 1, revenue: 180 });
  });

  it("ignora pendências e não mistura funis", () => {
    const sales = [makeSale(), makeSale({ id: "pending", status: "pending" }), makeSale({ id: "other", rd_funnel_id: "funnel-2" })];
    expect(filterCanonicalFunnelSales(sales, { funnelId: "funnel-1" })).toHaveLength(1);
  });

  it("usa o negócio RD como fallback quando a venda ainda não tem rd_funnel_id", () => {
    const sale = makeSale({ rd_funnel_id: null });
    expect(filterCanonicalFunnelSales([sale], {
      funnelId: "funnel-1",
      scopedDealIds: new Set(["deal-1"]),
    })).toHaveLength(1);
    expect(filterCanonicalFunnelSales([sale], {
      funnelId: "funnel-1",
      scopedDealIds: new Set(["other-deal"]),
    })).toHaveLength(0);
  });
});
