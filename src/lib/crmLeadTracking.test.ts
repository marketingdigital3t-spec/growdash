import { describe, expect, it } from "vitest";
import { extractCrmLeadTracking } from "../../supabase/functions/_shared/crmLeadTracking";

describe("CRM lead Meta tracking contract", () => {
  it("accepts root and nested Meta fields used by form and conversation connectors", () => {
    expect(extractCrmLeadTracking({
      name: "Lead",
      meta: {
        lead_id: "meta-lead-1",
        campaign: { id: "campaign-1", name: "Campanha" },
        adset: { id: "adset-1", name: "Conjunto" },
        ad: { id: "ad-1", name: "Anúncio" },
        form: { id: "form-1", name: "Formulário" },
        platform: "ig",
        placement: "instagram_reels",
        is_organic: false,
      },
    })).toEqual({
      meta_lead_id: "meta-lead-1",
      form_id: "form-1",
      campaign_id: "campaign-1",
      adset_id: "adset-1",
      ad_id: "ad-1",
      campaign_name: "Campanha",
      adset_name: "Conjunto",
      ad_name: "Anúncio",
      form_name: "Formulário",
      platform: "ig",
      placement: "instagram_reels",
      is_organic: false,
    });
  });

  it("keeps absent delivery data null instead of fabricating a placement", () => {
    expect(extractCrmLeadTracking({
      campaign_id: "campaign-1",
      platform: "fb",
    })).toMatchObject({
      campaign_id: "campaign-1",
      platform: "fb",
      placement: null,
      is_organic: null,
    });
  });
});
