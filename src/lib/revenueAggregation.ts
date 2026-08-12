import { isWonRDStageName } from "@/lib/rdDealStatus";

export interface RevenueSale {
  status: string;
  rd_deal_id: string | null;
  gross_revenue: number;
  net_revenue: number;
  tax_amount: number;
  refund_amount: number;
  chargeback_amount: number;
  payment_method: string;
  quantity: number;
}

export interface RDRevenueDeal {
  rd_deal_id: string;
  amount_total: number | null;
  win: boolean;
  rd_stage_name: string | null;
}

/**
 * Consolida receita realizada do financeiro e do RD Station sem duplicar a
 * mesma negociação. O RD só fornece o valor total do negócio; por isso taxas,
 * impostos, estornos e chargebacks seguem vindo exclusivamente de `sales`.
 */
export function aggregateRevenueSources(sales: RevenueSale[], rdDeals: RDRevenueDeal[] = []) {
  const confirmed = sales.filter((sale) => sale.status === "confirmed");
  const salesTotals = {
    totalGross: confirmed.reduce((sum, sale) => sum + Number(sale.gross_revenue || 0), 0),
    totalNet: confirmed.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    totalTax: confirmed.reduce((sum, sale) => sum + Number(sale.tax_amount || 0), 0),
    totalRefund: sales.reduce((sum, sale) => sum + Number(sale.refund_amount || 0), 0),
    totalChargeback: sales.reduce((sum, sale) => sum + Number(sale.chargeback_amount || 0), 0),
    totalQuantity: confirmed.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
    pendingRevenue: sales.filter((sale) => sale.status === "pending" || (sale.payment_method === "boleto" && sale.status !== "confirmed")).reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    receivables: sales.filter((sale) => sale.payment_method === "boleto" && sale.status === "pending").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    byPayment: {
      pix: confirmed.filter((sale) => sale.payment_method === "pix").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
      cartao: confirmed.filter((sale) => sale.payment_method === "cartao").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
      boleto: confirmed.filter((sale) => sale.payment_method === "boleto").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
      outros: confirmed.filter((sale) => sale.payment_method === "outros").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    },
  };
  const refundRate = salesTotals.totalGross > 0 ? (salesTotals.totalRefund / salesTotals.totalGross) * 100 : 0;
  const chargebackRate = salesTotals.totalGross > 0 ? (salesTotals.totalChargeback / salesTotals.totalGross) * 100 : 0;
  const realizedSaleDealIds = new Set(
    sales
      .filter((sale) => sale.status === "confirmed" && sale.rd_deal_id)
      .map((sale) => sale.rd_deal_id as string),
  );
  const includedDealIds = new Set<string>();
  const rdOnlyWonDeals = rdDeals.filter((deal) => {
    const dealId = deal.rd_deal_id?.trim();
    const amount = Number(deal.amount_total ?? 0);
    if (!dealId || !Number.isFinite(amount) || amount <= 0) return false;
    if (!deal.win && !isWonRDStageName(deal.rd_stage_name)) return false;
    if (realizedSaleDealIds.has(dealId) || includedDealIds.has(dealId)) return false;
    includedDealIds.add(dealId);
    return true;
  });
  const rdOnlyRevenue = rdOnlyWonDeals.reduce((total, deal) => total + Number(deal.amount_total), 0);
  const rdOnlyCount = rdOnlyWonDeals.length;
  return {
    ...salesTotals,
    totalGross: salesTotals.totalGross + rdOnlyRevenue,
    totalNet: salesTotals.totalNet + rdOnlyRevenue,
    totalQuantity: salesTotals.totalQuantity + rdOnlyCount,
    rdOnlyRevenue,
    rdOnlyCount,
    confirmedSalesCount: salesTotals.totalQuantity + rdOnlyCount,
    refundRate,
    chargebackRate,
    arpu: salesTotals.totalQuantity > 0 ? salesTotals.totalNet / salesTotals.totalQuantity : 0,
  };
}
