import { format, subMonths } from "date-fns";

/**
 * Meta rejects requests whose initial date is more than 37 months old. We use
 * 36 completed months as a safety margin so a manual reconciliation is valid
 * regardless of the current day or the account timezone.
 */
export function getMetaSyncRange(now = new Date(), requestedStart?: Date, requestedEnd?: Date) {
  const oldestAllowed = subMonths(now, 36);
  const start = requestedStart && requestedStart > oldestAllowed ? requestedStart : oldestAllowed;
  const end = requestedEnd && requestedEnd < now ? requestedEnd : now;
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}
