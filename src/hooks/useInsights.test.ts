import { describe, expect, it } from "vitest";
import { dedupeDailyInsights, filterInsightsByCampaignScope } from "./useInsights";

describe("daily insight scope", () => {
  it("deduplicates retries without collapsing different attribution windows", () => {
    const rows: any[] = [
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "7d_click", spend: 10 },
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "7d_click", spend: 10 },
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "1d_view", spend: 3 },
    ];
    expect(dedupeDailyInsights(rows)).toHaveLength(2);
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
