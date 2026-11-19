/**
 * Runtime budget arithmetic for the RD Station sync edge function.
 *
 * The RD sync runs under a gateway runtime budget. A single provider request
 * can retry with exponential backoff, and every attempt can burn the
 * per-request timeout. When the worst case of one logical request exceeds the
 * invocation budget, the gateway kills the invocation before it can return the
 * resumable partial payload — the client sees a non-2xx status instead and the
 * mirrored snapshot stays stale.
 *
 * Keeping the arithmetic in one place lets the edge function and its tests
 * agree on the same numbers.
 */

/** Total wall-clock budget available to one edge invocation. */
export const RD_SYNC_RUNTIME_BUDGET_MS = 300_000;

/** Backoff waits applied between provider attempts, in order.
 *
 * Kept intentionally short so a single invocation can serve several RD
 * connections sequentially without exhausting the 90s gateway budget and
 * surfacing statement_timeout / partial status on the later connections.
 */
export const RD_REQUEST_BACKOFFS_MS = [2_000, 5_000, 10_000];

/** How many times one provider request may be attempted. */
export const RD_REQUEST_ATTEMPTS = 3;

/**
 * Worst-case duration of a single logical provider request.
 */
export function worstCaseRDRequestMs(
  attemptTimeoutMs: number,
  attempts: number = RD_REQUEST_ATTEMPTS,
  backoffsMs: number[] = RD_REQUEST_BACKOFFS_MS,
): number {
  let total = 0;
  for (let attempt = 0; attempt < attempts; attempt++) {
    total += attemptTimeoutMs;
    if (attempt < attempts - 1) total += backoffsMs[attempt] ?? 0;
  }
  return total;
}

/**
 * Per-attempt timeout that guarantees one logical request — including every
 * backoff — finishes inside the invocation budget while reserving margin for
 * additional requests and database operations in the same invocation.
 *
 * Without this margin, a single slow RD request can consume nearly all 90s,
 * leaving nothing for subsequent connections and surfacing statement_timeout
 * / partial status on the later RD connections.
 */
export function safeRDRequestTimeoutMs(
  budgetMs: number = RD_SYNC_RUNTIME_BUDGET_MS,
  attempts: number = RD_REQUEST_ATTEMPTS,
  backoffsMs: number[] = RD_REQUEST_BACKOFFS_MS,
): number {
  const worstCaseBackoff = backoffsMs
    .slice(0, Math.max(0, attempts - 1))
    .reduce((sum, value) => sum + value, 0);
  // Reserve ~40% of the budget for upserts, cursor writes, and subsequent
  // provider requests within the same invocation.
  const reserve = Math.floor(budgetMs * 0.4);
  const available = Math.max(1_000, budgetMs - reserve - worstCaseBackoff);
  return Math.max(1_000, Math.floor(available / Math.max(1, attempts)));
}
