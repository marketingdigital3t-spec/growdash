import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const crmPage = readFileSync(
  new URL("../growdash/CrmPage.tsx", import.meta.url),
  "utf8",
);

describe("CRM board scope contract — espelho do RD Station", () => {
  it("reads the board from the same period scope as the calendar", () => {
    // O quadro não pode ler o pipeline inteiro: o recorte do calendário tem de
    // chegar até a consulta, senão todos os leads históricos aparecem.
    expect(crmPage).toContain('dateScope: preset === "max" ? "pipeline" : "period"');
    expect(crmPage).not.toContain('dateScope: "pipeline",');
  });

  it("filters the board cards by the active period and the advanced filters", () => {
    expect(crmPage).toContain("filterDealsByAdvancedCriteria(dealsInPipeline, boardScopeFilters)");
    expect(crmPage).toContain("advancedFilters.createdAt ?? calendarPeriod");
  });

  it("keeps every funnel stage visible even when the period empties a column", () => {
    // As colunas do funil continuam todas presentes (contagem 0), como no RD.
    expect(crmPage).toContain("for (const stage of visibleStoredStages) addCanonicalStage(stage);");
    expect(crmPage).toContain("for (const deal of dealsInPipeline) addCanonicalStage({");
  });

  it("exposes the RD Station filter drawer with creation, closing and contact dates", () => {
    expect(crmPage).toContain("CRMAdvancedFiltersSheet");
    expect(crmPage).toContain("advancedFilters");
    expect(crmPage).toContain("activeFilterChips");
  });
});
