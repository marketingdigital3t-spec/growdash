/**
 * Bounded concurrency helpers for provider synchronization.
 *
 * Syncing every RD funnel or Meta account at once floods the Edge runtime,
 * saturates the Postgres connection pool and trips the Meta Graph API rate
 * limit (#4 Application request limit reached). Running the queue with a
 * small concurrency window and a short pause between items keeps the
 * provider, the database and the workspace healthy.
 */

/**
 * Maps `items` through `worker` with at most `limit` concurrent calls and
 * preserves the input order in the returned array.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (!items.length) return results;
  let next = 0;
  async function consume() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, consume),
  );
  return results;
}

/**
 * Pause between provider calls so a manual sync never turns into a burst
 * that exhausts the Meta app-level quota or the RD connection budget.
 */
export function syncQueueDelayMs(index: number, delayMs = 250) {
  if (index <= 0) return 0;
  return delayMs;
}

/**
 * Detects the Meta Graph API app-level quota error. It is transient: the
 * accounts, campaigns and deals already mirrored in the database stay valid
 * and must be presented to the user instead of a blocking connection error.
 */
export function isProviderRateLimited(value: unknown) {
  return /#4\b|application request limit|rate.?limit|too many calls/i.test(
    String(value ?? ""),
  );
}

/**
 * Provider failures that only mean "this scope is busy", not "the data is
 * lost". The last valid snapshot must be preserved and shown.
 */
export function isTransientProviderOverload(value: unknown) {
  return (
    /statement timeout|canceling statement|compute resources|failed to send a request|timed out|timeout/i.test(
      String(value ?? ""),
    )
  );
}
