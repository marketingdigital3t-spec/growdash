import { aggregateSales, type Sale } from "@/hooks/useSales";

export interface ExpertResultMetrics {
  revenue: number;
  sales: number;
  conversion: number | null;
}

/**
 * Uses the same confirmed, deduplicated sales aggregation as Commercial and
 * Finance so the operation panel cannot show a different result for the same
 * account and period.
 */
export function buildExpertResultMetrics(
  sales: Sale[],
  leads: number,
  leadsAvailable: boolean,
): ExpertResultMetrics {
  const totals = aggregateSales(sales);
  return {
    revenue: totals.totalNet,
    sales: totals.totalQuantity,
    conversion: !leadsAvailable ? null : leads > 0 ? (totals.totalQuantity / leads) * 100 : 0,
  };
}
