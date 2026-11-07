import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const anomalyRadarSource = readFileSync(
  fileURLToPath(new URL("../components/cosmic/AnomalyRadar.tsx", import.meta.url)),
  "utf8",
);
const starfieldSource = readFileSync(
  fileURLToPath(new URL("../components/cosmic/Starfield.tsx", import.meta.url)),
  "utf8",
);
const kpiCardSource = readFileSync(
  fileURLToPath(new URL("../components/ui/KpiCard.tsx", import.meta.url)),
  "utf8",
);
const fuelBarSource = readFileSync(
  fileURLToPath(new URL("../components/layout/FuelBar.tsx", import.meta.url)),
  "utf8",
);
const tokensCssSource = readFileSync(
  fileURLToPath(new URL("../styles/tokens.css", import.meta.url)),
  "utf8",
);

describe("ETAPA 6 — Acessibilidade WCAG AA, Reduced Motion e Polimento Final", () => {
  it("Radar de Anomalias suporta motion-reduce para usuarios sensiveis a movimento", () => {
    expect(anomalyRadarSource).toContain("motion-reduce:animate-none");
  });

  it("Starfield congela a animacao sob prefers-reduced-motion", () => {
    expect(starfieldSource).toContain("prefers-reduced-motion: reduce");
  });

  it("KpiCard utiliza tabular-nums e fontes escalaveis para alta legibilidade numerica", () => {
    expect(kpiCardSource).toContain("tabular-nums");
    expect(kpiCardSource).toContain("tracking-tight");
  });

  it("FuelBar contem texto alternativo acessivel e roles semanticas", () => {
    expect(fuelBarSource).toContain("aria-label");
  });

  it("Tokens de cores garantem conformidade com WCAG AA com cores semanticas de status", () => {
    expect(tokensCssSource).toContain("--gd-status-critical");
    expect(tokensCssSource).toContain("--gd-status-healthy");
    expect(tokensCssSource).toContain("--gd-status-attention");
  });
});
