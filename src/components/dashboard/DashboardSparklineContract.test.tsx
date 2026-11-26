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

describe("Dashboard — cards de KPI sem sparkline", () => {
  it("o card nao renderiza sparkline", () => {
    // A sparkline ocupava a metade direita do card e empurrava o valor para
    // fora da area util. O card deve ter apenas icone, rotulo e valor.
    expect(kpiCardSource).not.toContain("MiniSparkline");
  });

  it("a prop sparklineData deixa de existir no contrato do card", () => {
    expect(kpiCardSource).not.toContain("sparklineData");
  });

  it("nenhum card do Dashboard passa sparklineData", () => {
    expect(missionDashboardSource).not.toContain("sparklineData");
  });

  it("o valor continua sendo exibido com truncate", () => {
    // Remover a sparkline nao pode remover a protecao de layout do valor.
    expect(kpiCardSource).toMatch(/<strong className="[^"]*min-w-0[^"]*truncate[^"]*font-display/);
  });

  it("o icone e o rotulo continuam presentes", () => {
    expect(kpiCardSource).toContain("{icon}");
    expect(kpiCardSource).toMatch(/<p className="min-w-0 truncate text-right/);
  });
});
