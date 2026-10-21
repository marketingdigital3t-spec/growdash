export const CRM_LEAD_STATUSES = ["new", "contacted", "qualified", "opportunity", "won", "lost", "archived"] as const;

export function isValidCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isValidDateRange(startDate: unknown, endDate: unknown) {
  return isValidCivilDate(startDate) && isValidCivilDate(endDate) && startDate <= endDate;
}

export function parseMcpLimit(value: unknown, fallback = 100) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 500) return null;
  return value;
}
