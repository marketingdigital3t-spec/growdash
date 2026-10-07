import { getRDDealAmount } from "@/lib/rdDealAmount";
import { canonicalWonDealIds, canonicalWonDeals } from "@/lib/canonicalMetrics";

export interface RevenueSale {
  id?: string;
  status: string;
  rd_deal_id: string | null;
  source_provider?: string | null;
  source_record_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  gross_revenue: number;
  net_revenue: number;
  tax_amount: number;
  refund_amount: number;
  chargeback_amount: number;
  payment_method: string;
  quantity: number;
}

export function normalizeRevenuePaymentMethod(value: string | null | undefined): "pix" | "cartao" | "boleto" | "outros" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("pix")) return "pix";
  if (normalized.includes("boleto") || normalized.includes("bank_slip") || normalized.includes("slip")) return "boleto";
  if (normalized.includes("cart") || normalized.includes("card") || normalized.includes("credit") || normalized.includes("debit")) return "cartao";
  return "outros";
}

function dedupeRevenueSales<T extends RevenueSale>(rows: T[]) {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = row.rd_deal_id?.trim()
      ? `rd:${row.rd_deal_id.trim()}`
      : row.source_provider && row.source_record_id
        ? `source:${row.source_provider.toLowerCase()}:${row.source_record_id}`
        : row.id ? `sale:${row.id}` : `anonymous:${unique.size}`;
    const current = unique.get(key);
    const rowTime = new Date(row.updated_at || row.created_at || 0).getTime();
    const currentTime = current ? new Date(current.updated_at || current.created_at || 0).getTime() : -Infinity;
    if (!current || rowTime >= currentTime) unique.set(key, row);
  }
  return Array.from(unique.values());
}

export interface RDRevenueDeal {
  rd_deal_id: string;
  rd_connection_id?: string | null;
  ad_account_id?: string | null;
  amount_total: number | null;
  amount_total_effective?: number | null;
  win: boolean;
  rd_stage_name: string | null;
}

/**
 * Consolida receita realizada do financeiro e do RD Station sem duplicar a
 * mesma negociação. O RD só fornece o valor total do negócio; por isso taxas,
 * impostos, estornos e chargebacks seguem vindo exclusivamente de `sales`.
 */
export function aggregateRevenueSources(sales: RevenueSale[], rdDeals: RDRevenueDeal[] = []) {
  // Quantidade de vendas realizadas é um fato do RD, não da tabela financeira.
  // `sales` continua fornecendo receita, impostos, reembolsos e chargebacks,
  // mas linhas confirmadas sem uma negociação RD não entram no KPI de vendas.
  const canonicalSales = dedupeRevenueSales(sales);
  const canonicalRDDeals = canonicalWonDeals(rdDeals);
  const wonDealIds = canonicalWonDealIds(rdDeals);
  const confirmed = canonicalSales.filter((sale) => sale.status === "confirmed" && (!sale.rd_deal_id || wonDealIds.has(sale.rd_deal_id)));
  const salesTotals = {
    totalGross: confirmed.reduce((sum, sale) => sum + Number(sale.gross_revenue || 0), 0),
    totalNet: confirmed.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    totalTax: confirmed.reduce((sum, sale) => sum + Number(sale.tax_amount || 0), 0),
    totalRefund: canonicalSales.reduce((sum, sale) => sum + Number(sale.refund_amount || 0), 0),
    totalChargeback: canonicalSales.reduce((sum, sale) => sum + Number(sale.chargeback_amount || 0), 0),
    totalQuantity: confirmed.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
    pendingRevenue: canonicalSales.filter((sale) => sale.status === "pending" || (normalizeRevenuePaymentMethod(sale.payment_method) === "boleto" && sale.status !== "confirmed")).reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    receivables: canonicalSales.filter((sale) => normalizeRevenuePaymentMethod(sale.payment_method) === "boleto" && sale.status === "pending").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    byPayment: {
      pix: confirmed.filter((sale) => normalizeRevenuePaymentMethod(sale.payment_method) === "pix").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
      cartao: confirmed.filter((sale) => normalizeRevenuePaymentMethod(sale.payment_method) === "cartao").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
      boleto: confirmed.filter((sale) => normalizeRevenuePaymentMethod(sale.payment_method) === "boleto").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
      outros: confirmed.filter((sale) => normalizeRevenuePaymentMethod(sale.payment_method) === "outros").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0),
    },
  };
  const refundRate = salesTotals.totalGross > 0 ? (salesTotals.totalRefund / salesTotals.totalGross) * 100 : 0;
  const chargebackRate = salesTotals.totalGross > 0 ? (salesTotals.totalChargeback / salesTotals.totalGross) * 100 : 0;
  const realizedSaleDealIds = new Set(
    canonicalSales
      .filter((sale) => sale.status === "confirmed" && sale.rd_deal_id)
      .map((sale) => sale.rd_deal_id as string),
  );
  const realizedWonDealIds = new Set([...realizedSaleDealIds].filter((id) => wonDealIds.has(id)));
  const confirmedWithoutRD = confirmed.filter((sale) => !sale.rd_deal_id);
  const includedDealIds = new Set<string>();
  const rdOnlyWonDeals = canonicalRDDeals.filter((deal) => {
    const dealId = deal.rd_deal_id?.trim();
    const dealKey = `${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${dealId || ""}`;
    const amount = getRDDealAmount(deal);
    if (!dealId || !Number.isFinite(amount)) return false;
    if (realizedSaleDealIds.has(dealId) || includedDealIds.has(dealKey)) return false;
    includedDealIds.add(dealKey);
    return true;
  });
  const rdOnlyRevenue = rdOnlyWonDeals.reduce((total, deal) => total + getRDDealAmount(deal), 0);
  const rdOnlyCount = rdOnlyWonDeals.length;
  const rdWonDealsCount = canonicalRDDeals.length;
  return {
    ...salesTotals,
    totalGross: salesTotals.totalGross + rdOnlyRevenue,
    totalNet: salesTotals.totalNet + rdOnlyRevenue,
    totalQuantity: rdWonDealsCount,
    rdOnlyRevenue,
    rdOnlyCount,
    // Deliberadamente não inclui `sales.quantity`: uma venda financeira sem
    // vínculo RD não pode alterar a quantidade oficial de vendas realizadas.
    confirmedSalesCount: rdWonDealsCount,
    rdWonDealsCount,
    refundRate,
    chargebackRate,
    arpu: rdWonDealsCount > 0 ? (salesTotals.totalNet + rdOnlyRevenue) / rdWonDealsCount : 0,
  };
}
