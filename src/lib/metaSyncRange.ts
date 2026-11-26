import { subMonths } from "date-fns";
import { businessDateKey } from "@/lib/businessDate";

/** Graph API accepts a maximum lookback of roughly 37 months. Keep one month
 * of safety so every connected account can use the same calendar scope. */
export const META_MAX_LOOKBACK_MONTHS = 36;

/**
 * Meta rejects requests whose initial date is more than 37 months old. We use
 * 36 completed months as a safety margin so a manual reconciliation is valid
 * regardless of the current day or the account timezone.
 */
export function getMetaSyncRange(now = new Date(), requestedStart?: Date, requestedEnd?: Date) {
  const oldestAllowed = subMonths(now, META_MAX_LOOKBACK_MONTHS);
  const start = requestedStart && requestedStart > oldestAllowed ? requestedStart : oldestAllowed;
  const end = requestedEnd && requestedEnd < now ? requestedEnd : now;
  return {
    startDate: businessDateKey(start),
    endDate: businessDateKey(end),
  };
}
