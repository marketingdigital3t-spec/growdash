import { describe, expect, it, vi } from "vitest";
import { aggregateUnifiedMetrics, buildForecastScenarios, calculateBudgetPacing, detectAnomalies, resolveDataState } from "./intelligenceMetrics";
import type { InsightRow } from "@/hooks/useInsights";

const row = (date: string, values: Partial<InsightRow>): InsightRow => ({ ad_id: "ad-1", date, spend: 100, impressions: 10_000, reach: 8_000, clicks: 200, ctr: 2, cpm: 10, frequency: 1.25, leads: 10, cpl: 10, conversion_rate: 0, efficiency_rate: 0, health_score: 80, ad_name: "Criativo", adset_name: "Conjunto", campaign_name: "Campanha", ...values });

describe("contrato unificado de métricas", () => {
  it("calcula métricas Meta, RD e vendas sem divergência de fórmula", () => {
    const metrics = aggregateUnifiedMetrics([row("2026-07-18", {})], [{ win: true, stage_bucket: "client" } as any], [{ status: "confirmed", quantity: 2, net_revenue: 900 } as any]);
    expect(metrics.cpl).toBe(10);
    expect(metrics.ctr).toBe(2);
    expect(metrics.roas).toBe(9);
    expect(metrics.sales).toBe(2);
    expect(metrics.rdCoverage).toBe(10);
  });

  it("detecta deterioração de CPL e CTR", () => {
    const insights = [row("2026-07-14", {}), row("2026-07-15", {}), row("2026-07-16", { spend: 180, clicks: 100 }), row("2026-07-17", { spend: 190, clicks: 90 }), row("2026-07-18", { spend: 200, clicks: 80 })];
    const anomalies = detectAnomalies(insights);
    expect(anomalies.some((item) => item.metric === "cpl")).toBe(true);
    expect(anomalies.some((item) => item.metric === "ctr")).toBe(true);
  });

  it("projeta pacing e três cenários explícitos", () => {
    const metrics = aggregateUnifiedMetrics([row("2026-07-18", {})], [], [{ status: "confirmed", quantity: 1, net_revenue: 500 } as any]);
    const pacing = calculateBudgetPacing(metrics, { dailyBudget: 100, remainingBalance: 150 }, 1);
    expect(pacing.status).toBe("critical");
    expect(buildForecastScenarios(metrics, 10_000).map((item) => item.key)).toEqual(["conservative", "probable", "aggressive"]);
  });

  it("distingue estados vazio, ausência real, erro, stale e ready", () => {
    vi.setSystemTime(new Date("2026-07-18T18:00:00Z"));
    expect(resolveDataState({ loading: true, hasConfiguredSource: true, rows: 0 })).toBe("loading");
    expect(resolveDataState({ loading: false, hasConfiguredSource: false, rows: 0 })).toBe("empty");
    expect(resolveDataState({ loading: false, hasConfiguredSource: true, rows: 0 })).toBe("no-data");
    expect(resolveDataState({ loading: false, error: new Error("x"), hasConfiguredSource: true, rows: 1 })).toBe("error");
    expect(resolveDataState({ loading: false, hasConfiguredSource: true, rows: 1, lastSyncAt: "2026-07-18T16:00:00Z" })).toBe("stale");
    expect(resolveDataState({ loading: false, hasConfiguredSource: true, rows: 1, lastSyncAt: "2026-07-18T17:50:00Z" })).toBe("ready");
    vi.useRealTimers();
  });
});
