import { describe, expect, it } from "vitest";
import { consolidateCRMPipeline, consolidatedCRMStage, filterOperationalRDDeals, isExcludedLegacyRannielyStage } from "./crmPipelineStages";

describe("CRM consolidated pipeline", () => {
  it("puts equivalent new-lead labels in one column", () => {
    const stages = consolidateCRMPipeline([
      { id: "a", name: "Lead Novo", order: 1 },
      { id: "b", name: "leads novos", order: 3 },
      { id: "c", name: "Leads Novos", order: 2 },
    ]);
    expect(stages).toEqual([{ id: "new-leads", name: "Novos leads", order: 10, won: false, lost: false }]);
  });

  it("always joins won and lost stages independently of the funnel", () => {
    expect(consolidatedCRMStage({ name: "Venda realizada", won: true })).toMatchObject({ id: "won", name: "Vendas ganhas" });
    expect(consolidatedCRMStage({ name: "Não fechou", lost: true })).toMatchObject({ id: "lost", name: "Perdidas" });
  });

  it("joins SDR and opportunity variants from different RD funnels", () => {
    const stages = consolidateCRMPipeline([
      { id: "a", name: "SDR", order: 2 },
      { id: "b", name: "Não Atendeu - SDR", order: 3 },
      { id: "c", name: "Oportunidade", order: 4 },
      { id: "d", name: "Oportunidades", order: 5 },
    ]);

    expect(stages).toEqual([
      { id: "sdr", name: "SDR", order: 18, won: false, lost: false },
      { id: "opportunity", name: "Oportunidades", order: 45, won: false, lost: false },
    ]);
  });

  it("excludes only the legacy Dr Junior stage from the Ranniely Aluna funnel", () => {
    expect(isExcludedLegacyRannielyStage("Dra. Ranniely Silva – Aluna", "Leads Antigos do Junior")).toBe(true);
    expect(isExcludedLegacyRannielyStage("Dra. Ranniely Silva – Paciente modelo", "Leads antigos do Dr Junior")).toBe(false);
    expect(isExcludedLegacyRannielyStage("Dra. Ranniely Silva – Aluna", "Novos leads")).toBe(false);
  });

  it("applies the legacy exclusion to every dashboard data source", () => {
    const rows = filterOperationalRDDeals([
      { rd_funnel_id: "aluna", rd_stage_name: "Leads Antigos do Junior", id: "legacy" },
      { rd_funnel_id: "aluna", rd_stage_name: "Venda Realizada", id: "sale" },
      { rd_funnel_id: "model", rd_stage_name: "Leads Antigos do Junior", id: "model" },
    ], [
      { id: "aluna", name: "Dra. Ranniely Silva – Aluna" },
      { id: "model", name: "Dra. Ranniely Silva – Paciente Modelo" },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["sale", "model"]);
  });
});
