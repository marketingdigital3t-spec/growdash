import { describe, expect, it } from "vitest";
import { dedupeRDDealsById, isDealInRDQueryScope, isRDDealInScopePeriod, normalizeRDQueryScope } from "./rdQueryScope";

const scope = normalizeRDQueryScope({
  accountIds: ["account-b", "account-a", "account-a"],
  funnelIds: ["funnel-a"],
  startDate: new Date("2026-09-01T00:00:00-03:00"),
  endDate: new Date("2026-09-30T00:00:00-03:00"),
  dateRule: "created_at_for_open_closed_at_for_won",
});

describe("RD query scope", () => {
  it("requires account and funnel to be in the intersection", () => {
    expect(isDealInRDQueryScope({ ad_account_id: "account-a", rd_funnel_id: "funnel-a" }, scope)).toBe(true);
    expect(isDealInRDQueryScope({ ad_account_id: "account-b", rd_funnel_id: "funnel-a" }, scope)).toBe(true);
    expect(isDealInRDQueryScope({ ad_account_id: "account-c", rd_funnel_id: "funnel-a" }, scope)).toBe(false);
    expect(isDealInRDQueryScope({ ad_account_id: "account-a", rd_funnel_id: "funnel-b" }, scope)).toBe(false);
  });

  it("uses creation for open deals and closing for won deals", () => {
    expect(isRDDealInScopePeriod({ ad_account_id: "account-a", rd_funnel_id: "funnel-a", lead_created_at: "2026-08-31T23:00:00-03:00" }, scope)).toBe(false);
    expect(isRDDealInScopePeriod({ ad_account_id: "account-a", rd_funnel_id: "funnel-a", lead_created_at: "2026-09-05T12:00:00-03:00" }, scope)).toBe(true);
    expect(isRDDealInScopePeriod({ ad_account_id: "account-a", rd_funnel_id: "funnel-a", win: true, closed_at: "2026-08-31T23:00:00-03:00", stage_updated_at: "2026-09-05T12:00:00-03:00" }, scope)).toBe(false);
    expect(isRDDealInScopePeriod({ ad_account_id: "account-a", rd_funnel_id: "funnel-a", win: true, closed_at: "2026-09-05T12:00:00-03:00" }, scope)).toBe(true);
  });

  it("mirrors the RD creation-date filter for every current stage", () => {
    const creationScope = normalizeRDQueryScope({ ...scope, dateRule: "lead_created_at" });
    expect(isRDDealInScopePeriod({
      ad_account_id: "account-a",
      rd_funnel_id: "funnel-a",
      win: true,
      lead_created_at: "2026-09-10T12:00:00-03:00",
      closed_at: "2026-10-01T12:00:00-03:00",
    }, creationScope)).toBe(true);
    expect(isRDDealInScopePeriod({
      ad_account_id: "account-a",
      rd_funnel_id: "funnel-a",
      win: true,
      lead_created_at: "2026-08-10T12:00:00-03:00",
      closed_at: "2026-09-10T12:00:00-03:00",
    }, creationScope)).toBe(false);
  });

  it("deduplicates the same RD identity once", () => {
    expect(dedupeRDDealsById([{ rd_deal_id: "deal-1" }, { rd_deal_id: "deal-1" }, { rd_deal_id: "deal-2" }])).toHaveLength(2);
  });

  it("keeps the same external deal separate when it belongs to different RD connections", () => {
    expect(dedupeRDDealsById([
      { rd_deal_id: "deal-1", rd_connection_id: "connection-a" },
      { rd_deal_id: "deal-1", rd_connection_id: "connection-b" },
    ])).toHaveLength(2);
  });

  it("allows an RD-only funnel without weakening an explicit account scope", () => {
    expect(isDealInRDQueryScope({ ad_account_id: null, rd_funnel_id: "funnel-a" }, scope)).toBe(false);
    expect(isDealInRDQueryScope({ ad_account_id: "account-a", rd_funnel_id: "funnel-a" }, scope)).toBe(true);
  });
});
