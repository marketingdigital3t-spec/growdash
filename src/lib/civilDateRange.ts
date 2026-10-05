export type CivilDateRange = { startDate: string; endDate: string };

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseCivilDateRange(startDate: unknown, endDate: unknown): CivilDateRange {
  if (!isCivilDate(startDate) || !isCivilDate(endDate)) {
    throw new Error("startDate e endDate devem ser datas civis válidas no formato YYYY-MM-DD.");
  }
  if (startDate > endDate) throw new Error("startDate não pode ser posterior a endDate.");
  return { startDate, endDate };
}
