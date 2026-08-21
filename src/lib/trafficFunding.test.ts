import { describe, expect, it } from "vitest";
import { calculateTrafficFundsAdded } from "./trafficFunding";

describe("calculateTrafficFundsAdded", () => {
  it("includes paid PIX funding that exists only in account transactions", () => {
    expect(calculateTrafficFundsAdded([], [{ ad_account_id: "a", amount: 125, time: "2026-08-21T12:00:00Z", payment_method: "Pix", status: "paid" }])).toBe(125);
  });

  it("does not double count the same PIX funding acknowledged by Meta", () => {
    expect(calculateTrafficFundsAdded(
      [{ ad_account_id: "a", delta: 125, event_at: "2026-08-21T12:05:00Z" }],
      [{ ad_account_id: "a", amount: 125, time: "2026-08-21T12:00:00Z", payment_method: "PIX", status: "success" }],
    )).toBe(125);
  });

  it("keeps independent Meta balance increases and ignores unpaid PIX", () => {
    expect(calculateTrafficFundsAdded(
      [{ ad_account_id: "a", delta: 90, event_at: "2026-08-20T12:00:00Z" }],
      [{ ad_account_id: "a", amount: 50, time: "2026-08-21T12:00:00Z", payment_method: "Pix", status: "pending" }],
    )).toBe(90);
  });
});
