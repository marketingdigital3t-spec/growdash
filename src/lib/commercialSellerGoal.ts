/**
 * Painel de performance por vendedor do modulo comercial.
 *
 * Cada vendedor precisa de: quantas vendas fez, qual a meta, quanto falta em
 * percentual e quantas vendas ainda faltam para bater a meta. A ultima
 * informacao depende do ticket medio real do vendedor: sem o ticket nao ha
 * como converter um valor em numero de vendas.
 */

export interface SellerGoalInput {
  /** Nome do vendedor. */
  seller: string;
  /** Vendas realizadas no periodo. */
  salesCount: number;
  /** Receita liquida atribuida no periodo. */
  revenue: number;
  /** Meta de receita do vendedor no periodo, quando existe. */
  target?: number | null;
  /** Percentual de atingimento ja calculado pela plataforma. */
  performance?: number | null;
}

export interface SellerGoalResult {
  seller: string;
  salesCount: number;
  revenue: number;
  /** Ticket medio real: receita dividida pelas vendas. `null` sem vendas. */
  averageTicket: number | null;
  /** Meta em receita. `null` quando nao ha meta cadastrada. */
  target: number | null;
  /** Percentual para bater a meta. `null` quando nao ha meta. */
  goalPercentage: number | null;
  /** Quantas vendas ainda faltam para bater a meta. `null` sem base. */
  salesToGoal: number | null;
  /** Receita que ainda falta para bater a meta. */
  revenueToGoal: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Deriva a meta individual do vendedor a partir da meta da conta.
 *
 * A meta cadastrada e da conta de anuncios (e do expert que a responde). O
 * vendedor nao tem meta propria no banco, entao a fatia dele e proporcional
 * a participacao dele na receita da conta. Sem meta da conta, o vendedor
 * aparece sem meta — nunca com um numero inventado.
 */
export function deriveSellerTarget(
  sellerRevenue: number,
  accountTotalRevenue: number,
  accountTarget: number | null | undefined,
): number | null {
  if (!isFiniteNumber(accountTarget) || accountTarget <= 0) return null;
  if (!isFiniteNumber(sellerRevenue) || !isFiniteNumber(accountTotalRevenue) || accountTotalRevenue <= 0) return null;
  const share = sellerRevenue / accountTotalRevenue;
  return accountTarget * share;
}

/**
 * Calcula o painel de performance de um vendedor.
 *
 * - `salesToGoal` usa o ticket medio real do vendedor (`revenue / salesCount`).
 *   Sem vendas ja realizadas nao existe ticket, entao o numero fica `null`:
 *   e melhor dizer "sem base" do que chutar quantas vendas faltam.
 * - `goalPercentage` vem do `performance` da plataforma quando disponivel,
 *   senao e calculado sobre a meta.
 */
export function computeSellerGoal(input: SellerGoalInput): SellerGoalResult {
  const salesCount = isFiniteNumber(input.salesCount) ? Math.max(0, input.salesCount) : 0;
  const revenue = isFiniteNumber(input.revenue) ? input.revenue : 0;
  const target = isFiniteNumber(input.target) && input.target > 0 ? input.target : null;
  const averageTicket = salesCount > 0 && revenue !== 0 ? revenue / salesCount : null;

  const goalPercentage = isFiniteNumber(input.performance)
    ? input.performance
    : target && target > 0
      ? (revenue / target) * 100
      : null;

  const revenueToGoal = target !== null ? Math.max(0, target - revenue) : null;

  let salesToGoal: number | null = null;
  if (revenueToGoal !== null && revenueToGoal > 0 && averageTicket && averageTicket > 0) {
    salesToGoal = Math.ceil(revenueToGoal / averageTicket);
  } else if (revenueToGoal !== null && revenueToGoal === 0) {
    // Meta batida: nenhuma venda falta.
    salesToGoal = 0;
  }

  return {
    seller: input.seller,
    salesCount,
    revenue,
    averageTicket,
    target,
    goalPercentage,
    salesToGoal,
    revenueToGoal,
  };
}
