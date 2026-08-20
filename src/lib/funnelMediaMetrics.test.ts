import { describe, expect, it } from "vitest";
import { computeFunnelMediaMetrics } from "@/lib/funnelMediaMetrics";
import type { InsightRow } from "@/hooks/useInsights";

const row = (partial: Partial<InsightRow>): InsightRow => ({
  ad_id: "ad-1",
  date: "2026-07-17",
  spend: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  ctr: 0,
  cpm: 0,
  frequency: 0,
  leads: 0,
  cpl: 0,
  conversion_rate: 0,
  efficiency_rate: 0,
  health_score: 0,
  ad_name: "",
  adset_name: "",
  campaign_name: "",
  ...partial,
});

describe("computeFunnelMediaMetrics", () => {
  it("soma leads e conversas da Meta para o total de aquisição", () => {
    const result = computeFunnelMediaMetrics([
      row({ spend: 100, impressions: 10_000, reach: 8_000, clicks: 200, leads: 20 }),
      row({ ad_id: "ad-2", spend: 50, impressions: 5_000, reach: 4_000, clicks: 100, leads: 10 }),
    ], 7, 27, 3, 1_200);

    expect(result.spend).toBe(150);
    expect(result.ctr).toBe(2);
    expect(result.cpm).toBe(10);
    expect(result.cpc).toBe(0.5);
    expect(result.metaCpl).toBeCloseTo(150 / 37);
    expect(result.formLeads).toBe(30);
    expect(result.conversations).toBe(7);
    expect(result.metaLeads).toBe(37);
    expect(result.rdCpl).toBeCloseTo(5.5555, 3);
    expect(result.cac).toBe(50);
    expect(result.roas).toBe(8);
    expect(result.leadGap).toBe(-10);
    expect(result.rdCoverage).toBeCloseTo(27 / 37 * 100);
  });

  it("não produz divisão inválida quando não há mídia ou conversões", () => {
    const result = computeFunnelMediaMetrics([], 0, 0, 0, 0);
    expect(result.metaCpl).toBeNull();
    expect(result.rdCpl).toBeNull();
    expect(result.cac).toBeNull();
    expect(result.roas).toBeNull();
    expect(result.rdCoverage).toBeNull();
  });
});
