import { describe, expect, it } from "vitest";
import { buildCommercialAccountRankings } from "@/lib/commercialRanking";

const sale = (id: string, account: string, seller: string, revenue: number, status = "confirmed") => ({
  sale: { id, ad_account_id: account, status, net_revenue: revenue, quantity: 1 } as any,
  seller,
  commission: 0,
  product: "Produto",
});

describe("buildCommercialAccountRankings", () => {
  it("separa o líder por conta de anúncio e inclui responsáveis sem venda", () => {
    const result = buildCommercialAccountRankings({
      accounts: [{ id: "meta-a", name: "Conta Meta A" }, { id: "meta-b", name: "Conta Meta B" }],
      goals: new Map([["meta-a", 10_000], ["meta-b", 20_000]]),
      deals: [
        { ad_account_id: "meta-a", deal_owner_name: "Day" } as any,
        { ad_account_id: "meta-b", deal_owner_name: "Rafa" } as any,
      ],
      sales: [
        sale("1", "meta-a", "Gabi", 7_500),
        sale("2", "meta-a", "Aline", 3_000),
        sale("3", "meta-b", "Aline", 5_000),
      ],
    });

    expect(result.map((account) => account.accountId)).toEqual(["meta-a", "meta-b"]);
    expect(result[0].leader?.seller).toBe("Gabi");
    expect(result[0].leader?.performance).toBe(75);
    expect(result[0].sellers.find((seller) => seller.seller === "Day")?.revenue).toBe(0);
    expect(result[0].recovery.map((seller) => seller.seller)).toContain("Day");
    expect(result[1].leader?.seller).toBe("Aline");
  });

  it("usa participação da receita quando a conta não possui meta configurada", () => {
    const [account] = buildCommercialAccountRankings({
      accounts: [{ id: "meta-a", name: "Conta Meta A" }],
      sales: [sale("1", "meta-a", "Gabi", 75), sale("2", "meta-a", "Aline", 25)],
      deals: [],
    });
    expect(account.leader?.performance).toBe(75);
    expect(account.target).toBe(0);
  });
});
