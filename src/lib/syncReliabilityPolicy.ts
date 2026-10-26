export const SYNC_EXECUTION_MAX_AGE_MS = 10 * 60_000;
// Keep large ad catalogs resumable without turning a lead sync into dozens of
// sequential Graph requests. The response remains authoritative for the
// fields returned by Meta; missing pages stay partial and are retried later.
export const META_AD_CATALOG_PAGE_SIZE = 500;
export const SYNC_LEAD_RUN_BUDGET_MS = 90_000;
export const LEAD_SYNC_COOLDOWN_MS = 5 * 60_000;
export const LEAD_SYNC_RATE_LIMIT_COOLDOWN_MS = 15 * 60_000;
// A single five-minute worker must not drain every RD funnel serially. One
// funnel per connection per cycle keeps the provider token ordered while
// allowing the next cycle to resume the remaining funnels.
export const RD_FUNNELS_PER_CONNECTION_PER_CYCLE = 1;

export type LeadSyncExecutionPolicy = {
  catalogMaxPages: number;
  refreshSubscriptions: boolean;
  deliveryFields: "combined" | "isolated";
};

export type LeadSyncWindow = {
  mode: "incremental" | "historical" | "manual";
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
};

export type RotatingRDSyncTarget = {
  id: string;
  rd_connection_id: string | null;
  user_id?: string | null;
};

/** Select the least recently attempted funnel for each RD connection. */
export function selectRotatingRDSyncTargets<T extends RotatingRDSyncTarget>(
  targets: T[],
  lastAttemptByFunnel: ReadonlyMap<string, string | null | undefined>,
  perConnection = RD_FUNNELS_PER_CONNECTION_PER_CYCLE,
) {
  const limit = Math.max(1, Math.floor(perConnection));
  const groups = new Map<string, T[]>();
  for (const target of targets) {
    const key = target.rd_connection_id || `legacy:${target.user_id || "unknown"}`;
    const group = groups.get(key) || [];
    group.push(target);
    groups.set(key, group);
  }
  const selected: T[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aTime = Date.parse(String(lastAttemptByFunnel.get(a.id) || ""));
      const bTime = Date.parse(String(lastAttemptByFunnel.get(b.id) || ""));
      const aRank = Number.isFinite(aTime) ? aTime : Number.NEGATIVE_INFINITY;
      const bRank = Number.isFinite(bTime) ? bTime : Number.NEGATIVE_INFINITY;
      return aRank - bRank || a.id.localeCompare(b.id);
    });
    selected.push(...group.slice(0, limit));
  }
  return selected;
}

/**
 * Incremental workers keep a short watermark for lead polling. The wider
 * civil-day lookback belongs to insights and must never be passed to the
 * per-form lead endpoint, otherwise every five-minute cycle rereads the day.
 */
export function buildLeadSyncWindow(window: LeadSyncWindow) {
  return window.mode === "incremental"
    ? {
      recentStartAt: window.start.toISOString(),
      recentEndAt: window.end.toISOString(),
    }
    : {
      startDate: window.startDate,
      endDate: window.endDate,
    };
}

/**
 * Recent lead windows are latency-sensitive. They reuse the local form
 * catalog and must not refresh page/app subscriptions or walk every catalog
 * page in the request that persists the lead snapshot.
 */
export function leadSyncExecutionPolicy(recent: boolean, triggerSource = ""): LeadSyncExecutionPolicy {
  // The five-minute worker sends an explicit civil-date window so late
  // conversions remain covered. That window is still latency-sensitive: it
  // must reuse the catalog and leave webhook subscriptions to the durable
  // maintenance path instead of behaving like a historical backfill.
  const latencySensitive = recent || triggerSource === "five_minute_incremental";
  return latencySensitive
    ? { catalogMaxPages: 1, refreshSubscriptions: false, deliveryFields: "combined" }
    : { catalogMaxPages: Number.POSITIVE_INFINITY, refreshSubscriptions: true, deliveryFields: "isolated" };
}

export function hasExceededSyncDeadline(deadlineAt: number, now = Date.now()) {
  return now >= deadlineAt;
}

/**
 * Automatic lead polling is deliberately less frequent than UI refreshes.
 * Webhooks remain available for immediate delivery; this gate only prevents
 * duplicate background reads from exhausting the Meta application quota.
 */
export function shouldThrottleLeadSync(
  lastActivityAt: string | null | undefined,
  now = Date.now(),
  cooldownMs = LEAD_SYNC_COOLDOWN_MS,
) {
  if (!lastActivityAt) return false;
  const last = Date.parse(lastActivityAt);
  return Number.isFinite(last) && now - last < cooldownMs;
}

export function isMetaApplicationRateLimitError(value: unknown) {
  return /#4\b|application request limit|rate.?limit/i.test(String(value ?? ""));
}

export function leadSyncCooldownMs(lastError: unknown) {
  return isMetaApplicationRateLimitError(lastError)
    ? LEAD_SYNC_RATE_LIMIT_COOLDOWN_MS
    : LEAD_SYNC_COOLDOWN_MS;
}

export function classifyAbandonedExecution(lastValidSnapshotAt: string | null | undefined) {
  return {
    status: lastValidSnapshotAt && Number.isFinite(Date.parse(lastValidSnapshotAt)) ? "stale" as const : "failed" as const,
    errorCode: "PROVIDER_TIMEOUT" as const,
  };
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Response> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) forwardAbort();
  else init.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(new DOMException("Provider request timed out", "AbortError")), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
}
