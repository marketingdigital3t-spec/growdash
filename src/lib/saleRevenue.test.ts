import { describe, expect, it } from "vitest";
import { normalizeAttributionKey, saleMatchesCampaign } from "./saleRevenue";
import type { Sale } from "@/hooks/useSales";

const sale = (overrides: Partial<Sale> = {}) => ({
  id: "sale-1",
  user_id: "user-1",
  product_id: null,
  ad_account_id: "account-a",
  campaign_ids: [],
  sale_date: "2026-07-21",
  gross_revenue: 100,
  net_revenue: 100,
  tax_amount: 0,
  refund_amount: 0,
  chargeback_amount: 0,
  payment_method: "pix",
  status: "confirmed",
  quantity: 1,
  notes: null,
  lead_state: null,
  lead_formation: null,
  contact_name: null,
  contact_phone: null,
  contact_email: null,
  lead_city: null,
  lead_entry_date: null,
  adset_id: null,
  ad_id: null,
  rd_deal_id: "rd-1",
  rd_campaign_name: null,
  rd_product_name: null,
  rd_funnel_id: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  manual_platform: null,
  matched_campaign_id: null,
  match_method: null,
  manual_campaign_id: null,
  manual_adset_id: null,
  manual_ad_id: null,
  manual_override: false,
  workspace_id: null,
  business_unit_id: null,
  source_provider: null,
  source_record_id: null,
  source_closed_at: null,
  attribution_confidence: null,
  attribution_reason: null,
  created_at: "2026-07-21T12:00:00Z",
  updated_at: "2026-07-21T12:00:00Z",
  ...overrides,
}) as Sale;

describe("sale revenue attribution", () => {
  it("normaliza acentos e separadores sem fazer match aproximado", () => {
    expect(normalizeAttributionKey("[Expansão] Bem-Soluções")).toBe("expansaobemsolucoes");
  });

  it("atribui UTM exata somente na mesma conta", () => {
    const current = sale({ utm_campaign: "[Expansão] Bem Soluções" });
    expect(saleMatchesCampaign(current, { id: "cmp-1", name: "[Expansão] Bem Soluções", ad_account_id: "account-a" })).toBe(true);
    expect(saleMatchesCampaign(current, { id: "cmp-2", name: "[Expansão] Bem Soluções", ad_account_id: "account-b" })).toBe(false);
  });

  it("não conta pendência como faturamento", () => {
    expect(saleMatchesCampaign(sale({ status: "pending", matched_campaign_id: "cmp-1" }), { id: "cmp-1", ad_account_id: "account-a" })).toBe(false);
  });

  it("prioriza atribuição manual persistida", () => {
    const current = sale({ manual_override: true, manual_campaign_id: "cmp-manual", matched_campaign_id: "cmp-auto" });
    expect(saleMatchesCampaign(current, { id: "cmp-manual", ad_account_id: "account-a" })).toBe(true);
    expect(saleMatchesCampaign(current, { id: "cmp-auto", ad_account_id: "account-a" })).toBe(false);
  });
});
