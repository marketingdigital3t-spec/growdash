import { endOfDay, startOfDay } from "date-fns";
import { isWonRDStageName } from "@/lib/rdDealStatus";

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
  return Number.isFinite(timestamp)
    && timestamp >= startOfDay(startDate).getTime()
    && timestamp <= endOfDay(endDate).getTime();
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
  if (isWithinRange(deal.lead_created_at, startDate, endDate)) return true;
  if (isWithinRange(deal.closed_at, startDate, endDate)) return true;
  // RD integrations may not backfill closed_at for an already-won deal. Its
  // stage movement is the authoritative period fallback in that case.
  if ((deal.win || isWonRDStageName(deal.rd_stage_name)) && isWithinRange(deal.stage_updated_at, startDate, endDate)) return true;
  return !deal.lead_created_at && !deal.closed_at && isWithinRange(deal.stage_updated_at, startDate, endDate);
}

/** A won KPI is scoped by the effective won date, never by lead creation. */
export function isRDDealWonInCrmPeriod(deal: PeriodScopedDeal, startDate: Date, endDate: Date, includeHistory = false) {
  const won = Boolean(deal.win || isWonRDStageName(deal.rd_stage_name));
  if (!won) return false;
  if (includeHistory) return true;
  if (isWithinRange(deal.closed_at, startDate, endDate)) return true;
  return !deal.closed_at && isWithinRange(deal.stage_updated_at, startDate, endDate);
}
