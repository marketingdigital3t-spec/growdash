import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const alertsPageSource = readFileSync(
  fileURLToPath(new URL("./Alerts.tsx", import.meta.url)),
  "utf8",
);
const settingsPageSource = readFileSync(
  fileURLToPath(new URL("./Settings.tsx", import.meta.url)),
  "utf8",
);
const funnelAnalysisPageSource = readFileSync(
  fileURLToPath(new URL("./FunnelAnalysis.tsx", import.meta.url)),
  "utf8",
);
const trafficPageSource = readFileSync(
  fileURLToPath(new URL("../growdash/TrafficPage.tsx", import.meta.url)),
  "utf8",
);

describe("ETAPA 5 — Migração Tela por Tela", () => {
  it("5.2 Funil de Conversão: integra análise de gargalos, conversão por etapa e heatmap", () => {
    expect(funnelAnalysisPageSource).toContain("FunnelBottlenecks");
    expect(funnelAnalysisPageSource).toContain("FunnelStageConversion");
    expect(funnelAnalysisPageSource).toContain("FunnelConversionHeatmap");
  });

  it("5.3 Alertas e Radar: integra o AnomalyRadar em destaque e seletor de severidade", () => {
    expect(alertsPageSource).toContain("AnomalyRadar");
    expect(alertsPageSource).toContain("Alertas e Radar de Anomalias");
    expect(alertsPageSource).toContain("severityFilter");
  });

  it("5.4 Configurações: integra o seletor visual de temas PlatformThemePicker", () => {
    expect(settingsPageSource).toContain("PlatformThemePicker");
  });

  it("5.5 Tráfego Pago: apresenta tabela consolidada de campanhas e métricas de ROAS", () => {
    expect(trafficPageSource).toContain("Consolidado de leads por campanha");
    expect(trafficPageSource).toContain("ROAS");
  });
});
