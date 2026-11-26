import { describe, expect, it } from "vitest";
import { buildDailyLeadReport, buildLeadQualitySummary, classifyLeadCategory } from "./leadQualityReport";

describe("lead quality report", () => {
  it("classifies patient model and student without mixing the categories", () => {
    expect(classifyLeadCategory({ rd_product_name: "Paciente Modelo" })).toBe("paciente_modelo");
    expect(classifyLeadCategory({ rd_product_name: "Formação para Alunas" })).toBe("aluna");
    expect(classifyLeadCategory({ rd_product_name: null })).toBe("sem_classificacao");
  });

  it("derives funnel quality counts and costs from canonical RD stages", () => {
    const summary = buildLeadQualitySummary(
      [
        { stage_bucket: "new", rd_stage_name: "Lead Novo", rd_product_name: "Paciente Modelo" },
        { stage_bucket: "opportunity", rd_stage_name: "Oportunidade", rd_product_name: "Formação Aluna" },
        { stage_bucket: "won", rd_stage_name: "Venda Realizada", rd_product_name: "Formação Aluna", win: true },
      ],
      300,
    );

    expect(summary.leads).toBe(3);
    expect(summary.qualified).toBe(2);
    expect(summary.opportunities).toBe(1);
    expect(summary.sales).toBe(1);
    expect(summary.costPerQualified).toBe(150);
    expect(summary.costPerOpportunity).toBe(300);
    expect(summary.byCategory.paciente_modelo.leads).toBe(1);
    expect(summary.byCategory.aluna.sales).toBe(1);
  });

  it("builds the previous-day funnel without treating pending sales as confirmed", () => {
    const report = buildDailyLeadReport({
      date: "2026-10-25",
      spend: 240,
      metaLeads: 8,
      deals: [
        { lead_created_at: "2026-10-25T10:00:00-03:00", stage_bucket: "new", rd_stage_name: "Lead Novo" },
        { lead_created_at: "2026-10-25T11:00:00-03:00", stage_updated_at: "2026-10-25T15:00:00-03:00", stage_bucket: "opportunity", rd_stage_name: "Oportunidade" },
        { lead_created_at: "2026-10-24T11:00:00-03:00", stage_updated_at: "2026-10-25T16:00:00-03:00", stage_bucket: "won", rd_stage_name: "Venda realizada", win: true },
      ],
      sales: [
        { sale_date: "2026-10-25", status: "pending", quantity: 2, net_revenue: 400 },
        { sale_date: "2026-10-25", status: "confirmed", quantity: 1, net_revenue: 300 },
      ],
    });

    expect(report.metaLeads).toBe(8);
    expect(report.rdLeads).toBe(2);
    expect(report.opportunities).toBe(1);
    expect(report.sales).toBe(1);
    expect(report.revenue).toBe(300);
    expect(report.cpl).toBe(30);
    expect(report.costPerOpportunity).toBe(240);
    expect(report.costPerSale).toBe(240);
    expect(report.status).toBe("ok");
  });

  it("keeps missing sources explicit instead of presenting an empty day as healthy", () => {
    const report = buildDailyLeadReport({ date: "2026-10-25", spend: 0, metaLeads: 0, deals: [], sales: [] });

    expect(report.status).toBe("empty");
    expect(report.coverageNote).toContain("Nenhum dado persistido");
    expect(report.recommendation).toContain("Não tome decisão de mídia");
  });
});
