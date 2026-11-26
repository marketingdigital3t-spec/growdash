export type ExpertResultSale = {
  net_revenue: number;
  quantity: number;
  status?: string | null;
};

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
  sales: ExpertResultSale[],
  leads: number,
  leadsAvailable: boolean,
): ExpertResultMetrics {
  // RD won deals arrive already deduplicated and confirmed. Legacy sales rows
  // still carry a status, so pending/canceled rows remain excluded here.
  const confirmed = sales.filter((sale) => !sale.status || sale.status === "confirmed");
  const revenue = confirmed.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
  const quantity = confirmed.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  return {
    revenue,
    sales: quantity,
    conversion: !leadsAvailable ? null : leads > 0 ? (quantity / leads) * 100 : 0,
  };
}
