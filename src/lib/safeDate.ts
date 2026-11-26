/**
 * Parses provider timestamps only when they represent a plausible date.
 *
 * A few legacy Meta rows contain an epoch/zero timestamp (31/12/1969). That
 * value is technically parseable by JavaScript, but it is not a token expiry
 * or synchronization watermark and must never be presented as one.
 */
export function parsePlausibleDate(value: string | Date | null | undefined, minimumYear = 2000): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < minimumYear) return null;
  return date;
}

export function formatPlausibleDate(value: string | Date | null | undefined, formatDate: (date: Date) => string): string | null {
  const date = parsePlausibleDate(value);
  return date ? formatDate(date) : null;
}
