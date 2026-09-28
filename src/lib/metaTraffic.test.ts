import { describe, expect, it } from "vitest";
import { aggregateMetaTrafficMetrics } from "./metaTraffic";

describe("Meta traffic metrics", () => {
  it("agrega mídia e ações sem somar aliases duplicados", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "act-1", spend: 100, impressions: 1_000, reach: 800, clicks: 100 },
      { ad_id: "ad-2", ad_account_id: "act-1", spend: 50, impressions: 500, reach: 400, clicks: 25 },
    ], {
      metaLeadActions: { forms: 8, site: 2, conversations: 3, total: 13 },
      totalsByAd: {
        "ad-1": { omni_purchase: 2, "offsite_conversion.fb_pixel_purchase": 2 },
        "ad-2": { purchase: 1 },
      },
      valueTotalsByAd: {
        "ad-1": { omni_purchase: 300, "offsite_conversion.fb_pixel_purchase": 300 },
        "ad-2": { purchase: 100 },
      },
    }, "2026-09-28T12:00:00.000Z", [], Date.parse("2026-09-28T12:04:00.000Z"));

    expect(result.spend).toBe(150);
    expect(result.impressions).toBe(1_500);
    expect(result.clicks).toBe(125);
    expect(result.leads).toBe(13);
    expect(result.purchases).toBe(3);
    expect(result.purchaseValue).toBe(400);
    expect(result.ctr).toBeCloseTo(8.3333, 3);
    expect(result.cpc).toBeCloseTo(1.2, 3);
    expect(result.cpm).toBe(100);
    expect(result.cpl).toBeCloseTo(150 / 13, 3);
    expect(result.roas).toBeCloseTo(400 / 150, 3);
    expect(result.status).toBe("fresh");
    expect(result.coveredAccounts).toEqual(["act-1"]);
  });

  it("marca dado ausente como stale e falha de sincronização como error", () => {
    expect(aggregateMetaTrafficMetrics([], undefined, null).status).toBe("stale");
    expect(aggregateMetaTrafficMetrics([], undefined, "2026-09-28T12:00:00.000Z", ["rate limit"], Date.parse("2026-09-28T12:01:00.000Z")).status).toBe("error");
  });

  it("mantém métricas zeradas quando não há impressões, cliques ou leads", () => {
    const result = aggregateMetaTrafficMetrics([], { metaLeadActions: { forms: 0, site: 0, conversations: 0, total: 0 } }, "2026-09-28T12:00:00.000Z", [], Date.parse("2026-09-28T12:00:10.000Z"));
    expect(result.ctr).toBe(0);
    expect(result.cpc).toBe(0);
    expect(result.cpm).toBe(0);
    expect(result.cpl).toBe(0);
    expect(result.roas).toBe(0);
    expect(result.rowCount).toBe(0);
  });
});
