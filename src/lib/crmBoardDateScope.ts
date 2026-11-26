import { saoPauloDayBounds, isCanonicalWonDeal } from "@/lib/canonicalMetrics";

export interface BoardScopedDeal {
  win?: boolean | null;
  rd_stage_name?: string | null;
  stage_bucket?: string | null;
  lost_reason?: string | null;
  lead_created_at?: string | null;
  closed_at?: string | null;
  stage_updated_at?: string | null;
}

/** Um negócio é terminal quando foi ganho ou perdido no RD Station. */
export function isTerminalBoardDeal(deal: BoardScopedDeal): boolean {
  if (isCanonicalWonDeal(deal)) return true;
  return deal.stage_bucket === "lost"
    || deal.stage_bucket === "disqualified"
    || Boolean(deal.lost_reason);
}

/**
 * Regra de escopo de data do pipeline do CRM, espelhando o RD Station:
 *
 * - Negócios terminais (Venda Realizada e Perdido) pertencem ao período pela
 *   data de fechamento (`closed_at`). Um lead que chegou mês passado e
 *   fechou neste mês precisa contar como venda deste mês.
 * - Negócios em aberto pertencem ao período pela data de criação
 *   (`lead_created_at`).
 */
export function dealBelongsToBoardPeriod(
  deal: BoardScopedDeal,
  startDate: Date,
  endDate: Date,
): boolean {
  const bounds = saoPauloDayBounds(startDate, endDate);
  const start = bounds.start.getTime();
  const end = bounds.end.getTime();
  const inRange = (value: string | null | undefined) => {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
  };

  if (isTerminalBoardDeal(deal)) return inRange(deal.closed_at);
  return inRange(deal.lead_created_at);
}
