import { describe, expect, it } from "vitest";
import { resolveMetaActionMetrics } from "./metaActionMetrics";

describe("Meta action metrics", () => {
  it("prioriza a ação omni para não duplicar checkout e compra", () => {
    const metrics = resolveMetaActionMetrics({
      omni_initiated_checkout: 8,
      "offsite_conversion.fb_pixel_initiate_checkout": 8,
      omni_purchase: 3,
      "offsite_conversion.fb_pixel_purchase": 3,
      landing_page_view: 21,
      link_click: 34,
    }, {
      omni_purchase: 897,
      "offsite_conversion.fb_pixel_purchase": 897,
    });

    expect(metrics).toEqual({
      linkClicks: 34,
      landingPageViews: 21,
      checkouts: 8,
      purchases: 3,
      purchaseValue: 897,
    });
  });

  it("usa o evento de pixel quando o evento omni não existe", () => {
    const metrics = resolveMetaActionMetrics({
      "offsite_conversion.fb_pixel_initiate_checkout": 4,
      "offsite_conversion.fb_pixel_purchase": 2,
    }, {
      "offsite_conversion.fb_pixel_purchase": 500,
    });

    expect(metrics.checkouts).toBe(4);
    expect(metrics.purchases).toBe(2);
    expect(metrics.purchaseValue).toBe(500);
  });
});
