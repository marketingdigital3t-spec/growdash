import { describe, expect, it } from "vitest";
import {
  SYNC_EXECUTION_MAX_AGE_MS,
  classifyAbandonedExecution,
  fetchWithTimeout,
} from "./syncReliabilityPolicy";

describe("sync reliability policy", () => {
  it("marks an abandoned run stale only when a valid snapshot exists", () => {
    expect(classifyAbandonedExecution("2026-10-26T15:00:00.000Z")).toEqual({
      status: "stale",
      errorCode: "PROVIDER_TIMEOUT",
    });
    expect(classifyAbandonedExecution(null)).toEqual({
      status: "failed",
      errorCode: "PROVIDER_TIMEOUT",
    });
    expect(SYNC_EXECUTION_MAX_AGE_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });

  it("aborts a provider request that exceeds its deadline", async () => {
    const result = await fetchWithTimeout(
      "https://provider.test/slow",
      {},
      5,
      async (_input, init) => await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    ).catch((error) => error);

    expect(result).toBeInstanceOf(DOMException);
    expect(result.name).toBe("AbortError");
  });
});
