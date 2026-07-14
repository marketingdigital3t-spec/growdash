import { describe, expect, it } from "vitest";
import { adAccounts, attributionRows, campaigns, integrations, rdStages } from "./data";

describe("Growdash demo data relationships", () => {
  it("links every campaign to an existing advertising account", () => {
    const accountIds = new Set(adAccounts.map((account) => account.id));
    expect(campaigns.every((campaign) => accountIds.has(campaign.accountId))).toBe(true);
  });

  it("contains the sources needed for unified attribution", () => {
    expect(integrations.some((integration) => integration.id === "meta")).toBe(true);
    expect(integrations.some((integration) => integration.id === "rd")).toBe(true);
    expect(attributionRows.every((row) => row.spend > 0 && row.revenue > 0)).toBe(true);
    expect(rdStages.at(-1)?.label).toBe("Venda");
  });
});
