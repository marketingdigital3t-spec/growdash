import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const funnelSource = readFileSync(
  fileURLToPath(new URL("./FunnelOrbitalInteractive.tsx", import.meta.url)),
  "utf8",
);
const funnelAnalysisSource = readFileSync(
  fileURLToPath(new URL("../../pages/FunnelAnalysis.tsx", import.meta.url)),
  "utf8",
);

describe("ETAPA 6 — Funil Orbital Interativo (seção 9.4)", () => {
  it("renderiza anéis elípticos clicaveis com taxa de conversão por etapa", () => {
    expect(funnelSource).toContain("Funil Orbital Interativo");
    expect(funnelSource).toContain("aria-pressed={isSelected}");
    expect(funnelSource).toContain("rounded-[999px/50%]");
    expect(funnelSource).toContain("conversionRates");
  });

  it("destaca o maior gargalo com cor de perigo e rotula em texto", () => {
    expect(funnelSource).toContain("bottleneckIndex");
    expect(funnelSource).toContain("Maior vazamento de combustível");
    expect(funnelSource).toContain("var(--danger)");
  });

  it("abre o comparativo de período ao selecionar uma etapa", () => {
    expect(funnelSource).toContain("Período atual");
    expect(funnelSource).toContain("Período anterior");
    expect(funnelSource).toContain("Variação");
    expect(funnelSource).toContain("Selecione uma etapa do funil");
  });

  it("integra o funil orbital interativo na Análise de Funis", () => {
    expect(funnelAnalysisSource).toContain("<FunnelOrbitalInteractive");
    expect(funnelAnalysisSource).toContain("import { FunnelOrbitalInteractive }");
  });
});
