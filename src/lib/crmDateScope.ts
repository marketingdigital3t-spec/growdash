import { isWonRDStageName } from "@/lib/rdDealStatus";
import { isCanonicalWonDealInPeriod, saoPauloDayBounds } from "@/lib/canonicalMetrics";

type PeriodScopedDeal = {
  win?: boolean | null;
  lead_created_at?: string | null;
  stage_updated_at?: string | null;
  closed_at?: string | null;
  rd_stage_name?: string | null;
};

function isWithinRange(value: string | null | undefined, startDate: Date, endDate: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  const bounds = saoPauloDayBounds(startDate, endDate);
  return Number.isFinite(timestamp)
    && timestamp >= bounds.start.getTime()
    && timestamp <= bounds.end.getTime();
}

/**
 * CRM totals need the same period rule for one account and the consolidated
 * view. A negotiation belongs to the interval when it was created there or
 * when it was closed there. Legacy rows without either operational date fall
 * back to their latest stage movement.
 */
export function isRDDealInCrmPeriod(deal: PeriodScopedDeal, startDate: Date, endDate: Date, includeHistory = false) {
  if (includeHistory) return true;
  // Won negotiations belong to the interval by their won date, not by the
  // original lead date. This keeps historical sales out of a monthly board.
  if (deal.win || isWonRDStageName(deal.rd_stage_name)) return isRDDealWonInCrmPeriod(deal, startDate, endDate, false);
  // Open and lost negotiations are scoped only by their creation date. A
  // later update or closing must not pull them into a different calendar.
  return isWithinRange(deal.lead_created_at, startDate, endDate);
}

/** A won KPI is scoped by the effective won date, never by lead creation. */
export function isRDDealWonInCrmPeriod(deal: PeriodScopedDeal, startDate: Date, endDate: Date, includeHistory = false) {
  if (includeHistory) return true;
  return isCanonicalWonDealInPeriod(deal, startDate, endDate);
}
