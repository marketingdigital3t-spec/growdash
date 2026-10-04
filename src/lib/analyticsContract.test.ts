import { describe, expect, it } from "vitest";
import { metaMetricContract, metricValue, rdMetricContract, salesMetricContract } from "./analyticsContract";

describe("analytics contract", () => {
  it("keeps unavailable metrics null instead of inventing zero", () => {
    expect(metricValue(0, false, "meta", "Aguardando sincronização")).toEqual({ value: null, available: false, source: "meta", reason: "Aguardando sincronização" });
  });

  it("exposes Meta availability and canonical lead sources", () => {
    const contract = metaMetricContract({
      spend: 100, dailySpend: 100, impressions: 1000, reach: 500, frequency: 2, clicks: 50, leads: 7, totalLeads: 7,
      results: 7, resultValue: 7, formLeads: 3, siteLeads: 2, conversations: 2, checkout: 0, purchases: 1, purchaseValue: 300,
      ctr: 5, cpc: 2, cpm: 100, cpl: 100 / 7, roas: 3, resultBreakdown: [], breakdowns: { age: [], gender: [], region: [], country: [], platform: [], placement: [], device: [] },
      attributionWindow: "7d_click", timezone: "America/Sao_Paulo", source: "meta", syncedAt: new Date().toISOString(), freshnessSeconds: 10,
      status: "fresh", available: true, unavailableReason: null, coveredAccounts: ["a"], rowCount: 1, errors: [], metricAvailability: { leads: { available: true } }, leadBreakdownByAccount: {}, leadBreakdownByAd: {},
    });
    expect(contract.totalLeads.value).toBe(7);
    expect(contract.totalLeads.source).toBe("meta");
    expect(contract.reach.directional).toBe(true);
  });

  it("does not promote stale rows to confirmed Meta metrics without scope coverage", () => {
    const contract = metaMetricContract({
      spend: 999, dailySpend: 999, impressions: 1000, reach: 500, frequency: 2, clicks: 50, leads: 7, totalLeads: 7,
      results: 7, resultValue: 7, formLeads: 3, siteLeads: 2, conversations: 2, checkout: 0, purchases: 1, purchaseValue: 300,
      ctr: 5, cpc: 2, cpm: 100, cpl: 999 / 7, roas: 3, resultBreakdown: [], breakdowns: { age: [], gender: [], region: [], country: [], platform: [], placement: [], device: [] },
      attributionWindow: "7d_click", timezone: "America/Sao_Paulo", source: "meta", syncedAt: new Date().toISOString(), freshnessSeconds: 10,
      status: "partial", available: false, unavailableReason: "Cobertura não confirmada", coveredAccounts: ["a"], rowCount: 1, errors: [], metricAvailability: { leads: { available: false } }, leadBreakdownByAccount: {}, leadBreakdownByAd: {},
    });
    expect(contract.spend).toMatchObject({ value: null, available: false, reason: "Cobertura não confirmada" });
    expect(contract.impressions.available).toBe(false);
    expect(contract.totalLeads).toMatchObject({ value: null, available: false });
    expect(contract.cpl.available).toBe(false);
  });

  it("uses RD won deals and confirmed sales as separate contracts", () => {
    const deals = [{ rd_deal_id: "d1", rd_connection_id: "c1", win: true, rd_stage_name: "Venda", closed_at: "2026-10-01T12:00:00-03:00", stage_updated_at: null, lead_created_at: "2026-09-01T12:00:00-03:00", amount_total: 100, ad_account_id: null, rd_funnel_id: "f", rd_stage_id: null, rd_stage_order: null, deal_owner_name: null, rd_product_name: null, stage_bucket: "client" as const, lost_reason: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, utm_id: null, lead_state: null, lead_city: null }];
    const rd = rdMetricContract({ allDeals: deals, createdInPeriod: deals, wonInPeriod: deals, opportunities: 0, available: true });
    expect(rd.wonDeals.value).toBe(1);
    const sales = salesMetricContract([{ id: "s1", rd_deal_id: "d1", status: "confirmed", quantity: 1, gross_revenue: 100, net_revenue: 90, source_provider: "rd_station", source_record_id: "d1", updated_at: "2026-10-01", created_at: "2026-10-01" } as any], true);
    expect(sales.confirmedSales.value).toBe(1);
    expect(sales.netRevenue.value).toBe(90);
    expect(sales.cashReceived.available).toBe(false);
  });
});
