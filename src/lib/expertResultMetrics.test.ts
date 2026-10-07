import { describe, expect, it } from "vitest";
import { buildExpertResultMetrics } from "./expertResultMetrics";

const sale = (overrides: Record<string, unknown> = {}) => ({
  id: "sale-1",
  user_id: "user-1",
  product_id: null,
  ad_account_id: "account-1",
  campaign_ids: [],
  sale_date: "2026-11-10",
  gross_revenue: 120,
  net_revenue: 100,
  tax_amount: 20,
  refund_amount: 0,
  chargeback_amount: 0,
  payment_method: "pix",
  status: "confirmed",
  quantity: 2,
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
  rd_deal_id: null,
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
  meta_lead_id: null,
  meta_form_id: null,
  meta_attribution_method: null,
  created_at: "2026-11-10T12:00:00Z",
  updated_at: "2026-11-10T12:00:00Z",
  ...overrides,
});

describe("expert result metrics", () => {
  it("uses only confirmed sales and preserves the quantity from each sale", () => {
    const result = buildExpertResultMetrics([
      sale(),
      sale({ id: "pending", status: "pending", quantity: 4, net_revenue: 400 }),
    ] as any, 10, true);

    expect(result).toEqual({ revenue: 100, sales: 2, conversion: 20 });
  });

  it("returns zero conversion for a confirmed zero-lead scope", () => {
    expect(buildExpertResultMetrics([sale()] as any, 0, true).conversion).toBe(0);
  });

  it("does not infer metrics when the lead source is unavailable", () => {
    expect(buildExpertResultMetrics([sale()] as any, 10, false).conversion).toBeNull();
  });
});
