import { describe, expect, it } from "vitest";
import { hasCompleteMetaAdCatalog } from "./useActionTotalsByAds";

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
