import { describe, expect, it } from "vitest";
import { resolveLeadAttribution } from "./leadAttributionResolver";

const insight = (overrides: any = {}) => ({
  ad_id: "ad-1", adset_id: "set-1", campaign_id: "camp-1", ad_name: "Criativo 1", adset_name: "Conjunto 1", campaign_name: "Campanha 1", ad_account_id: "acc-1", ...overrides,
});

describe("resolveLeadAttribution", () => {
  it("resolve somente com utm_id e respeita a conta", () => {
    const result = resolveLeadAttribution({ ad_account_id: "acc-1", utm_id: "ad-1" }, [insight() as any]);
    expect(result).toMatchObject({ source: null, platform: null, campaignName: "Campanha 1", adsetName: "Conjunto 1", adName: "Criativo 1", method: "meta_id", status: "attributed" });
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

  it("preserva os detalhes capturados no lead mesmo sem breakdown de insights", () => {
    const result = resolveLeadAttribution({
      ad_account_id: "acc-1",
      meta_campaign_id: "camp-1",
      meta_adset_id: "set-1",
      meta_ad_id: "ad-1",
      meta_campaign_name: "Campanha do lead",
      meta_adset_name: "Conjunto do lead",
      meta_ad_name: "Anúncio do lead",
      meta_form_id: "form-1",
      meta_form_name: "Formulário do lead",
      meta_platform: "ig",
      meta_placement: null,
      meta_is_organic: false,
    }, []);
    expect(result).toMatchObject({
      status: "partial",
      campaignName: "Campanha do lead",
      adsetName: "Conjunto do lead",
      adName: "Anúncio do lead",
      formId: "form-1",
      formName: "Formulário do lead",
      platform: "ig",
      placement: null,
      isOrganic: false,
    });
  });
});
