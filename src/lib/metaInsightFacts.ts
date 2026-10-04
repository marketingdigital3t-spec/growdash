/**
 * Canonicalizes daily Meta facts at the read boundary. A legacy null
 * attribution window is equivalent only to account_default. If both the
 * legacy row and its explicit account_default replacement are present, prefer
 * the explicit row so every screen reads the same persisted snapshot.
 */
export function dedupeDailyMetaInsights<T extends {
  ad_id: string;
  date: string;
  attribution_window?: string | null;
}>(rows: T[]): T[] {
  const unique = new Map<string, T>();

  for (const row of rows) {
    const window = normalizeMetaAttributionWindow(row.attribution_window);
    const key = `${row.ad_id}::${row.date}::${window}`;
    const previous = unique.get(key);
    if (!previous || (!previous.attribution_window && row.attribution_window)) {
      unique.set(key, row);
    }
  }

  return Array.from(unique.values());
}

export function matchesMetaAttributionWindow(value: string | null | undefined, expected: string) {
  return normalizeMetaAttributionWindow(value) === normalizeMetaAttributionWindow(expected);
}

export function normalizeMetaAttributionWindow(value: string | null | undefined) {
  return (value || "account_default")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .sort()
    .join(",") || "account_default";
}
