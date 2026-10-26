export const SYNC_EXECUTION_MAX_AGE_MS = 10 * 60_000;
// Keep large ad catalogs resumable without turning a lead sync into dozens of
// sequential Graph requests. The response remains authoritative for the
// fields returned by Meta; missing pages stay partial and are retried later.
export const META_AD_CATALOG_PAGE_SIZE = 500;
export const SYNC_LEAD_RUN_BUDGET_MS = 90_000;

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
