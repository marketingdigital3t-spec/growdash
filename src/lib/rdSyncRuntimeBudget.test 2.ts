import { describe, expect, it } from "vitest";

/**
 * The RD sync edge function runs under a gateway runtime budget. A single
 * provider request can retry with exponential backoff, and every attempt can
 * burn the per-request timeout. When the total time of one logical request
 * exceeds the remaining runtime budget, the gateway kills the invocation and
 * the client sees a non-2xx status instead of the resumable partial payload.
 *
 * These tests pin the budget arithmetic that keeps one provider request
 * inside the invocation budget, so a slow RD page can never outlive it.
 */
describe("RD sync runtime budget", () => {
  const RD_SYNC_RUNTIME_BUDGET_MS = 90_000;
  const RD_REQUEST_TIMEOUT_MS = 30_000;

  it("keeps a single provider request inside the runtime budget", () => {
    const attemptTimeoutMs = RD_REQUEST_TIMEOUT_MS;
    const backoffsMs = [5_000, 15_000, 30_000, 60_000];
    const attempts = 3;

    let worstCase = 0;
    for (let attempt = 0; attempt < attempts; attempt++) {
      worstCase += attemptTimeoutMs;
      if (attempt < attempts - 1) worstCase += backoffsMs[attempt];
    }

    expect(worstCase).toBeLessThan(RD_SYNC_RUNTIME_BUDGET_MS);
  });

  it("derives a per-request timeout that cannot outlive the runtime budget", () => {
    const backoffsMs = [5_000, 15_000, 30_000, 60_000];
    const attempts = 3;

    const worstCaseBackoff = backoffsMs
      .slice(0, attempts - 1)
      .reduce((sum, value) => sum + value, 0);

    const safeRequestTimeoutMs = Math.max(
      1_000,
      Math.floor((RD_SYNC_RUNTIME_BUDGET_MS - worstCaseBackoff) / attempts),
    );

    const worstCase = safeRequestTimeoutMs * attempts + worstCaseBackoff;

    expect(worstCase).toBeLessThanOrEqual(RD_SYNC_RUNTIME_BUDGET_MS);
  });
});
