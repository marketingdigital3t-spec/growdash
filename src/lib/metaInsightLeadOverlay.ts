import type { InsightRow } from "@/hooks/useInsights";

/**
 * Replaces the legacy `insights.leads` daily aggregate with canonical action
 * totals for the selected period. Totals are attached to one row per ad so
 * consumers that roll daily rows up cannot multiply the same action count.
 */
export function overlayCanonicalMetaLeads<T extends InsightRow>(
  rows: T[],
  byAd: Record<string, { forms: number; site: number; conversations: number; total: number }>,
): T[] {
  const seenAds = new Set<string>();
  return rows.map((row) => {
    const adId = String(row.ad_id || "");
    if (!adId) return { ...row, leads: 0 };
    const first = !seenAds.has(adId);
    seenAds.add(adId);
    return { ...row, leads: first ? Number(byAd[adId]?.total || 0) : 0 };
  });
}
