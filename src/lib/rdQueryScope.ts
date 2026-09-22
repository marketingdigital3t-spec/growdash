import { saoPauloDayBounds, isCanonicalWonDeal, canonicalWonDate } from "@/lib/canonicalMetrics";

export type RDQueryScope = {
  workspaceId?: string;
  accountIds: string[];
  rdConnectionIds?: string[];
  funnelIds: string[];
  startDate: Date;
  endDate: Date;
  dateRule: "lead_created_at" | "created_at_for_open_closed_at_for_won";
};

export function normalizeRDQueryScope(scope: RDQueryScope): RDQueryScope {
  return { ...scope, accountIds: Array.from(new Set(scope.accountIds.filter(Boolean))).sort(), rdConnectionIds: Array.from(new Set((scope.rdConnectionIds ?? []).filter(Boolean))).sort(), funnelIds: Array.from(new Set(scope.funnelIds.filter(Boolean))).sort() };
}

export function rdScopeQueryKey(scope: RDQueryScope) {
  const normalized = normalizeRDQueryScope(scope);
  return [normalized.workspaceId ?? "", normalized.accountIds.join(","), (normalized.rdConnectionIds ?? []).join(","), normalized.funnelIds.join(","), normalized.startDate.toISOString(), normalized.endDate.toISOString(), normalized.dateRule] as const;
}

type ScopedDeal = {
  rd_deal_id?: string | null;
  rd_connection_id?: string | null;
  ad_account_id?: string | null;
  rd_funnel_id?: string | null;
  win?: boolean | null;
  rd_stage_name?: string | null;
  lead_created_at?: string | null;
  closed_at?: string | null;
  stage_updated_at?: string | null;
};

export function isDealInRDQueryScope(deal: ScopedDeal, scope: RDQueryScope) {
  const normalized = normalizeRDQueryScope(scope);
  return (!normalized.accountIds.length || normalized.accountIds.includes(deal.ad_account_id || ""))
    && (!normalized.rdConnectionIds?.length || normalized.rdConnectionIds.includes(deal.rd_connection_id || ""))
    && (!normalized.funnelIds.length || normalized.funnelIds.includes(deal.rd_funnel_id || ""));
}

function inPeriod(value: string | null | undefined, scope: RDQueryScope) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const bounds = saoPauloDayBounds(scope.startDate, scope.endDate);
  return timestamp >= bounds.start.getTime() && timestamp <= bounds.end.getTime();
}

export function isRDDealInScopePeriod(deal: ScopedDeal, scope: RDQueryScope) {
  if (!isDealInRDQueryScope(deal, scope)) return false;
  if (scope.dateRule === "lead_created_at") return inPeriod(deal.lead_created_at, scope);
  if (isCanonicalWonDeal(deal)) return inPeriod(canonicalWonDate(deal), scope);
  return inPeriod(deal.lead_created_at, scope);
}

export function dedupeRDDealsById<T extends ScopedDeal>(deals: T[]) {
  const seen = new Set<string>();
  return deals.filter((deal) => {
    const id = `${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${String(deal.rd_deal_id || "").trim()}`;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
