/** Parse provider money values without turning missing/invalid input into zero. */
export function parseLocaleAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/[^0-9,.-]/g, "");
  if (!raw || !/[0-9]/.test(raw)) return null;
  const sign = raw.startsWith("-") ? "-" : "";
  const unsigned = raw.replace(/^[+-]/, "");
  const comma = unsigned.lastIndexOf(",");
  const dot = unsigned.lastIndexOf(".");
  let normalized: string;
  if (comma >= 0 && dot >= 0) {
    const decimalIndex = Math.max(comma, dot);
    normalized = `${unsigned.slice(0, decimalIndex).replace(/[.,]/g, "")}.${unsigned.slice(decimalIndex + 1).replace(/[.,]/g, "")}`;
  } else if (comma >= 0) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if ((unsigned.match(/\./g) || []).length > 1) {
    const decimalIndex = dot;
    normalized = `${unsigned.slice(0, decimalIndex).replace(/\./g, "")}.${unsigned.slice(decimalIndex + 1)}`;
  } else {
    normalized = unsigned;
  }
  const parsed = Number(`${sign}${normalized}`);
  return Number.isFinite(parsed) ? parsed : null;
}
