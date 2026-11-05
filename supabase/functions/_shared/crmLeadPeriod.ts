import { civilDateRangeToUtc } from "./mcpContract.ts";

/**
 * Converts optional inclusive civil-date filters into UTC bounds for CRM
 * timestamp columns. A one-sided filter remains one-sided; when both dates
 * are supplied the end bound is exclusive to avoid dropping the final day.
 */
export function crmLeadDateBounds(
  startDate?: string | null,
  endDate?: string | null,
  timeZone = "America/Sao_Paulo",
) {
  if (!startDate && !endDate) return { start: null, endExclusive: null };
  const range = civilDateRangeToUtc(startDate || endDate!, endDate || startDate!, timeZone);
  return {
    start: startDate ? range.start : null,
    endExclusive: endDate ? range.endExclusive : null,
  };
}
