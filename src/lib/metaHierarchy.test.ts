import { describe, expect, it } from "vitest";
import { hierarchyCounts, pruneCampaignSelection, scopeCampaignHierarchy } from "./metaHierarchy";

const campaigns = [
  { id: "campaign-1", adsets: [{ id: "adset-1", ads: [{ id: "ad-1" }, { id: "ad-2" }] }] },
  { id: "campaign-2", adsets: [{ id: "adset-2", ads: [{ id: "ad-3" }] }, { id: "adset-3", ads: [] }] },
];

describe("Meta hierarchy scope", () => {
  it("opens ad sets and ads for the full account without requiring a campaign selection", () => {
    const scope = scopeCampaignHierarchy(campaigns, new Set());
    expect(scope).toBe(campaigns);
    expect(hierarchyCounts(scope)).toEqual({ campaigns: 2, adsets: 3, ads: 3 });
  });

  it("filters descendants when campaigns are selected", () => {
    const scope = scopeCampaignHierarchy(campaigns, new Set(["campaign-2"]));
    expect(hierarchyCounts(scope)).toEqual({ campaigns: 1, adsets: 2, ads: 1 });
  });

  it("removes stale selections after changing ad accounts", () => {
    expect(Array.from(pruneCampaignSelection(new Set(["campaign-1", "missing"]), campaigns))).toEqual(["campaign-1"]);
  });
});
