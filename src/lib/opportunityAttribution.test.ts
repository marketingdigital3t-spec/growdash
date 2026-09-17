import { describe, expect, it } from "vitest";
import { attributeRDOpportunity, attributeRDOpportunities } from "./opportunityAttribution";

const insight = (overrides: Record<string, unknown> = {}) => ({
  ad_id: "ad-1", adset_name: "Conjunto 1", campaign_name: "Campanha 1", campaign_id: "camp-1", ad_account_id: "acc-1", ad_name: "Anúncio 1", ...overrides,
} as any);
const deal = (overrides: Record<string, unknown> = {}) => ({
  id: "row-1", ad_account_id: "acc-1", rd_funnel_id: "funnel-1", rd_deal_id: "deal-1", stage_bucket: "opportunity", utm_id: "ad-1", utm_campaign: "Campanha 1", utm_term: "Conjunto 1", utm_content: "Anúncio 1", ...overrides,
} as any);

describe("opportunity attribution", () => {
  it("resolves the real Meta hierarchy by ad id", () => {
    const row = attributeRDOpportunity(deal(), [insight()]);
    expect(row.status).toBe("ad");
    expect(row.campaignName).toBe("Campanha 1");
    expect(row.adsetName).toBe("Conjunto 1");
    expect(row.adName).toBe("Anúncio 1");
  });

  it("uses campaign UTM only when it matches the same account", () => {
    const row = attributeRDOpportunity(deal({ utm_id: null, utm_term: null, utm_content: null }), [insight(), insight({ ad_account_id: "acc-2", campaign_name: "Campanha 1", campaign_id: "camp-2" })]);
    expect(row.status).toBe("campaign");
    expect(row.campaignId).toBe("camp-1");
  });

  it("does not attribute an unknown campaign", () => {
    const row = attributeRDOpportunity(deal({ utm_id: null, utm_campaign: "Outra campanha" }), [insight()]);
    expect(row.status).toBe("unmatched");
    expect(row.campaignId).toBeNull();
  });

  it("keeps only the strict opportunity stage", () => {
    const rows = attributeRDOpportunities([deal(), deal({ rd_deal_id: "deal-2", stage_bucket: "sql" })], [insight()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].deal.rd_deal_id).toBe("deal-1");
  });
});
