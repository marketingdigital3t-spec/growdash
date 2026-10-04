function calendarDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function subtractCalendarDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day - amount, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Meta can attribute or revise conversions after the day the ad was served.
 * Re-fetch the inclusive civil-date window covered by the account's configured
 * attribution lookback, plus today, on each incremental pass.
 */
export function resolveMetaLookbackDateRange(
  now: Date,
  timezone: string | null | undefined,
  attributionWindow: string | null | undefined,
) {
  const effectiveTimezone = timezone || "America/Sao_Paulo";
  const today = calendarDate(now, effectiveTimezone);
  const windows = Array.from(String(attributionWindow || "").matchAll(/(\d+)d_(?:click|view)/gi))
    .map((match) => Number(match[1]))
    .filter((days) => Number.isFinite(days) && days > 0);
  const lookbackDays = windows.length ? Math.max(...windows) : 7;
  return {
    startDate: subtractCalendarDays(today, lookbackDays),
    endDate: today,
    lookbackDays,
    timezone: effectiveTimezone,
  };
}
