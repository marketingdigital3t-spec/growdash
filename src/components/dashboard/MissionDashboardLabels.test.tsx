import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const kpiCardSource = readFileSync(
  fileURLToPath(new URL("../ui/KpiCard.tsx", import.meta.url)),
  "utf8",
);
const missionDashboardSource = readFileSync(
  fileURLToPath(new URL("./MissionDashboard.tsx", import.meta.url)),
  "utf8",
);

describe("Dashboard — cards de KPI sem texto auxiliar cortado", () => {
  it("o rotulo do card pode encolher para o truncate funcionar", () => {
    // Sem min-w-0 o item flex nao cede espaco e o texto vaza para fora do
    // card em vez de ser cortado com reticencias.
    expect(kpiCardSource).toMatch(/<p className="min-w-0 truncate text-right/);
  });

  it("o valor do card e truncado em vez de estourar o layout", () => {
    expect(kpiCardSource).toMatch(/<strong className="min-w-0 truncate font-display/);
  });

  it("nenhum card do Dashboard passa texto auxiliar com contagem", () => {
    // O changeLabel era a linha de apoio embaixo do valor ("X vendas
    // realizadas", "total do periodo", "custo por lead", "Meta Ads"). Em tela
    // estreita ela era cortada e poluia o card sem acrescentar informacao.
    expect(missionDashboardSource).not.toContain("changeLabel=");
  });

  it("a variacao percentual continua sendo exibida", () => {
    // Remover o texto auxiliar nao pode remover a variacao: ela e o que
    // informa se a metrica subiu ou caiu.
    expect(missionDashboardSource).toContain("changePercent={safeMetrics.spendChange}");
    expect(missionDashboardSource).toContain("changePercent={safeMetrics.leadsChange}");
    expect(missionDashboardSource).toContain("changePercent={safeMetrics.cplChange}");
    expect(missionDashboardSource).toContain("changePercent={safeMetrics.revenueChange}");
  });
});
