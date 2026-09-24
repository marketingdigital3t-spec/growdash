import { describe, expect, it } from "vitest";
import type { InsightRow } from "@/hooks/useInsights";
import { aggregateMetrics } from "./metrics";

const row = (values: Partial<InsightRow>): InsightRow => ({
  ad_id: "ad",
  date: "2026-09-24",
  spend: 100,
  impressions: 10_000,
  reach: 8_000,
  clicks: 200,
  ctr: 2,
  cpm: 10,
  frequency: 1.25,
  leads: 10,
  cpl: 10,
  conversion_rate: 5,
  efficiency_rate: 0.1,
  health_score: 80,
  ad_name: "Ad",
  adset_name: "Adset",
  campaign_name: "Campaign",
  ...values,
});

describe("aggregateMetrics", () => {
  it("calcula CPM e CTR ponderados pelos totais, como o Meta", () => {
    const metrics = aggregateMetrics([
      row({ spend: 10, impressions: 100, clicks: 1, cpm: 100 }),
      row({ spend: 90, impressions: 9_900, clicks: 99, cpm: 9.09 }),
    ]);

    expect(metrics.avgCPM).toBeCloseTo(10, 8);
    expect(metrics.avgCTR).toBeCloseTo(1, 8);
    expect(metrics.avgCPL).toBeCloseTo(5, 8);
  });
});
