import { isWonRDStageName } from "@/lib/rdDealStatus";

export type CanonicalWonDeal = {
  rd_deal_id: string;
  win?: boolean | null;
  rd_stage_name?: string | null;
  amount_total?: number | null;
  amount_total_effective?: number | null;
};

/** A single, shared definition of a won RD deal used by every KPI surface. */
export function isCanonicalWonDeal(deal: Pick<CanonicalWonDeal, "win" | "rd_stage_name">) {
  return deal.win === true || isWonRDStageName(deal.rd_stage_name);
}
/** Deduplicates snapshots by the provider identity, retaining the first row. */
export function canonicalWonDealIds<T extends CanonicalWonDeal>(deals: T[]) {
  const ids = new Set<string>();
  for (const deal of deals) {
    const id = String(deal.rd_deal_id || "").trim();
    if (id && isCanonicalWonDeal(deal)) ids.add(id);
  }
  return ids;
}

export function canonicalWonDeals<T extends CanonicalWonDeal>(deals: T[]) {
  const seen = new Set<string>();
  return deals.filter((deal) => {
    const id = String(deal.rd_deal_id || "").trim();
    if (!id || !isCanonicalWonDeal(deal) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
