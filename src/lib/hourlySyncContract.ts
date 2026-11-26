export type HourlyFactKey = {
  ad_id: string;
  date: string;
  hour: number;
};

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function keyOf(row: HourlyFactKey) {
  return `${row.ad_id}|${row.date}|${row.hour}`;
}

/**
 * Meta can return a valid page with a date outside the requested civil range
 * when a breakdown request is stale or malformed. Never persist that page
 * under the current sync watermark.
 */
export function filterHourlyFactsByRange(
  rows: HourlyFactKey[],
  startDate: string,
  endDate: string,
) {
  const accepted: HourlyFactKey[] = [];
  const rejected: HourlyFactKey[] = [];
  for (const row of rows) {
    const valid = Boolean(
      row &&
      typeof row.ad_id === "string" &&
      row.ad_id.length > 0 &&
      typeof row.date === "string" &&
      CIVIL_DATE_RE.test(row.date) &&
      row.date >= startDate &&
      row.date <= endDate &&
      Number.isInteger(row.hour) &&
      row.hour >= 0 &&
      row.hour <= 23,
    );
    (valid ? accepted : rejected).push(row);
  }
  return { accepted, rejected };
}

export function missingHourlyFactKeys(expected: HourlyFactKey[], persisted: HourlyFactKey[]) {
  const persistedKeys = new Set(persisted.map(keyOf));
  return expected.filter((row) => !persistedKeys.has(keyOf(row)));
}

export function staleHourlyAdIds(existingAdIds: string[], incomingAdIds: string[]) {
  const incoming = new Set(incomingAdIds);
  return Array.from(new Set(existingAdIds)).filter((adId) => !incoming.has(adId));
}

