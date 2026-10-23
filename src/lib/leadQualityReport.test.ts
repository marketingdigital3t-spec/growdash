import { describe, expect, it } from "vitest";
import { buildLeadQualitySummary, classifyLeadCategory } from "./leadQualityReport";

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
});
