import { describe, expect, it } from "vitest";
import { canonicalInsightLeads, dedupeDailyInsights, filterInsightsByCampaignScope } from "./useInsights";
import { matchesMetaAttributionWindow } from "@/lib/metaInsightFacts";

describe("daily insight scope", () => {
  it("calculates Meta leads only from forms, site and conversations, ignoring legacy leads aggregate", () => {
    expect(canonicalInsightLeads({ form_leads: 7, site_leads: 0, conversations: 1, leads: 13 } as any))
      .toEqual({ forms: 7, site: 0, conversations: 1, total: 8 });
  });

  it("does not use a legacy aggregate when canonical action fields are absent", () => {
    expect(canonicalInsightLeads({ leads: 13 } as any))
      .toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
  });

  it("deduplicates retries without collapsing different attribution windows", () => {
    const rows: any[] = [
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "7d_click", spend: 10 },
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "7d_click", spend: 10 },
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "1d_view", spend: 3 },
    ];
    expect(dedupeDailyInsights(rows)).toHaveLength(2);
  });

  it("prefers the explicit account-default snapshot over its legacy null duplicate", () => {
    const rows: any[] = [
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: null, spend: 19.11 },
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "account_default", spend: 18.66 },
    ];

    expect(dedupeDailyInsights(rows)).toEqual([rows[1]]);
  });

  it("treats a null attribution window as account_default only", () => {
    expect(matchesMetaAttributionWindow(null, "account_default")).toBe(true);
    expect(matchesMetaAttributionWindow(null, "7d_click")).toBe(false);
    expect(matchesMetaAttributionWindow("1d_view", "7d_click")).toBe(false);
    expect(matchesMetaAttributionWindow("1d_view,7d_click", "7d_click,1d_view")).toBe(true);
  });

  it("deduplicates equivalent attribution-window orderings", () => {
    const rows: any[] = [
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "1d_view,7d_click", spend: 19.11 },
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "7d_click,1d_view", spend: 18.66 },
    ];

    expect(dedupeDailyInsights(rows)).toHaveLength(1);
  });

  it("keeps a selected campaign's historical fact when the live catalog is missing", () => {
    const rows = [
      { ad_id: "archived-ad", campaign_id: "selected-campaign", spend: 22.11 },
      { ad_id: "other-ad", campaign_id: "other-campaign", spend: 99 },
      { ad_id: "catalog-ad", campaign_id: null, spend: 3 },
    ];

    expect(filterInsightsByCampaignScope(rows, ["selected-campaign"], {})).toEqual([rows[0]]);
    expect(filterInsightsByCampaignScope(rows, ["selected-campaign"], { "catalog-ad": "selected-campaign" })).toEqual([rows[0], rows[2]]);
  });

  it("does not widen an explicitly selected campaign to an unrelated fact", () => {
    const rows = [{ ad_id: "ad-1", campaign_id: "campaign-a" }, { ad_id: "ad-2", campaign_id: null }];
    expect(filterInsightsByCampaignScope(rows, ["campaign-b"], { "ad-2": "campaign-a" })).toEqual([]);
  });
});
