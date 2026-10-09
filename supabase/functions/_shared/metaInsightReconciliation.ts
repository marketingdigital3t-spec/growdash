export type MetaDailyInsightKey = {
  date_start?: string | null;
  ad_id?: string | null;
};

export type MetaActionFactKey = { ad_id: string; date: string; action_type: string };
export type MetaActionDailySnapshot = { ad_id: string; date: string };

/** Civil dates covered by a sync, inclusive, without host-timezone drift. */
export function datesCoveredBySync(startDate: string, endDate: string): string[] {
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || startDate > endDate) return [];

  const dates: string[] = [];
  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
  return dates;
}

/** The selected inclusive period plus the trailing attribution-settlement window. */
export function syncRangeWithRollingWindow(
  selectedStart: string,
  selectedEnd: string,
  today: string,
  rollingDays = 3,
): { startDate: string; endDate: string; daysCovered: string[] } {
  const start = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || !Number.isInteger(rollingDays) || rollingDays < 0) {
    return { startDate: selectedStart, endDate: selectedEnd, daysCovered: datesCoveredBySync(selectedStart, selectedEnd) };
  }
  start.setUTCDate(start.getUTCDate() - rollingDays);
  const rollingStart = start.toISOString().slice(0, 10);
  // The supported sync window is contiguous in the existing Insights fetcher.
  // Use the hull of the selected interval and the trailing window so both are
  // refreshed by the same complete, paginated snapshot.
  const endDate = today;
  const startDate = selectedStart < rollingStart ? selectedStart : rollingStart;
  return { startDate: startDate > endDate ? endDate : startDate, endDate, daysCovered: datesCoveredBySync(startDate > endDate ? endDate : startDate, endDate) };
}

/**
 * Action facts are a snapshot per ad/day. When a completed Meta response no
 * longer contains an action type for an ad/day, remove that stale fact after
 * the replacement actions have been persisted and verified. Do not reconcile
 * ad/day pairs that were absent from the response.
 */
export function staleActionFactsForDailySnapshot(
  existing: MetaActionFactKey[],
  incoming: MetaActionFactKey[],
  snapshots: MetaActionDailySnapshot[],
): MetaActionFactKey[] {
  const snapshotKeys = new Set(snapshots.map((row) => `${row.ad_id}|${row.date}`));
  const incomingKeys = new Set(incoming.map((row) => `${row.ad_id}|${row.date}|${row.action_type}`));
  return existing.filter((row) => snapshotKeys.has(`${row.ad_id}|${row.date}`)
    && !incomingKeys.has(`${row.ad_id}|${row.date}|${row.action_type}`));
}

/**
 * Return only known account ads that are absent from a complete daily response.
 * Using a positive ID list for deletion avoids relying on PostgREST's `not.in`
 * filter serialization, which previously deleted the response's own ad facts.
 */
export function staleAdIdsForDailySnapshot(candidateAdIds: string[], incomingAdIds: Iterable<string>): string[] {
  const incoming = new Set(Array.from(incomingAdIds, String));
  return Array.from(new Set(candidateAdIds.map(String))).filter((adId) => !incoming.has(adId));
}

/**
 * An omitted day in a multi-day Insights response is ambiguous: it can mean
 * no delivery, Meta processing delay, or incomplete coverage. Do not use that
 * absence to delete a previously confirmed daily snapshot. Reconcile only
 * dates for which the completed response contains at least one ad row.
 */
export function datesSafeToReconcile(
  startDate: string,
  endDate: string,
  rows: MetaDailyInsightKey[],
): string[] {
  const datesWithRows = new Set(
    rows
      .filter((row) => typeof row.ad_id === "string" && row.ad_id.length > 0)
      .map((row) => row.date_start)
      .filter((date): date is string => typeof date === "string" && date >= startDate && date <= endDate),
  );

  const safeDates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || startDate > endDate) return safeDates;

  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (datesWithRows.has(date)) safeDates.push(date);
  }
  return safeDates;
}
