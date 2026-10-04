export type ScopedMetaBreakdownRow = {
  campaign_id: string;
  attribution_window?: string | null;
};

/** Breakdown snapshots are versioned by account attribution just like daily Insights. */
export function filterMetaBreakdownsByAttribution<T extends ScopedMetaBreakdownRow>(
  rows: T[],
  attributionWindowByCampaign: Record<string, string>,
): T[] {
  return rows.filter((row) => {
    const expected = attributionWindowByCampaign[row.campaign_id] || "account_default";
    const actual = row.attribution_window || "account_default";
    return actual === expected;
  });
}
