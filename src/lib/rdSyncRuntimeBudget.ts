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
export const RD_SYNC_RUNTIME_BUDGET_MS = 90_000;

/** Backoff waits applied between provider attempts, in order. */
export const RD_REQUEST_BACKOFFS_MS = [5_000, 15_000, 30_000, 60_000];

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
 * backoff — finishes inside the invocation budget.
 *
 * The provider timeout is capped by the remaining budget so a slow RD page can
 * never outlive the invocation and trigger a gateway timeout.
 */
export function safeRDRequestTimeoutMs(
  budgetMs: number = RD_SYNC_RUNTIME_BUDGET_MS,
  attempts: number = RD_REQUEST_ATTEMPTS,
  backoffsMs: number[] = RD_REQUEST_BACKOFFS_MS,
): number {
  const worstCaseBackoff = backoffsMs
    .slice(0, Math.max(0, attempts - 1))
    .reduce((sum, value) => sum + value, 0);
  const available = budgetMs - worstCaseBackoff;
  return Math.max(1_000, Math.floor(available / Math.max(1, attempts)));
}
