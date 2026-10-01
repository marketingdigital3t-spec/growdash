/**
 * Formats a Date as a calendar date in the business timezone. Date filters are
 * calendar values, not UTC instants, so this must be used for API scopes and
 * query keys instead of `toISOString().slice(0, 10)`.
 */
export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

export function businessDateKey(value: Date, timezone = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
