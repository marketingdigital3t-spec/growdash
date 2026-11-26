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

export type McpLeadCursor = { firstReceivedAt: string; id: string };

function isCursorTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeMcpCursor(cursor: McpLeadCursor) {
  if (!isValidUuid(cursor.id) || !isCursorTimestamp(cursor.firstReceivedAt)) throw new Error("INVALID_MCP_CURSOR");
  return base64UrlEncode(JSON.stringify({ v: 1, first_received_at: cursor.firstReceivedAt, id: cursor.id }));
}

export function decodeMcpCursor(value: unknown): McpLeadCursor | null {
  if (typeof value !== "string" || value.length < 8 || value.length > 1024) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(value));
    if (parsed?.v !== 1 || !isValidUuid(parsed.id) || !isCursorTimestamp(parsed.first_received_at)) return null;
    return { firstReceivedAt: parsed.first_received_at, id: parsed.id };
  } catch {
    return null;
  }
}

function zonedBoundary(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day);
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant.getTime();
  };
  let resolved = new Date(localAsUtc - offsetAt(new Date(localAsUtc)));
  resolved = new Date(localAsUtc - offsetAt(resolved));
  return resolved.toISOString();
}

export function civilDateRangeToUtc(startDate: string, endDate: string, timeZone = "America/Sao_Paulo") {
  if (!isValidDateRange(startDate, endDate)) throw new Error("INVALID_CIVIL_DATE_RANGE");
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); } catch { throw new Error("INVALID_TIMEZONE"); }
  const nextDate = new Date(`${endDate}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return { start: zonedBoundary(startDate, timeZone), endExclusive: zonedBoundary(nextDate.toISOString().slice(0, 10), timeZone) };
}
