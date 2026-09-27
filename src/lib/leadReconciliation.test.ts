import { describe, expect, it } from "vitest";
import { reconcileRDDealsToMetaLeads } from "@/lib/leadReconciliation";

const deal = (id: string, email: string | null, phone: string | null, extra = {}) => ({
  id, rd_deal_id: id, rd_connection_id: "rd", ad_account_id: "old-account", rd_funnel_id: "funnel",
  rd_stage_id: null, rd_stage_name: null, rd_stage_order: null, stage_bucket: "lead", win: false,
  lost_reason: null, amount_total: null, utm_source: null, utm_medium: null, utm_campaign: null,
  utm_content: null, utm_term: null, contact_name: null, contact_email: email, contact_phone: phone,
  lead_state: null, lead_city: null, lead_created_at: "2026-09-27T10:00:00Z", stage_updated_at: null,
  closed_at: null, rd_product_name: null, deal_owner_name: null, first_touch_utm_campaign: null,
  last_touch_utm_campaign: null, rd_campaign_name: null, ...extra,
} as any);

describe("reconcileRDDealsToMetaLeads", () => {
  it("matches independent RD funnels by email/phone without using ad_account_id", () => {
    const result = reconcileRDDealsToMetaLeads(
      [deal("rd-1", "Lead@Example.com", "+55 (11) 99999-0000")],
      [{ meta_lead_id: "meta-1", ad_account_id: "selected-meta", created_time: "2026-09-27T09:00:00Z", email: "lead@example.com", phone: "5511999990000" }],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].method).toBe("email_phone");
  });

  it("does not double count an ambiguous identity", () => {
    const result = reconcileRDDealsToMetaLeads(
      [deal("rd-1", "same@example.com", null), deal("rd-2", "same@example.com", null)],
      [
        { meta_lead_id: "meta-1", ad_account_id: "account", created_time: "2026-09-27T09:00:00Z", email: "same@example.com", phone: null },
        { meta_lead_id: "meta-2", ad_account_id: "account", created_time: "2026-09-27T09:01:00Z", email: "same@example.com", phone: null },
      ],
    );
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedDeals).toHaveLength(2);
  });
});
