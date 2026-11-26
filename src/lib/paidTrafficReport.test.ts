import { describe, expect, it } from "vitest";
import { buildTwoMonthAnalysis } from "./paidTrafficReport";

describe("buildTwoMonthAnalysis", () => {
  it("compara os meses usando o total canônico Meta de forms, site e conversas", () => {
    const report = buildTwoMonthAnalysis({
      analysisFrom: new Date("2026-07-01T12:00:00"),
      analysisTo: new Date("2026-08-15T12:00:00"),
      insights: [
        { date: "2026-07-03", spend: 100, impressions: 10_000, reach: 8_000, clicks: 500, leads: 999 },
        { date: "2026-07-10", spend: 100, impressions: 10_000, reach: 8_000, clicks: 500, leads: 999 },
        { date: "2026-08-03", spend: 120, impressions: 12_000, reach: 9_000, clicks: 720, leads: 999 },
        { date: "2026-08-10", spend: 80, impressions: 8_000, reach: 6_000, clicks: 480, leads: 999 },
      ],
      metaLeadPartsByDate: {
        "2026-07-03": { forms: 10, site: 0, conversations: 0, total: 10 },
        "2026-07-10": { forms: 10, site: 0, conversations: 2, total: 12 },
        "2026-08-03": { forms: 18, site: 0, conversations: 4, total: 22 },
        "2026-08-10": { forms: 12, site: 0, conversations: 2, total: 14 },
      },
      deals: [{ lead_created_at: "2026-07-03T14:00:00Z" }, { lead_created_at: "2026-08-03T14:00:00Z" }],
      sales: [
        { sale_date: "2026-07-03", status: "confirmed", net_revenue: 400, quantity: 1 },
        { sale_date: "2026-08-03", status: "confirmed", net_revenue: 800, quantity: 2 },
      ],
    });

    expect(report.previousMonth.metrics.leads).toBe(22);
    expect(report.currentMonth.metrics.leads).toBe(36);
    expect(report.currentMonth.metrics.conversations).toBe(6);
    expect(report.currentMonth.metrics.formLeads).toBe(30);
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
    expect(report.actions[0].steps?.length).toBeGreaterThanOrEqual(3);
  });

  it("inclui conversas no total canônico quando não há formulário ou site", () => {
    const report = buildTwoMonthAnalysis({
      analysisFrom: new Date("2026-07-01T12:00:00"),
      analysisTo: new Date("2026-08-08T12:00:00"),
      insights: [{ date: "2026-08-03", spend: 100, clicks: 80, impressions: 1000, leads: 2 }],
      deals: [],
      sales: [],
      conversationsByDate: { "2026-08-03": 5 },
    });
    const action = report.actions.find((item) => item.title === "Fechar o ciclo das conversas");
    expect(action?.steps).toEqual(expect.arrayContaining([expect.stringContaining("webhook"), expect.stringContaining("negócio")]));
    expect(report.currentMonth.metrics.leads).toBe(5);
  });
});
