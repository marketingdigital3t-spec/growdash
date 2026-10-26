import { describe, expect, it } from "vitest";
import { buildActionTotalsSnapshotCacheKey, hasCompleteMetaAdCatalog } from "./useActionTotalsByAds";

describe("Meta action snapshot cache", () => {
  it("names cached action totals by the authenticated user and exact scope", () => {
    expect(buildActionTotalsSnapshotCacheKey("user-1", ["actions", "account-1", "2026-10-26"])).toContain("growdash:action-totals-snapshot:user-1:");
    expect(buildActionTotalsSnapshotCacheKey(undefined, ["actions"])).toBe("");
  });
});

describe("Meta action catalog reuse", () => {
  it("accepts the adset catalog already carried by canonical Insights rows", () => {
    expect(hasCompleteMetaAdCatalog(["ad-1", "ad-2"], {
      "ad-1": "adset-1",
      "ad-2": null,
    })).toBe(true);
  });

  it("falls back to the catalog query when an ad is missing from the snapshot", () => {
    expect(hasCompleteMetaAdCatalog(["ad-1", "ad-2"], { "ad-1": "adset-1" })).toBe(false);
  });
});
