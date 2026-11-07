import { describe, expect, it } from "vitest";
import { filterDealsByAdvancedCriteria, type CRMAdvancedFilterState } from "./crmAdvancedFilters";

const sampleDeals = [
  {
    id: "1",
    rd_deal_id: "d1",
    contact_name: "Wellington Couto",
    lead_created_at: "2026-11-06T10:00:00-03:00",
    stage_updated_at: "2026-11-06T11:00:00-03:00",
    closed_at: null,
    amount_total: 6000,
    campaign: "Campanha Harmonizacao",
    utm_campaign: null,
    source: "Meta Ads",
    utm_source: null,
    rd_product_name: "50 ml",
    deal_owner_name: "Janaina Miranda",
  },
  {
    id: "2",
    rd_deal_id: "d2",
    contact_name: "Cleiton França",
    lead_created_at: "2026-11-06T14:30:00-03:00",
    stage_updated_at: "2026-11-06T14:30:00-03:00",
    closed_at: null,
    amount_total: 12000,
    campaign: null,
    utm_campaign: "Google_Search",
    source: "Claude Opus 5",
    utm_source: "Claude Opus 5",
    rd_product_name: "100 ml",
    deal_owner_name: "Janaina Miranda",
  },
  {
    id: "3",
    rd_deal_id: "d3",
    contact_name: "Cliente Antigo",
    lead_created_at: "2026-10-15T09:00:00-03:00",
    stage_updated_at: "2026-11-06T16:00:00-03:00",
    closed_at: "2026-11-06T16:00:00-03:00",
    amount_total: 6000,
    campaign: "Campanha Harmonizacao",
    utm_campaign: null,
    source: "Meta Ads",
    utm_source: null,
    rd_product_name: "50 ml",
    deal_owner_name: "Outro Dono",
  },
  {
    id: "4",
    rd_deal_id: "d4",
    contact_name: "Cliente Historico Fechado",
    lead_created_at: "2026-09-01T10:00:00-03:00",
    stage_updated_at: "2026-09-10T10:00:00-03:00",
    closed_at: "2026-09-10T10:00:00-03:00",
    amount_total: 2000,
    campaign: "Antiga",
    utm_campaign: null,
    source: "Organico",
    utm_source: null,
    rd_product_name: null,
    deal_owner_name: null,
  },
];

describe("CRM Advanced Filters — Espelho do RD Station", () => {
  it("filters strictly by creation date range (06/11/2026)", () => {
    const filters: CRMAdvancedFilterState = {
      createdAt: { start: "2026-11-06", end: "2026-11-06" },
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d1", "d2"]);
  });

  it("filters strictly by closed date range (06/11/2026)", () => {
    const filters: CRMAdvancedFilterState = {
      closedAt: { start: "2026-11-06", end: "2026-11-06" },
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d3"]);
  });

  it("filters by last contact (stage_updated_at)", () => {
    const filters: CRMAdvancedFilterState = {
      lastContactAt: { start: "2026-11-06", end: "2026-11-06" },
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d1", "d2", "d3"]);
  });

  it("filters by value range (from R$ 5.000 to R$ 10.000)", () => {
    const filters: CRMAdvancedFilterState = {
      minValue: 5000,
      maxValue: 10000,
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d1", "d3"]);
  });

  it("filters by source (Meta Ads)", () => {
    const filters: CRMAdvancedFilterState = {
      source: "Meta Ads",
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d1", "d3"]);
  });

  it("filters by product", () => {
    const filters: CRMAdvancedFilterState = {
      product: "100 ml",
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d2"]);
  });

  it("combines creation date and value range", () => {
    const filters: CRMAdvancedFilterState = {
      createdAt: { start: "2026-11-06", end: "2026-11-06" },
      minValue: 10000,
    };
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, filters);
    expect(result.map((d) => d.rd_deal_id)).toEqual(["d2"]);
  });

  it("returns all deals when no filters are set", () => {
    const result = filterDealsByAdvancedCriteria(sampleDeals as any, {});
    expect(result.length).toBe(4);
  });
});
