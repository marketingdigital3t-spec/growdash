export interface Sale {
  id: string;
  rd_deal_id: string | null;
  status: string;
  user_id: string;
}

export interface RdDeal {
  rd_deal_id: string;
  rd_funnel_id: string;
}

/**
 * Conta vendas confirmadas com rd_deal_id que não possuem deal
 * correspondente em rd_deals (vendas órfãs). Usado para validar a
 * reconciliação Meta ↔ RD: vendas confirmadas devem ter um negócio
 * correspondente no RD Station.
 */
export function countOrphanSales(sales: Sale[], rdDeals: RdDeal[]): number {
  const confirmedSalesWithRdId = sales.filter(
    (s) => s.status === "confirmed" && s.rd_deal_id,
  );
  const presentDealIds = new Set(rdDeals.map((d) => d.rd_deal_id));
  return confirmedSalesWithRdId.filter(
    (s) => !presentDealIds.has(s.rd_deal_id!),
  ).length;
}

/**
 * Verifica se a reconciliação Meta ↔ RD está saudável (sem vendas órfãs).
 */
export function isReconciliationHealthy(orphanCount: number): boolean {
  return orphanCount === 0;
}
