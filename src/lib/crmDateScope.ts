import { endOfDay, startOfDay } from "date-fns";

type PeriodScopedDeal = {
  lead_created_at?: string | null;
  stage_updated_at?: string | null;
  closed_at?: string | null;
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
  if (isWithinRange(deal.lead_created_at, startDate, endDate)) return true;
  if (isWithinRange(deal.closed_at, startDate, endDate)) return true;
  return !deal.lead_created_at && !deal.closed_at && isWithinRange(deal.stage_updated_at, startDate, endDate);
}
