import { describe, expect, it } from "vitest";
import { getMetaColumnPreset, metaBreakdownGroups, metaColumnPresets } from "./metaTableConfig";

describe("Meta table configuration", () => {
  it("mantém as predefinições e inclui a visão VTSD completa", () => {
    expect(metaColumnPresets).toHaveLength(11);
    expect(getMetaColumnPreset("sales").columns).toContain("roas");
    expect(getMetaColumnPreset("vtsd").columns).toEqual([
      "name", "delivery", "deliveryStatus", "actions", "reach", "impressions", "frequency",
      "linkClicks", "linkCpc", "uniqueLinkCtr", "cpm", "budget", "leads", "cpl", "spend",
      "landingPageViews", "costPerLandingPageView", "checkouts", "costPerCheckout",
      "metaPurchases", "metaCostPerPurchase", "metaPurchaseRoas",
    ]);
  });

  it("inclui os principais detalhamentos do Meta Ads", () => {
    const ids = metaBreakdownGroups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toEqual(expect.arrayContaining(["age", "gender", "placement", "device", "hour_account", "conversion_device"]));
  });
});
