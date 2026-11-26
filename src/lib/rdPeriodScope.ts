type RDPeriodDealIdentity = {
  id?: string | null;
  rd_deal_id?: string | null;
  rd_connection_id?: string | null;
  ad_account_id?: string | null;
};

type RDPeriodDealFilters = {
  source?: string;
  campaignIds?: string[];
  state?: string;
  owner?: string;
  product?: string;
};

/** Applies the funnel screen's local filters to the indexed period snapshot. */
export function filterRDPeriodDeals<T extends RDPeriodDealIdentity & {
  utm_source?: string | null;
  utm_campaign?: string | null;
  lead_state?: string | null;
  deal_owner_name?: string | null;
  rd_product_name?: string | null;
}>(deals: T[], filters: RDPeriodDealFilters) {
  return deals.filter((deal) => (
    (!filters.source || filters.source === "all" || deal.utm_source === filters.source)
      && (!filters.campaignIds?.length || filters.campaignIds.includes(deal.utm_campaign || ""))
      && (!filters.state || filters.state === "all" || deal.lead_state === filters.state)
      && (!filters.owner || filters.owner === "all" || deal.deal_owner_name === filters.owner)
      && (!filters.product || filters.product === "all" || deal.rd_product_name === filters.product)
  ));
}

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
