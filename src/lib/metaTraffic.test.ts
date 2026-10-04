import { describe, expect, it } from "vitest";
import { aggregateMetaTrafficMetrics, resolveCanonicalMetaLeadBreakdown } from "./metaTraffic";

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
    const unavailable = aggregateMetaTrafficMetrics([], undefined, null);
    expect(unavailable.status).toBe("stale");
    expect(unavailable.available).toBe(false);
    expect(unavailable.unavailableReason).toContain("Nenhum snapshot");
    expect(unavailable.metricAvailability.leads.available).toBe(false);
    expect(aggregateMetaTrafficMetrics([], undefined, "2026-09-28T12:00:00.000Z", ["rate limit"], Date.parse("2026-09-28T12:01:00.000Z")).status).toBe("error");
  });

  it("mantém snapshot parcial explícito sem transformar a resposta em zero", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "acc-1", spend: 25, impressions: 100, clicks: 4 },
    ], { metaLeadActions: { forms: 2, site: 1, conversations: 0, total: 3 } }, "2026-09-30T12:00:00.000Z", ["conta acc-2: rate limit"], Date.parse("2026-09-30T12:01:00.000Z"));
    expect(result.status).toBe("partial");
    expect(result.spend).toBe(25);
    expect(result.totalLeads).toBe(3);
    expect(result.errors).toEqual(["conta acc-2: rate limit"]);
  });

  it("expõe o contrato de leads com zero legítimo e sem somar aliases", () => {
    expect(resolveCanonicalMetaLeadBreakdown({
      metaLeadActions: { forms: 0, site: 4, conversations: 2, total: 999 },
    })).toEqual({ forms: 0, site: 4, conversations: 2, total: 6 });
    expect(resolveCanonicalMetaLeadBreakdown({
      totalsByAd: {
        "ad-1": { omni_lead: 3, leadgen_grouped: 3, "offsite_conversion.fb_pixel_lead": 2, "onsite_conversion.messaging_conversation_started_7d": 1 },
      },
    })).toEqual({ forms: 3, site: 2, conversations: 1, total: 6 });
  });

  it("mantém métricas zeradas quando não há impressões, cliques ou leads", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "acc-1", spend: 0, impressions: 0, clicks: 0, reach: 0 },
    ], { actionsAvailable: true, metaLeadActions: { forms: 0, site: 0, conversations: 0, total: 0 } }, "2026-09-28T12:00:00.000Z", [], Date.parse("2026-09-28T12:00:10.000Z"));
    expect(result.ctr).toBe(0);
    expect(result.cpc).toBe(0);
    expect(result.cpm).toBe(0);
    expect(result.cpl).toBe(0);
    expect(result.roas).toBe(0);
    expect(result.rowCount).toBe(1);
    expect(result.metricAvailability.leads.available).toBe(true);
  });

  it("não chama falta de ações sincronizadas de zero legítimo", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "acc-1", spend: 25, impressions: 100, clicks: 5 },
    ], { actionsAvailable: false, metaLeadActions: { forms: 0, site: 0, conversations: 0, total: 0 } }, "2026-09-28T12:00:00.000Z");
    expect(result.available).toBe(true);
    expect(result.metricAvailability.spend.available).toBe(true);
    expect(result.metricAvailability.leads.available).toBe(false);
  });

  it("expõe resultados por objetivo sem repetir a mesma ação em cada dia", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "acc-1", campaign_id: "camp-1", campaign_name: "Leads", campaign_objective: "OUTCOME_LEADS", spend: 10, impressions: 100, reach: 80, clicks: 5 },
      { ad_id: "ad-1", ad_account_id: "acc-1", campaign_id: "camp-1", campaign_name: "Leads", campaign_objective: "OUTCOME_LEADS", spend: 12, impressions: 120, reach: 90, clicks: 6 },
    ], {
      totalsByAd: { "ad-1": { onsite_conversion_lead_grouped: 3, "onsite_conversion.lead_grouped": 3 } },
      metaLeadActions: { forms: 3, site: 0, conversations: 0, total: 3 },
    }, "2026-09-28T12:00:00.000Z", [], Date.parse("2026-09-28T12:01:00.000Z"));

    expect(result.resultBreakdown).toHaveLength(1);
    expect(result.resultBreakdown[0]).toMatchObject({ campaignId: "camp-1", resultType: "leads", value: 3 });
  });

  it("expõe totais canônicos por conta e anúncio", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "acc-1", spend: 10, impressions: 100, reach: 80, clicks: 5 },
    ], {
      metaLeadActions: { forms: 2, site: 3, conversations: 4, total: 9 },
      totalsByAd: { "ad-1": { omni_lead: 2, "offsite_conversion.fb_pixel_lead": 3, "onsite_conversion.messaging_conversation_started_7d": 4 } },
      dailyMetaLeadByAccount: { "acc-1": { "2026-09-30": { forms: 2, site: 3, conversations: 4, total: 9 } } },
    }, "2026-09-30T12:00:00.000Z", [], Date.parse("2026-09-30T12:01:00.000Z"));

    expect(result.totalLeads).toBe(9);
    expect(result.leadBreakdownByAccount["acc-1"]).toEqual({ formLeads: 2, siteLeads: 3, conversations: 4, totalLeads: 9 });
    expect(result.leadBreakdownByAd["ad-1"]).toEqual({ formLeads: 2, siteLeads: 3, conversations: 4, totalLeads: 9 });
  });

  it("expõe custo diário, checkout, atribuição e breakdowns sem alterar o total Meta", () => {
    const result = aggregateMetaTrafficMetrics([
      { ad_id: "ad-1", ad_account_id: "acc-1", date: "2026-09-29", spend: 40, impressions: 1000, reach: 500, clicks: 20 },
      { ad_id: "ad-1", ad_account_id: "acc-1", date: "2026-09-30", spend: 60, impressions: 1200, reach: 600, clicks: 30 },
    ], {
      metaLeadActions: { forms: 2, site: 1, conversations: 1, total: 4 },
      totalsByAd: { "ad-1": { initiate_checkout: 3, omni_purchase: 1 } },
      breakdowns: {
        age: [{ key: "25-34", spend: 100, impressions: 2200, clicks: 50, leads: 4, cpl: 25, ctr: 2.27, cpm: 45.45 }],
        gender: [], region: [], country: [], platform: [], placement: [], device: [],
      },
    }, "2026-09-30T12:00:00.000Z", [], Date.parse("2026-09-30T12:01:00.000Z"), { attributionWindow: "7d_click", timezone: "America/Sao_Paulo" });

    expect(result.dailySpend).toBe(50);
    expect(result.checkout).toBe(3);
    expect(result.totalLeads).toBe(4);
    expect(result.breakdowns.age[0].key).toBe("25-34");
    expect(result.attributionWindow).toBe("7d_click");
    expect(result.timezone).toBe("America/Sao_Paulo");
  });
});
