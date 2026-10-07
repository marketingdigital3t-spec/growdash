import type { Sale } from "@/hooks/useSales";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { PlatformRule } from "@/hooks/usePlatformRules";
import { dedupeCanonicalSales } from "@/lib/canonicalSales";
import { dedupeRDDeals } from "@/hooks/useRDDealsForPeriod";
import { inferPlatform, inferPlatformWithDealFallback, PLATFORM_LABELS, type TopPlatform } from "@/lib/platformInference";

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
  sales,
  platformRules,
}: {
  metaLeads: number;
  rdDeals: RDDealLite[];
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
  const dealsByRdId = new Map(canonicalDeals.map((deal) => [deal.rd_deal_id, deal]));
  canonicalDeals.forEach((deal) => {
    const platform = inferPlatform(deal, platformRules).platform;
    if (platform === "meta" || platform === "unknown") return;
    rows[platform].leads += 1;
  });
  dedupeCanonicalSales(sales).forEach((sale) => {
    if (sale.status !== "confirmed") return;
    const platform = inferPlatformWithDealFallback(sale, dealsByRdId, platformRules).platform;
    rows[platform].sales += Math.max(1, Number(sale.quantity || 1));
    rows[platform].revenue += Number(sale.net_revenue || 0);
  });
  return (Object.keys(rows) as TopPlatform[])
    .map((key) => ({ key, name: PLATFORM_LABELS[key], ...rows[key], conv: rows[key].leads > 0 ? (rows[key].sales / rows[key].leads) * 100 : 0 }))
    .filter((row) => row.key !== "unknown" || row.sales > 0 || row.revenue > 0)
    .sort((a, b) => (b.revenue - a.revenue) || (b.leads - a.leads));
}
