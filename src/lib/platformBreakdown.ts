import type { Sale } from "@/hooks/useSales";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { PlatformRule } from "@/hooks/usePlatformRules";
import { dedupeCanonicalSales } from "@/lib/canonicalSales";
import { dedupeRDDeals } from "@/hooks/useRDDealsForPeriod";
import { inferPlatform, inferPlatformWithDealFallback, PLATFORM_LABELS, type TopPlatform } from "@/lib/platformInference";
import { isCanonicalWonDeal } from "@/lib/canonicalMetrics";
import { getRDDealAmount } from "@/lib/rdDealAmount";

export type PlatformBreakdownRow = {
  key: TopPlatform;
  name: string;
  leads: number;
  sales: number;
  revenue: number;
  conv: number;
};

export function buildPlatformBreakdown({
  metaLeads,
  rdDeals,
  revenueDeals,
  sales,
  platformRules,
}: {
  metaLeads: number;
  rdDeals: RDDealLite[];
  revenueDeals?: RDDealLite[];
  sales: Sale[];
  platformRules: PlatformRule[];
}): PlatformBreakdownRow[] {
  const rows: Record<TopPlatform, Omit<PlatformBreakdownRow, "key" | "name" | "conv">> = {
    meta: { leads: Math.max(0, Number(metaLeads || 0)), sales: 0, revenue: 0 },
    google: { leads: 0, sales: 0, revenue: 0 },
    organic: { leads: 0, sales: 0, revenue: 0 },
    unknown: { leads: 0, sales: 0, revenue: 0 },
  };
  const canonicalDeals = dedupeRDDeals(rdDeals);
  const canonicalRevenueDeals = dedupeRDDeals(revenueDeals ?? canonicalDeals).filter(isCanonicalWonDeal);
  const dealsByRdId = new Map(canonicalDeals.map((deal) => [deal.rd_deal_id, deal]));
  canonicalDeals.forEach((deal) => {
    const platform = inferPlatform(deal, platformRules).platform;
    if (platform === "meta" || platform === "unknown") return;
    rows[platform].leads += 1;
  });
  const canonicalSales = dedupeCanonicalSales(sales);
  const confirmedSaleIds = new Set(
    canonicalSales
      .filter((sale) => sale.status === "confirmed" && sale.rd_deal_id)
      .map((sale) => String(sale.rd_deal_id)),
  );
  canonicalSales.forEach((sale) => {
    if (sale.status !== "confirmed") return;
    const platform = inferPlatformWithDealFallback(sale, dealsByRdId, platformRules).platform;
    rows[platform].sales += Math.max(1, Number(sale.quantity || 1));
    rows[platform].revenue += Number(sale.net_revenue || 0);
  });
  // RD is the canonical source for won deals. A realtime sync can persist the
  // deal before the legacy `sales` materialization, so fill that gap here
  // instead of showing revenue in a KPI and “no sales” in the chart.
  canonicalRevenueDeals.forEach((deal) => {
    const dealId = String(deal.rd_deal_id || "");
    if (!isCanonicalWonDeal(deal) || !dealId || confirmedSaleIds.has(dealId)) return;
    const platform = inferPlatform(deal, platformRules).platform;
    rows[platform].sales += 1;
    rows[platform].revenue += getRDDealAmount(deal);
  });
  return (Object.keys(rows) as TopPlatform[])
    .map((key) => ({ key, name: PLATFORM_LABELS[key], ...rows[key], conv: rows[key].leads > 0 ? (rows[key].sales / rows[key].leads) * 100 : 0 }))
    .filter((row) => row.key !== "unknown" || row.sales > 0 || row.revenue > 0)
    .sort((a, b) => (b.revenue - a.revenue) || (b.leads - a.leads));
}
