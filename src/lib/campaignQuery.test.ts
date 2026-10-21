import { describe, expect, it, vi } from "vitest";
import { CAMPAIGN_REQUEST_TIMEOUT_MS, EMPTY_ACCOUNT_SCOPE, fetchCampaignPages, resolveCampaignAccountScope } from "./campaignQuery";

function queryFactory(rows: unknown[], ranges: Array<[number, number]>) {
  return () => {
    let from = 0;
    let to = rows.length - 1;
    return {
      range(nextFrom: number, nextTo: number) {
        from = nextFrom;
        to = nextTo;
        ranges.push([from, to]);
        return this;
      },
      abortSignal() {
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
      },
    };
  };
}

describe("fetchCampaignPages", () => {
  it("keeps the selected account isolated and all-accounts scoped to visible ids", () => {
    expect(resolveCampaignAccountScope("account-a", ["account-a", "account-b"])).toEqual(["account-a"]);
    expect(resolveCampaignAccountScope("all", ["account-a", "account-b"])).toEqual(["account-a", "account-b"]);
    expect(resolveCampaignAccountScope("all", [])).toEqual([EMPTY_ACCOUNT_SCOPE]);
  });

  it("paginates the hierarchy without losing the empty tail", async () => {
    const ranges: Array<[number, number]> = [];
    await expect(fetchCampaignPages(queryFactory([1, 2, 3], ranges), undefined, 2, "Campanhas"))
      .resolves.toEqual([1, 2, 3]);
    expect(ranges).toEqual([[0, 1], [2, 3]]);
  });

  it("keeps an empty Supabase response as an empty snapshot", async () => {
    await expect(fetchCampaignPages(queryFactory([], []), undefined, 100, "Campanhas"))
      .resolves.toEqual([]);
  });

  it("propagates a backend error instead of turning it into zero rows", async () => {
    const query = () => ({
      range() { return this; },
      abortSignal() { return Promise.resolve({ data: null, error: new Error("503 upstream") }); },
    });
    await expect(fetchCampaignPages(query, undefined, 100, "Campanhas"))
      .rejects.toThrow("503 upstream");
  });

  it("cancels before issuing a request when the route changes", async () => {
    const controller = new AbortController();
    controller.abort();
    const buildQuery = vi.fn(queryFactory([1], []));
    await expect(fetchCampaignPages(buildQuery, controller.signal, 100, "Campanhas"))
      .rejects.toThrow("cancelada");
    expect(buildQuery).not.toHaveBeenCalled();
  });

  it("fails with an actionable timeout and aborts the page request", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const query = () => ({
        range() { return this; },
        abortSignal(signal: AbortSignal) {
          signal.addEventListener("abort", () => { aborted = true; });
          return new Promise(() => undefined);
        },
      });
      const pending = fetchCampaignPages(query, undefined, 100, "Campanhas");
      const rejection = expect(pending).rejects.toThrow("Campanhas demorou mais de");
      await vi.advanceTimersByTimeAsync(CAMPAIGN_REQUEST_TIMEOUT_MS);
      await rejection;
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
