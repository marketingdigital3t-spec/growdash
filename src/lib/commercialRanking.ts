import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { Sale } from "@/hooks/useSales";

export interface CommercialSaleRow {
  sale: Sale;
  seller: string;
  commission: number;
  product: string;
}

export interface CommercialAccountOption {
  id: string;
  name: string;
}

export interface CommercialSellerRanking {
  seller: string;
  revenue: number;
  count: number;
  commission: number;
  performance: number;
  share: number;
}

export interface CommercialAccountRanking {
  accountId: string;
  accountName: string;
  /** Accounts contributing to this aggregate. A single account keeps one id. */
  accountIds?: string[];
  target: number;
  totalRevenue: number;
  totalCount: number;
  sellers: CommercialSellerRanking[];
  leader: CommercialSellerRanking | null;
  recovery: CommercialSellerRanking[];
}

interface BuildInput {
  sales: CommercialSaleRow[];
  deals: RDDealLite[];
  accounts: CommercialAccountOption[];
  goals?: Map<string, number>;
}

export interface CommercialExpertLink {
  expertId: string;
  expertName: string;
  adAccountId: string;
}

export interface CommercialExpertRanking extends CommercialAccountRanking {
  expertId: string | null;
}

/** Builds account-isolated rankings using only confirmed sale revenue. */
export function buildCommercialAccountRankings({ sales, deals, accounts, goals = new Map() }: BuildInput): CommercialAccountRanking[] {
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const accountIds = new Set(accounts.map((account) => account.id));
  const rowsByAccount = new Map<string, CommercialSaleRow[]>();
  const dealOwnersByAccount = new Map<string, Set<string>>();

  for (const row of sales) {
    const accountId = row.sale.ad_account_id || "unassigned";
    accountIds.add(accountId);
    const rows = rowsByAccount.get(accountId) || [];
    rows.push(row);
    rowsByAccount.set(accountId, rows);
  }
  for (const deal of deals) {
    const accountId = deal.ad_account_id || "unassigned";
    accountIds.add(accountId);
    if (!deal.deal_owner_name) continue;
    const owners = dealOwnersByAccount.get(accountId) || new Set<string>();
    owners.add(deal.deal_owner_name);
    dealOwnersByAccount.set(accountId, owners);
  }

  return Array.from(accountIds)
    .map((accountId): CommercialAccountRanking => {
      const rows = rowsByAccount.get(accountId) || [];
      const sellers = new Map<string, { revenue: number; count: number; commission: number }>();
      for (const name of dealOwnersByAccount.get(accountId) || []) sellers.set(name, { revenue: 0, count: 0, commission: 0 });
      for (const row of rows) {
        const current = sellers.get(row.seller) || { revenue: 0, count: 0, commission: 0 };
        if (row.sale.status === "confirmed") {
          current.revenue += Number(row.sale.net_revenue || 0);
          current.count += Number(row.sale.quantity || 1);
          current.commission += row.commission;
        }
        sellers.set(row.seller, current);
      }

      const totalRevenue = Array.from(sellers.values()).reduce((sum, seller) => sum + seller.revenue, 0);
      const totalCount = Array.from(sellers.values()).reduce((sum, seller) => sum + seller.count, 0);
      const target = Number(goals.get(accountId) || 0);
      const ranked = Array.from(sellers, ([seller, values]) => ({
        seller,
        ...values,
        share: totalRevenue > 0 ? (values.revenue / totalRevenue) * 100 : 0,
        performance: target > 0
          ? (values.revenue / target) * 100
          : totalRevenue > 0 ? (values.revenue / totalRevenue) * 100 : 0,
      })).sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.seller.localeCompare(b.seller, "pt-BR"));

      return {
        accountId,
        accountName: accountNames.get(accountId) || (accountId === "unassigned" ? "Sem conta de anúncio" : accountId),
        accountIds: accountId === "unassigned" ? [] : [accountId],
        target,
        totalRevenue,
        totalCount,
        sellers: ranked,
        leader: ranked[0] || null,
        recovery: ranked.filter((seller) => seller.performance < 50),
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue || a.accountName.localeCompare(b.accountName, "pt-BR"));
}

/** Aggregates account rankings into explicit expert groups, keeping unlinked accounts visible. */
export function buildCommercialExpertRankings(
  accountRankings: CommercialAccountRanking[],
  links: CommercialExpertLink[],
): CommercialExpertRanking[] {
  const accountToExpert = new Map(links.map((link) => [link.adAccountId, link]));
  const grouped = new Map<string, { expertId: string | null; expertName: string; accounts: CommercialAccountRanking[] }>();

  for (const account of accountRankings) {
    const link = accountToExpert.get(account.accountId);
    const key = link?.expertId || "unassigned";
    const current = grouped.get(key) || {
      expertId: link?.expertId || null,
      expertName: link?.expertName || "Sem expert",
      accounts: [],
    };
    current.accounts.push(account);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map(({ expertId, expertName, accounts }): CommercialExpertRanking => {
    const sellerMap = new Map<string, { revenue: number; count: number; commission: number }>();
    for (const account of accounts) {
      for (const seller of account.sellers) {
        const current = sellerMap.get(seller.seller) || { revenue: 0, count: 0, commission: 0 };
        current.revenue += seller.revenue;
        current.count += seller.count;
        current.commission += seller.commission;
        sellerMap.set(seller.seller, current);
      }
    }
    const totalRevenue = Array.from(sellerMap.values()).reduce((sum, seller) => sum + seller.revenue, 0);
    const totalCount = Array.from(sellerMap.values()).reduce((sum, seller) => sum + seller.count, 0);
    const target = accounts.reduce((sum, account) => sum + account.target, 0);
    const sellers = Array.from(sellerMap, ([seller, values]) => ({
      seller,
      ...values,
      share: totalRevenue > 0 ? (values.revenue / totalRevenue) * 100 : 0,
      performance: target > 0 ? (values.revenue / target) * 100 : totalRevenue > 0 ? (values.revenue / totalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.seller.localeCompare(b.seller, "pt-BR"));
    return {
      accountId: expertId ? `expert:${expertId}` : "expert:unassigned",
      accountName: expertName,
      accountIds: accounts.flatMap((account) => account.accountIds || [account.accountId]).filter((id) => id !== "unassigned"),
      target,
      totalRevenue,
      totalCount,
      sellers,
      leader: sellers[0] || null,
      recovery: sellers.filter((seller) => seller.performance < 50),
      expertId,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue || a.accountName.localeCompare(b.accountName, "pt-BR"));
}

/** Produces the company-wide seller ranking from all expert groups. */
export function buildCommercialGlobalRanking(expertRankings: CommercialExpertRanking[]): CommercialExpertRanking {
  const sellerMap = new Map<string, { revenue: number; count: number; commission: number }>();
  for (const expert of expertRankings) {
    for (const seller of expert.sellers) {
      const current = sellerMap.get(seller.seller) || { revenue: 0, count: 0, commission: 0 };
      current.revenue += seller.revenue;
      current.count += seller.count;
      current.commission += seller.commission;
      sellerMap.set(seller.seller, current);
    }
  }
  const totalRevenue = Array.from(sellerMap.values()).reduce((sum, seller) => sum + seller.revenue, 0);
  const totalCount = Array.from(sellerMap.values()).reduce((sum, seller) => sum + seller.count, 0);
  const target = expertRankings.reduce((sum, expert) => sum + expert.target, 0);
  const sellers = Array.from(sellerMap, ([seller, values]) => ({
    seller,
    ...values,
    share: totalRevenue > 0 ? (values.revenue / totalRevenue) * 100 : 0,
    performance: target > 0 ? (values.revenue / target) * 100 : totalRevenue > 0 ? (values.revenue / totalRevenue) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.seller.localeCompare(b.seller, "pt-BR"));
  return {
    accountId: "global",
    accountName: "Ranking global da empresa",
    accountIds: expertRankings.flatMap((expert) => expert.accountIds || []),
    target,
    totalRevenue,
    totalCount,
    sellers,
    leader: sellers[0] || null,
    recovery: sellers.filter((seller) => seller.performance < 50),
    expertId: null,
  };
}
