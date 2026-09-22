import { isWonRDStageName } from "@/lib/rdDealStatus";
import { format } from "date-fns";

export type CanonicalWonDeal = {
  rd_deal_id: string;
  rd_connection_id?: string | null;
  ad_account_id?: string | null;
  win?: boolean | null;
  rd_stage_name?: string | null;
  closed_at?: string | null;
  stage_updated_at?: string | null;
  updated_at?: string | null;
  amount_total?: number | null;
  amount_total_effective?: number | null;
};

/** The only timestamp used for a won RD deal. A stage update is a legacy
 * fallback, never an override for a real closing timestamp. */
export function canonicalWonDate(deal: Pick<CanonicalWonDeal, "closed_at" | "stage_updated_at">) {
  // A missing close and missing transition is unknown, not a sale dated by
  // lead creation. Never invent a financial/conversion date.
  return deal.closed_at || deal.stage_updated_at || null;
}

/** Calendar boundaries for the business timezone used by the RD operation. */
export function saoPauloDayBounds(startDate: Date, endDate: Date) {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");
  return {
    start: new Date(`${start}T00:00:00-03:00`),
    end: new Date(`${end}T23:59:59.999-03:00`),
  };
}

export function isCanonicalWonDealInPeriod(
  deal: Pick<CanonicalWonDeal, "win" | "rd_stage_name" | "closed_at" | "stage_updated_at">,
  startDate: Date,
  endDate: Date,
) {
  if (!isCanonicalWonDeal(deal)) return false;
  const value = canonicalWonDate(deal);
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const bounds = saoPauloDayBounds(startDate, endDate);
  return timestamp >= bounds.start.getTime() && timestamp <= bounds.end.getTime();
}

/** A single, shared definition of a won RD deal used by every KPI surface. */
export function isCanonicalWonDeal(deal: Pick<CanonicalWonDeal, "win" | "rd_stage_name">) {
  return deal.win === true || isWonRDStageName(deal.rd_stage_name);
}
/** Deduplicates snapshots by the provider identity, retaining the first row. */
export function canonicalWonDealIds<T extends CanonicalWonDeal>(deals: T[]) {
  const ids = new Set<string>();
  for (const deal of deals) {
    const rawId = String(deal.rd_deal_id || "").trim();
    const id = `${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${rawId}`;
    if (rawId && isCanonicalWonDeal(deal)) {
      ids.add(rawId);
      ids.add(id);
    }
  }
  return ids;
}

export function canonicalWonDeals<T extends CanonicalWonDeal>(deals: T[]) {
  const seen = new Set<string>();
  return deals.filter((deal) => {
    const id = `${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${String(deal.rd_deal_id || "").trim()}`;
    if (!id || !isCanonicalWonDeal(deal) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
