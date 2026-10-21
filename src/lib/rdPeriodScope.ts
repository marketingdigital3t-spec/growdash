type RDPeriodDealIdentity = {
  id?: string | null;
  rd_deal_id?: string | null;
  rd_connection_id?: string | null;
  ad_account_id?: string | null;
};

/**
 * Merges the lead-period snapshot with the canonical won-period snapshot.
 *
 * The first list is scoped by lead entry for open negotiations. The second is
 * scoped by the effective closing date and therefore must be allowed to add
 * older leads that were closed in the selected period. A provider deal is
 * unique per connection; using only rd_deal_id would collapse equal IDs from
 * two RD connections. The won snapshot wins when both lists contain the same
 * provider record so its closed_at/amount fields remain authoritative.
 */
export function mergeRDPeriodDeals<T extends RDPeriodDealIdentity>(periodDeals: T[], closedPeriodDeals: RDPeriodDealIdentity[]) {
  const merged = new Map<string, T>();
  for (const deal of [...periodDeals, ...closedPeriodDeals]) {
    const providerId = String(deal.rd_deal_id || deal.id || "").trim();
    if (!providerId) continue;
    const key = `${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${providerId}`;
    // The closed-period query is the same `rd_deals` row shape with a looser
    // generated type. Runtime fields are intentionally preserved; the first
    // list's type is used as the analytical contract for the merged result.
    merged.set(key, deal as T);
  }
  return Array.from(merged.values());
}
