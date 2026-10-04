export type MetaDailyInsightKey = {
  date_start?: string | null;
  ad_id?: string | null;
};

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
