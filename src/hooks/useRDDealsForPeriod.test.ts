import { describe, expect, it } from "vitest";
import { dedupeRDDeals, type RDDealLite } from "./useRDDealsForPeriod";

const base = (overrides: Partial<RDDealLite> = {}): RDDealLite => ({
  id: "row-1",
  rd_deal_id: "rd-1",
  ad_account_id: "account-a",
  rd_funnel_id: "funnel-a",
  rd_stage_id: null,
  rd_stage_name: null,
  rd_stage_order: null,
  stage_bucket: "lead",
  win: false,
  lost_reason: null,
  amount_total: 0,
  amount_total_original: null,
  amount_total_manual: null,
  amount_total_effective: null,
  manual_override_enabled: false,
  manual_override_reason: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  utm_id: null,
  contact_name: null,
  contact_email: null,
  lead_state: null,
  lead_city: null,
  lead_created_at: "2026-08-01T12:00:00.000Z",
  stage_updated_at: "2026-08-01T12:00:00.000Z",
  closed_at: null,
  rd_product_name: null,
  deal_owner_name: null,
  first_touch_utm_campaign: null,
  last_touch_utm_campaign: null,
  custom_fields: null,
  updated_at: "2026-08-01T12:00:00.000Z",
  rd_campaign_name: null,
  ...overrides,
});

describe("dedupeRDDeals", () => {
  it("keeps one deal across a consolidated account selection", () => {
    const rows = dedupeRDDeals([
      base({ id: "old", ad_account_id: "account-a" }),
      base({ id: "new", ad_account_id: "account-b", updated_at: "2026-08-02T12:00:00.000Z", amount_total: 15_000 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "new", amount_total: 15_000 });
  });

  it("does not merge separate RD deals", () => {
    expect(dedupeRDDeals([base(), base({ id: "row-2", rd_deal_id: "rd-2" })])).toHaveLength(2);
  });
});
