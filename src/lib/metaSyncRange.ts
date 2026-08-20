import { format, subMonths } from "date-fns";

/**
 * Meta rejects requests whose initial date is more than 37 months old. We use
 * 36 completed months as a safety margin so a manual reconciliation is valid
 * regardless of the current day or the account timezone.
 */
export function getMetaSyncRange(now = new Date()) {
  return {
    startDate: format(subMonths(now, 36), "yyyy-MM-dd"),
    endDate: format(now, "yyyy-MM-dd"),
  };
}
