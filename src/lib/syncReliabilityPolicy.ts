export const SYNC_EXECUTION_MAX_AGE_MS = 10 * 60_000;
// Keep large ad catalogs resumable without turning a lead sync into dozens of
// sequential Graph requests. The response remains authoritative for the
// fields returned by Meta; missing pages stay partial and are retried later.
export const META_AD_CATALOG_PAGE_SIZE = 500;
export const SYNC_LEAD_RUN_BUDGET_MS = 90_000;

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
