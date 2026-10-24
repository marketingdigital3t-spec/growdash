import { describe, expect, it } from "vitest";
import { buildCommercialAccountRankings, buildCommercialExpertRankings, buildCommercialGlobalRanking, resolveCommercialSaleAttribution } from "@/lib/commercialRanking";

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

  it("consolida contas por expert e mantém contas sem vínculo", () => {
    const accounts = buildCommercialAccountRankings({
      accounts: [{ id: "a", name: "Conta A" }, { id: "b", name: "Conta B" }, { id: "c", name: "Conta C" }],
      sales: [sale("1", "a", "Gabi", 100), sale("2", "b", "Gabi", 50), sale("3", "c", "Aline", 25)],
      deals: [],
    });
    const experts = buildCommercialExpertRankings(accounts, [{ expertId: "e1", expertName: "Expert 1", adAccountId: "a" }, { expertId: "e1", expertName: "Expert 1", adAccountId: "b" }]);
    expect(experts.map((expert) => expert.accountName)).toEqual(["Expert 1", "Sem expert"]);
    expect(experts[0].totalRevenue).toBe(150);
    expect(experts[0].leader?.seller).toBe("Gabi");
    expect(experts[1].leader?.seller).toBe("Aline");
  });

  it("gera o ranking global com empate determinístico e ignora vendas pendentes", () => {
    const accounts = buildCommercialAccountRankings({
      accounts: [{ id: "a", name: "Conta A" }, { id: "b", name: "Conta B" }],
      sales: [sale("1", "a", "Bia", 100), sale("2", "b", "Ana", 100), sale("3", "b", "Ana", 20, "pending")],
      deals: [],
    });
    const global = buildCommercialGlobalRanking(buildCommercialExpertRankings(accounts, []));
    expect(global.totalRevenue).toBe(200);
    expect(global.sellers.map((seller) => seller.seller)).toEqual(["Ana", "Bia"]);
    expect(global.sellers.find((seller) => seller.seller === "Ana")?.count).toBe(1);
  });

  it("prioriza o responsável RD e atribui venda sem conta pelo funil selecionado", () => {
    const sale = { id: "sale-rd", ad_account_id: null, rd_deal_id: "deal-1", rd_funnel_id: "funnel-1", custom_fields: { vendedor: "Vendedor manual" } } as any;
    const result = resolveCommercialSaleAttribution(sale, {
      dealById: new Map([["deal-1", { ad_account_id: null, rd_funnel_id: "funnel-1", deal_owner_name: "Responsável RD" }]]),
      funnelAccountByProviderId: new Map(),
      selectedAccountIds: ["account-a"],
      resolvedFunnelIds: new Set(["funnel-1"]),
    });
    expect(result).toEqual({ seller: "Responsável RD", accountId: "account-a" });
  });

  it("não inventa conta quando o funil sem conta é ambíguo", () => {
    const result = resolveCommercialSaleAttribution({ id: "sale", ad_account_id: null, rd_deal_id: "deal", rd_funnel_id: "funnel" } as any, {
      dealById: new Map([["deal", { ad_account_id: null, rd_funnel_id: "funnel", deal_owner_name: null }]]),
      funnelAccountByProviderId: new Map(),
      selectedAccountIds: ["account-a", "account-b"],
      resolvedFunnelIds: new Set(["funnel"]),
    });
    expect(result.accountId).toBeNull();
    expect(result.seller).toBe("Não informado");
  });
});
