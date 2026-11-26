import { describe, expect, it } from "vitest";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import { attributeLeadsToCampaigns } from "./leadAttribution";

const deal = (overrides: Partial<RDDealLite> = {}): RDDealLite => ({
  id: "deal-1",
  rd_deal_id: "rd-1",
  ad_account_id: "account-1",
  rd_funnel_id: "funnel-1",
  rd_stage_id: null,
  rd_stage_name: "Lead",
  rd_stage_order: 1,
  stage_bucket: "lead",
  win: false,
  lost_reason: null,
  amount_total: 0,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  contact_name: "Contato de teste",
  contact_email: "teste@exemplo.com",
  lead_state: null,
  lead_city: null,
  lead_created_at: "2026-09-02T12:00:00Z",
  stage_updated_at: null,
  closed_at: null,
  rd_product_name: null,
  deal_owner_name: null,
  first_touch_utm_campaign: null,
  last_touch_utm_campaign: null,
  rd_campaign_name: null,
  ...overrides,
});

describe("atribuição de leads Meta", () => {
  it("prioriza os IDs imutáveis do formulário Meta sobre UTMs ausentes", () => {
    const result = attributeLeadsToCampaigns(
      [deal({ meta_lead_id: "lead-meta-1", meta_campaign_id: "campaign-meta-1", meta_adset_id: "adset-meta-1", meta_ad_id: "ad-meta-1" })],
      [{
        ad_id: "ad-meta-1",
        ad_account_id: "account-1",
        campaign_id: "campaign-meta-1",
        campaign_name: "Campanha formulário",
        adset_name: "Conjunto formulário",
        ad_name: "Criativo formulário",
      }] as any,
    );

    expect(result.unmatched).toHaveLength(0);
    expect(result.byCampaign.get("campaign-meta-1")?.counts.total).toBe(1);
    expect(result.perDeal[0]).toMatchObject({
      campaign_id: "campaign-meta-1",
      ad_id: "ad-meta-1",
    });
  });
});
