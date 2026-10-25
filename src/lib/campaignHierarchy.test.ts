import { describe, expect, it } from "vitest";
import { shouldLoadCampaignHierarchy } from "./campaignHierarchy";

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
});
