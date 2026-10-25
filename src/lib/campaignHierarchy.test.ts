import { describe, expect, it } from "vitest";
import { hydrateCampaignHierarchy, hierarchyCountLabel, shouldLoadCampaignHierarchy } from "./campaignHierarchy";

describe("campaign hierarchy loading", () => {
  it("hydrates ad sets and ads while Intelligence is open", () => {
    expect(shouldLoadCampaignHierarchy("campaigns", "intelligence")).toBe(true);
  });

  it("keeps hierarchy requests enabled on their dedicated tabs", () => {
    expect(shouldLoadCampaignHierarchy("adsets", null)).toBe(true);
    expect(shouldLoadCampaignHierarchy("ads", null)).toBe(true);
  });

  it("does not fetch the hierarchy for the campaigns or alerts views", () => {
    expect(shouldLoadCampaignHierarchy("campaigns", null)).toBe(false);
    expect(shouldLoadCampaignHierarchy("campaigns", "alerts")).toBe(false);
  });

  it("hydrates ads and ad sets from scoped ID results without nested PostgREST joins", () => {
    const campaign = { id: "campaign-1", name: "Campanha", ad_account_id: "account-1" };
    const adset = { id: "adset-1", name: "Conjunto", campaign_id: "campaign-1" };
    const ad = { id: "ad-1", name: "Anúncio", adset_id: "adset-1" };

    const hydrated = hydrateCampaignHierarchy({ campaigns: [campaign], adsets: [adset], ads: [ad] });

    expect(hydrated.adsets[0].campaigns).toEqual([campaign]);
    expect(hydrated.ads[0].adsets).toEqual([{ ...adset, campaigns: [campaign] }]);
  });

  it("does not report zero while the independent hierarchy query is loading or unavailable", () => {
    expect(hierarchyCountLabel("Anúncios", 0, { isLoading: true, isError: false, hasSnapshot: false })).toBe("Anúncios (carregando…)");
    expect(hierarchyCountLabel("Anúncios", 0, { isLoading: false, isError: true, hasSnapshot: false })).toBe("Anúncios (indisponível)");
    expect(hierarchyCountLabel("Anúncios", 0, { isLoading: false, isError: false, hasSnapshot: true })).toBe("Anúncios (0)");
  });
});
