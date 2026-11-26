import { describe, expect, it } from "vitest";
import { buildTrafficFundingSummary, calculateTrafficFundsAdded, normalizeMetaPaymentMethod } from "./trafficFunding";

describe("traffic funding reconciliation", () => {
  it("includes paid PIX funding that exists only in account transactions", () => {
    expect(calculateTrafficFundsAdded([], [{ ad_account_id: "a", amount: 125, time: "2026-08-21T12:00:00Z", payment_method: "Pix", status: "paid" }])).toBe(125);
  });
  it("does not double count the same PIX funding acknowledged by Meta", () => {
    expect(calculateTrafficFundsAdded([{ ad_account_id: "a", delta: 125, event_at: "2026-08-21T12:05:00Z" }], [{ ad_account_id: "a", amount: 125, time: "2026-08-21T12:00:00Z", payment_method: "PIX", status: "success" }])).toBe(125);
  });
  it("keeps independent Meta balance increases and ignores unpaid PIX", () => {
    expect(calculateTrafficFundsAdded([{ ad_account_id: "a", delta: 90, event_at: "2026-08-20T12:00:00Z" }], [{ ad_account_id: "a", amount: 50, time: "2026-08-21T12:00:00Z", payment_method: "Pix", status: "pending" }])).toBe(90);
  });
  it("normalizes Meta payment options without inventing a method", () => {
    expect(normalizeMetaPaymentMethod("pix_transfer")).toBe("pix");
    expect(normalizeMetaPaymentMethod("credit_card")).toBe("cartao");
    expect(normalizeMetaPaymentMethod("prepaid_funds")).toBe("saldo_pre_pago");
    expect(normalizeMetaPaymentMethod("boleto bancário")).toBe("boleto");
    expect(normalizeMetaPaymentMethod("manual")).toBe("nao_informado");
  });
  it("separates confirmed and pending contributions from Meta spend and available balance", () => {
    const summary = buildTrafficFundingSummary([{ amount: 1200, payment_method: "pix", status: "completed" }, { amount: 1500, payment_method: "pix", status: "pending" }, { amount: 500, payment_method: "credit_card", status: "paid" }], 560.39, 1139.61);
    expect(summary.confirmedTotal).toBe(1700);
    expect(summary.pendingTotal).toBe(1500);
    expect(summary.spendTotal).toBe(560.39);
    expect(summary.availableBalance).toBe(1139.61);
    expect(summary.byPaymentMethod).toEqual({ pix: 1200, cartao: 500 });
  });
  it("counts confirmed card and boleto contributions alongside Pix", () => {
    expect(calculateTrafficFundsAdded([], [{ ad_account_id: "a", amount: 1200, time: "2026-10-21T10:00:00Z", payment_method: "pix", status: "completed" }, { ad_account_id: "a", amount: 800, time: "2026-10-21T11:00:00Z", payment_method: "Cartão", status: "paid" }, { ad_account_id: "a", amount: 400, time: "2026-10-21T12:00:00Z", payment_method: "boleto", status: "pending" }])).toBe(2000);
  });
  it("does not classify Meta ad charges as new contributions", () => {
    expect(calculateTrafficFundsAdded([], [{ ad_account_id: "a", amount: 1200, time: "2026-10-21T10:00:00Z", payment_method: "card", status: "paid", billing_reason: "ad_charge" }])).toBe(0);
  });
});
