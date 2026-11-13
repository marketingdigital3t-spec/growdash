import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const kpiCardSource = readFileSync(
  fileURLToPath(new URL("../ui/KpiCard.tsx", import.meta.url)),
  "utf8",
);
const orbitalFunnelSource = readFileSync(
  fileURLToPath(new URL("../cosmic/OrbitalFunnel.tsx", import.meta.url)),
  "utf8",
);
const anomalyRadarSource = readFileSync(
  fileURLToPath(new URL("../cosmic/AnomalyRadar.tsx", import.meta.url)),
  "utf8",
);
const missionDashboardSource = readFileSync(
  fileURLToPath(new URL("./MissionDashboard.tsx", import.meta.url)),
  "utf8",
);
const indexPageSource = readFileSync(
  fileURLToPath(new URL("../../pages/Index.tsx", import.meta.url)),
  "utf8",
);

describe("ETAPA 3 — Dashboard Completo da Missão", () => {
  it("implementa os 4 KpiCards com sparkline SVG e suporte a inversao de cor para custos", () => {
    expect(kpiCardSource).toContain("MiniSparkline");
    expect(kpiCardSource).toContain("invertChangeColor");
    expect(kpiCardSource).toContain("text-primary-neon");
    expect(kpiCardSource).toContain("font-display");
    expect(kpiCardSource).toContain("tabular-nums");
  });

  it("constrói o Funil Orbital da Missão com aneis conicos, foguete e 4 métricas de suporte", () => {
    expect(orbitalFunnelSource).toContain("Funil Orbital da Missão");
    expect(orbitalFunnelSource).toContain("SpaceRocket");
    expect(orbitalFunnelSource).toContain("Taxa conv. total");
    expect(orbitalFunnelSource).toContain("Ciclo médio");
    expect(orbitalFunnelSource).toContain("Ticket médio");
    expect(orbitalFunnelSource).toContain("Faturamento mês");
    expect(orbitalFunnelSource).toContain("conversionRate");
  });

  it("constrói o Radar de Anomalias com feixe giratorio 360 e lista de alertas operacionais", () => {
    expect(anomalyRadarSource).toContain("Radar de Anomalias");
    expect(anomalyRadarSource).toContain("conic-gradient");
    expect(anomalyRadarSource).toContain("animate-[spin_6s_linear_infinite]");
    expect(anomalyRadarSource).toContain("SEVERITY_CONFIG");
    expect(anomalyRadarSource).toContain('to="/alertas"');
    expect(anomalyRadarSource).toContain("Ver todos os alertas");
  });

  it("organiza o MissionDashboard com os 4 blocos solicitados (Investimento, Leads, CPL, Faturamento)", () => {
    expect(missionDashboardSource).toContain('label="Investimento"');
    expect(missionDashboardSource).toContain('label="Leads"');
    expect(missionDashboardSource).toContain('label="CPL"');
    expect(missionDashboardSource).toContain('label="Faturamento"');
    expect(missionDashboardSource).toContain("lg:col-span-8");
    expect(missionDashboardSource).toContain("lg:col-span-4");
    expect(missionDashboardSource).toContain("OrbitalFunnel");
    expect(missionDashboardSource).toContain("AnomalyRadar");
  });

  it("integra o PerformanceSummaryDashboard fiel à referência no Index.tsx", () => {
    expect(indexPageSource).toContain("<PerformanceSummaryDashboard");
    expect(indexPageSource).toContain("import { PerformanceSummaryDashboard }");
  });
});
