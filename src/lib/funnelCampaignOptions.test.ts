import { describe, expect, it } from "vitest";
import { buildFunnelCampaignOptions, splitFunnelCampaignSelection } from "./funnelCampaignOptions";

describe("funnel campaign options", () => {
  it("combines the complete Meta catalog with RD UTMs using namespaced ids", () => {
    const options = buildFunnelCampaignOptions(
      [{ id: "meta-2", name: "Campanha B" }, { id: "meta-1", name: "Campanha A" }],
      ["Campanha A", "Campanha A", "Campanha RD"],
    );

    expect(options).toEqual([
      { id: "meta:meta-1", name: "Meta · Campanha A", source: "meta", sourceLabel: "Meta", sourceId: "meta-1" },
      { id: "rd:Campanha A", name: "UTM RD · Campanha A", source: "rd", sourceLabel: "UTM RD", sourceId: "Campanha A" },
      { id: "meta:meta-2", name: "Meta · Campanha B", source: "meta", sourceLabel: "Meta", sourceId: "meta-2" },
      { id: "rd:Campanha RD", name: "UTM RD · Campanha RD", source: "rd", sourceLabel: "UTM RD", sourceId: "Campanha RD" },
    ]);
  });

  it("keeps Meta ids and RD UTM values separate when selected together", () => {
    expect(splitFunnelCampaignSelection(["meta:meta-1", "rd:Campanha A", "meta:meta-1", "invalid"]))
      .toEqual({ selectedMetaCampaignIds: ["meta-1"], selectedUtmCampaigns: ["Campanha A"] });
  });
});
