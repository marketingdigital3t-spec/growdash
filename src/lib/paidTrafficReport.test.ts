import { describe, expect, it } from "vitest";
import { buildTwoMonthAnalysis } from "./paidTrafficReport";

describe("buildTwoMonthAnalysis", () => {
  it("compara o mês atual com o anterior e soma conversas aos leads", () => {
    const report = buildTwoMonthAnalysis({
      analysisFrom: new Date("2026-07-01T12:00:00"),
      analysisTo: new Date("2026-08-15T12:00:00"),
      insights: [
        { date: "2026-07-03", spend: 100, impressions: 10_000, reach: 8_000, clicks: 500, leads: 10 },
        { date: "2026-07-10", spend: 100, impressions: 10_000, reach: 8_000, clicks: 500, leads: 10 },
        { date: "2026-08-03", spend: 120, impressions: 12_000, reach: 9_000, clicks: 720, leads: 18 },
        { date: "2026-08-10", spend: 80, impressions: 8_000, reach: 6_000, clicks: 480, leads: 12 },
      ],
      conversationsByDate: { "2026-07-10": 2, "2026-08-03": 4, "2026-08-10": 2 },
      deals: [{ lead_created_at: "2026-07-03T14:00:00Z" }, { lead_created_at: "2026-08-03T14:00:00Z" }],
      sales: [
        { sale_date: "2026-07-03", status: "confirmed", net_revenue: 400, quantity: 1 },
        { sale_date: "2026-08-03", status: "confirmed", net_revenue: 800, quantity: 2 },
      ],
    });

    expect(report.previousMonth.metrics.leads).toBe(22);
    expect(report.currentMonth.metrics.leads).toBe(36);
    expect(report.currentMonth.metrics.conversations).toBe(6);
    expect(report.currentMonth.metrics.sales).toBe(2);
    expect(report.currentMonth.metrics.roas).toBe(4);
    expect(report.currentMonth.isPartial).toBe(true);
    expect(report.metricComparisons.find((item) => item.id === "leads")?.variationPercent).toBe(63.6);
    expect(report.weeklyComparison.length).toBeGreaterThanOrEqual(4);
    expect(report.wins.length).toBeGreaterThan(0);
  });

  it("não inventa recomendações quando não há dados", () => {
    const report = buildTwoMonthAnalysis({
      analysisFrom: new Date("2026-07-01T12:00:00"),
      analysisTo: new Date("2026-08-08T12:00:00"),
      insights: [], deals: [], sales: [], conversationsByDate: {},
    });
    expect(report.currentMonth.metrics.leads).toBe(0);
    expect(report.risks[0].title).toBe("Dados insuficientes");
    expect(report.actions[0].recommendation).toContain("sincronização");
  });
});

