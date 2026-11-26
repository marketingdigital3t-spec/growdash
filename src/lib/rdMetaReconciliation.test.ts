import { describe, expect, it } from "vitest";

interface Sale {
  id: string;
  rd_deal_id: string | null;
  status: string;
  user_id: string;
}

interface RdDeal {
  rd_deal_id: string;
  rd_funnel_id: string;
}

/**
 * Conta vendas confirmadas com rd_deal_id que não possuem deal
 * correspondente em rd_deals (vendas órfãs).
 */
function countOrphanSales(sales: Sale[], rdDeals: RdDeal[]): number {
  const confirmedSalesWithRdId = sales.filter(
    (s) => s.status === "confirmed" && s.rd_deal_id,
  );
  const presentDealIds = new Set(rdDeals.map((d) => d.rd_deal_id));
  return confirmedSalesWithRdId.filter(
    (s) => !presentDealIds.has(s.rd_deal_id!),
  ).length;
}

describe("Meta ↔ RD reconciliation", () => {
  it("detects orphan sales with rd_deal_id but no matching rd_deal", () => {
    const sales: Sale[] = [
      { id: "s1", rd_deal_id: "deal-1", status: "confirmed", user_id: "u1" },
      { id: "s2", rd_deal_id: "deal-2", status: "confirmed", user_id: "u1" },
      { id: "s3", rd_deal_id: null, status: "confirmed", user_id: "u1" },
      { id: "s4", rd_deal_id: "deal-4", status: "cancelled", user_id: "u1" },
    ];
    const rdDeals: RdDeal[] = [
      { rd_deal_id: "deal-1", rd_funnel_id: "f1" },
    ];

    expect(countOrphanSales(sales, rdDeals)).toBe(1); // apenas deal-2 é órfão
  });

  it("returns 0 when all confirmed sales have matching rd_deals", () => {
    const sales: Sale[] = [
      { id: "s1", rd_deal_id: "deal-1", status: "confirmed", user_id: "u1" },
    ];
    const rdDeals: RdDeal[] = [
      { rd_deal_id: "deal-1", rd_funnel_id: "f1" },
    ];

    expect(countOrphanSales(sales, rdDeals)).toBe(0);
  });

  it("ignores sales without rd_deal_id and non-confirmed status", () => {
    const sales: Sale[] = [
      { id: "s1", rd_deal_id: null, status: "confirmed", user_id: "u1" },
      { id: "s2", rd_deal_id: "deal-x", status: "pending", user_id: "u1" },
    ];
    const rdDeals: RdDeal[] = [];

    expect(countOrphanSales(sales, rdDeals)).toBe(0);
  });

  it("handles empty lists", () => {
    expect(countOrphanSales([], [])).toBe(0);
    expect(countOrphanSales(
      [{ id: "s1", rd_deal_id: "d1", status: "confirmed", user_id: "u1" }],
      [],
    )).toBe(1);
  });
});
