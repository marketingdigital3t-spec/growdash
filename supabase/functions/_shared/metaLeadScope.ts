import { buildConversationEligibleMetaAdScopes, buildSiteEligibleMetaAdScopes } from "../../../src/lib/metaLeadScope.ts";

type ScopedInsight = { ad_account_id: string; ad_id: string; adset_id?: string | null };

/** Resolve ad-set destinations for a known set of persisted Meta facts.
 * Unknown/missing catalog data is deliberately not considered Website.
 */
export async function loadSiteEligibleMetaAdScopes(admin: any, rows: ScopedInsight[]) {
  // Insights returned by Graph already carries adset_id. Prefer that fact and
  // consult the local catalog only for older snapshots that lack it; a missing
  // ads catalog row must not make a known Website destination look unknown.
  const adsetByAd = new Map(rows
    .filter((row) => row.ad_id && row.adset_id)
    .map((row) => [row.ad_id, String(row.adset_id)]));
  const unresolvedAdIds = [...new Set(rows
    .filter((row) => row.ad_id && !row.adset_id)
    .map((row) => row.ad_id))];
  for (let offset = 0; offset < unresolvedAdIds.length; offset += 500) {
    const { data, error } = await admin.from("ads").select("id,adset_id").in("id", unresolvedAdIds.slice(offset, offset + 500));
    if (error) return { scopes: new Set<string>(), conversationScopes: new Set<string>(), error: error.message, complete: false };
    for (const row of data || []) if (row.adset_id) adsetByAd.set(String(row.id), String(row.adset_id));
  }

  const adsetIds = [...new Set(adsetByAd.values())];
  const destinationTypeByAdset: Record<string, string | null> = {};
  for (let offset = 0; offset < adsetIds.length; offset += 500) {
    const { data, error } = await admin.from("adsets").select("id,destination_type").in("id", adsetIds.slice(offset, offset + 500));
    if (error) return { scopes: new Set<string>(), conversationScopes: new Set<string>(), error: error.message, complete: false };
    for (const row of data || []) destinationTypeByAdset[row.id] = row.destination_type || null;
  }
  const scopedRows = rows.map((row) => ({ ...row, adset_id: row.adset_id || adsetByAd.get(row.ad_id) || null }));
  const complete = scopedRows.length === 0 || scopedRows.every((row) => row.adset_id && destinationTypeByAdset[row.adset_id]);
  return {
    scopes: buildSiteEligibleMetaAdScopes(scopedRows, destinationTypeByAdset),
    conversationScopes: buildConversationEligibleMetaAdScopes(scopedRows, destinationTypeByAdset),
    error: null as string | null,
    complete,
  };
}
