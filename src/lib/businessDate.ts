/**
 * Formats a Date as a calendar date in the business timezone. Date filters are
 * calendar values, not UTC instants, so this must be used for API scopes and
 * query keys instead of `toISOString().slice(0, 10)`.
 */
export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

/** Convert a YYYY-MM-DD calendar value to a stable instant for date-based
 * queries. The explicit offset prevents a UTC browser from turning the
 * selected São Paulo day into the previous business day. */
export function parseBusinessDate(value: string, timezone = BUSINESS_TIMEZONE): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Data civil inválida: ${value}`);
  if (timezone === BUSINESS_TIMEZONE) return new Date(`${value}T00:00:00-03:00`);
  // Noon UTC remains on the requested calendar date for all account timezones
  // supported by Meta and avoids host-machine timezone conversion.
  return new Date(`${value}T12:00:00Z`);
}

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

/**
 * Rebuild a business civil date as a host-local date for calendar widgets and
 * date-fns formatting. Stored/query dates remain YYYY-MM-DD via
 * `businessDateKey`; this Date is only a presentation/calendar adapter.
 * Noon avoids DST/midnight transitions in the browser's own timezone.
 */
export function businessCalendarDate(value: Date, timezone = BUSINESS_TIMEZONE): Date {
  const [year, month, day] = businessDateKey(value, timezone).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
