import { describe, expect, it } from "vitest";
import { getCampaignHealth } from "./campaignHealth";

const baseCampaign = {
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00.000Z",
  spend: 100,
  impressions: 1_000,
  leads: 10,
  cpl: 10,
  salesCount: 0,
  revenue: 0,
  roas: 0,
  frequency: 1,
  conversionRate: 10,
};

describe("getCampaignHealth", () => {
  it("classifica campanha ativa sem resultados como crítica", () => {
    expect(getCampaignHealth({ ...baseCampaign, leads: 0, cpl: 0 }, 10)).toBe("critical");
  });

  it("usa o alvo de CPL da campanha para classificar desvios", () => {
    expect(getCampaignHealth({ ...baseCampaign, cpl: 21 }, 30, 10)).toBe("critical");
  });

  it("mantém campanha dentro do alvo como saudável", () => {
    expect(getCampaignHealth(baseCampaign, 10, 12)).toBe("healthy");
  });
});
