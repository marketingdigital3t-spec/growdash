import { describe, expect, it } from "vitest";
import { buildCampaignActionCatalog } from "./campaignActionCatalog";

describe("campaign action catalog", () => {
  it("reuses adset and destination facts already loaded with campaigns", () => {
    expect(buildCampaignActionCatalog([
      { adsets: [{ id: "set-1", destination_type: "WEBSITE", ads: [{ id: "ad-1" }] }] },
    ])).toEqual({
      adsetIdByAdId: { "ad-1": "set-1" },
      destinationTypeByAdset: { "set-1": "WEBSITE" },
    });
  });
});
