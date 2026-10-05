import { describe, expect, it } from "vitest";
import { addInsightOnlyCampaignRows, aggregateMetaCampaignLeadFacts } from "./metaCampaignLeadRollup";

const insight = (overrides: Partial<Parameters<typeof aggregateMetaCampaignLeadFacts>[0][number]> = {}) => ({
  ad_account_id: "account-1",
  ad_id: "ad-1",
  campaign_id: "campaign-1",
  campaign_name: "Campanha real da Meta",
  date: "2026-10-04",
  attribution_window: "account_default",
  spend: 12.5,
  impressions: 1000,
  reach: 800,
  clicks: 20,
  ...overrides,
});

const action = (action_type: string, value: number, overrides: Partial<Parameters<typeof aggregateMetaCampaignLeadFacts>[1][number]> = {}) => ({
  ad_account_id: "account-1",
  ad_id: "ad-1",
  date: "2026-10-04",
  action_type,
  value,
  attribution_window: "account_default",
  ...overrides,
});

describe("aggregateMetaCampaignLeadFacts", () => {
  it("includes canonical conversation actions even when campaign/ad catalog is absent", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [insight({ campaign_id: "campaign-without-catalog" })],
      [action("onsite_conversion.lead_grouped", 7), action("onsite_conversion.messaging_conversation_started_7d", 2)],
      { "account-1": "account_default" },
      {},
      undefined,
      new Set(["account-1|ad-1"]),
    );

    expect(result.totals).toEqual({ forms: 7, site: 0, conversations: 2, total: 9 });
    expect(result.byCampaign["campaign-without-catalog"].total).toBe(9);
    expect(result.dailyByCampaign["campaign-without-catalog"]["2026-10-04"].conversations).toBe(2);
  });

  it("reconciles 27 Instant Forms plus 12 conversations as 39 acquisitions", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [
        insight({ ad_id: "form-ad", campaign_id: "forms-campaign" }),
        insight({ ad_id: "message-ad", campaign_id: "message-campaign" }),
      ],
      [
        action("onsite_conversion.lead_grouped", 27, { ad_id: "form-ad" }),
        action("leadgen_grouped", 27, { ad_id: "form-ad" }),
        action("onsite_conversion.messaging_conversation_started_7d", 10, { ad_id: "message-ad" }),
        action("onsite_conversion.total_messaging_connection", 11, { ad_id: "message-ad" }),
        action("onsite_conversion.messaging_conversation_replied_7d", 2, { ad_id: "message-ad" }),
      ],
      { "account-1": "account_default" },
      {},
      undefined,
      new Set(["account-1|message-ad"]),
    );

    expect(result.totals).toEqual({ forms: 27, site: 0, conversations: 10, total: 37 });
    expect(result.deliveryByCampaign["forms-campaign"]).toMatchObject({
      spend: 12.5,
      impressions: 1000,
      reach: 800,
      clicks: 20,
      insightRows: 1,
      campaignName: "Campanha real da Meta",
      accountIds: ["account-1"],
    });
  });

  it("creates a read-only campaign row from Insights when the campaign catalog is missing", () => {
    const rollup = aggregateMetaCampaignLeadFacts(
      [insight({ campaign_id: "missing-catalog-id", campaign_name: "Expert | Leads | Outubro" })],
      [action("onsite_conversion.lead_grouped", 7)],
      { "account-1": "account_default" },
      {},
    );

    const [synthetic] = addInsightOnlyCampaignRows([], rollup.deliveryByCampaign);
    expect(synthetic).toMatchObject({
      id: "missing-catalog-id",
      name: "Expert | Leads | Outubro",
      ad_account_id: "account-1",
      spend: 12.5,
      impressions: 1000,
      clicks: 20,
      catalogMissing: true,
      budget: null,
    });
    expect(rollup.byCampaign[synthetic.id].total).toBe(7);
  });

  it("does not duplicate catalog rows and keeps unmapped Insights isolated per account", () => {
    const rollup = aggregateMetaCampaignLeadFacts(
      [
        insight({ campaign_id: null }),
        insight({ ad_account_id: "account-2", ad_id: "ad-2", campaign_id: null }),
        insight({ ad_id: "ad-3", campaign_id: "known" }),
      ],
      [],
      { "account-1": "account_default", "account-2": "account_default" },
      {},
    );

    const rows = addInsightOnlyCampaignRows([{ id: "known", name: "Known" }], rollup.deliveryByCampaign);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ id: "known", name: "Known" });
    expect(rows.slice(1).map((row) => row.ad_account_id)).toEqual(["account-1", "account-2"]);
    expect(rows.slice(1).every((row) => row.campaignUnmapped && row.catalogMissing)).toBe(true);
  });

  it("does not turn unconfigured site events into leads or leak another account", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [insight()],
      [
        action("offsite_conversion.fb_pixel_lead", 15),
        action("onsite_conversion.lead_grouped", 7, { ad_account_id: "account-2" }),
      ],
      { "account-1": "account_default" },
      {},
    );

    expect(result.totals).toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
  });

  it("matches null attribution only to account_default and honors configured site events", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [insight({ attribution_window: null })],
      [
        action("offsite_conversion.fb_pixel_lead", 3, { attribution_window: null }),
        action("onsite_conversion.lead_grouped", 4),
      ],
      { "account-1": "account_default" },
      { "account-1": "offsite_conversion.fb_pixel_lead" },
      new Set(["account-1|ad-1"]),
    );

    expect(result.totals).toEqual({ forms: 4, site: 3, conversations: 0, total: 7 });
  });

  it("prefers an explicit account_default action over its legacy null duplicate", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [insight()],
      [
        action("onsite_conversion.lead_grouped", 3, { attribution_window: null }),
        action("onsite_conversion.lead_grouped", 4),
      ],
      { "account-1": "account_default" },
      {},
    );

    expect(result.totals.total).toBe(4);
  });

  it("prefers explicit account_default Insights over its legacy null duplicate", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [
        insight({ attribution_window: null, spend: 99, campaign_name: "Legacy duplicate" }),
        insight({ attribution_window: "account_default", spend: 12.5, campaign_name: "Canonical row" }),
      ],
      [action("onsite_conversion.lead_grouped", 4)],
      { "account-1": "account_default" },
      {},
    );

    expect(result.scopedInsightRows).toBe(1);
    expect(result.deliveryByCampaign["campaign-1"]).toMatchObject({
      spend: 12.5,
      campaignName: "Canonical row",
      insightRows: 1,
    });
  });

  it("counts a configured pixel action only for explicitly WEBSITE ad sets", () => {
    const result = aggregateMetaCampaignLeadFacts(
      [
        insight({ ad_id: "website-ad", adset_id: "website-set" }),
        insight({ ad_id: "native-ad", adset_id: "native-set", campaign_id: "native-campaign" }),
      ],
      [
        action("custom_site_conversion", 4, { ad_id: "website-ad" }),
        action("onsite_conversion.lead_grouped", 7, { ad_id: "native-ad" }),
        action("custom_site_conversion", 15, { ad_id: "native-ad" }),
      ],
      { "account-1": "account_default" },
      { "account-1": "custom_site_conversion" },
      new Set(["account-1|website-ad"]),
    );

    expect(result.totals).toEqual({ forms: 7, site: 4, conversations: 0, total: 11 });
    expect(result.byCampaign["native-campaign"]).toMatchObject({ forms: 7, site: 0, total: 7 });
  });
});
