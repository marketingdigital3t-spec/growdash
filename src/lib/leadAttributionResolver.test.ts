import { describe, expect, it } from "vitest";
import { resolveLeadAttribution } from "./leadAttributionResolver";

const insight = (overrides: any = {}) => ({
  ad_id: "ad-1", adset_id: "set-1", campaign_id: "camp-1", ad_name: "Criativo 1", adset_name: "Conjunto 1", campaign_name: "Campanha 1", ad_account_id: "acc-1", ...overrides,
});

describe("resolveLeadAttribution", () => {
  it("resolve somente com utm_id e respeita a conta", () => {
    const result = resolveLeadAttribution({ ad_account_id: "acc-1", utm_id: "ad-1" }, [insight() as any]);
    expect(result).toMatchObject({ campaignName: "Campanha 1", adsetName: "Conjunto 1", adName: "Criativo 1", method: "meta_id", status: "attributed" });
  });

  it("não cruza o anúncio de outra conta", () => {
    const result = resolveLeadAttribution({ ad_account_id: "acc-2", utm_id: "ad-1" }, [insight() as any]);
    expect(result.status).toBe("partial");
    expect(result.campaignName).toBeNull();
  });

  it("identifica por nomes quando os IDs não chegaram", () => {
    const result = resolveLeadAttribution({ ad_account_id: "acc-1", utm_campaign: "Campanha 1", utm_term: "Conjunto 1", utm_content: "Criativo 1" }, [insight() as any]);
    expect(result).toMatchObject({ method: "utm", status: "attributed", adId: "ad-1" });
  });
});
