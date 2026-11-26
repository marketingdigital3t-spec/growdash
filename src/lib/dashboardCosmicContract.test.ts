import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const radarSource = readFileSync(
  new URL("../components/cosmic/AnomalyRadar.tsx", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(
  new URL("../components/dashboard/MissionDashboard.tsx", import.meta.url),
  "utf8",
);
const funnelSource = readFileSync(
  new URL("../components/cosmic/OrbitalFunnel.tsx", import.meta.url),
  "utf8",
);
const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("contrato do dashboard da missao", () => {
  it("o radar nao mantem mais uma lista de anomalias fixas", () => {
    // A lista fixa citava campanhas e valores que nao existiam na operacao
    // do usuario ("Black Premium", "R$ 38,45", "Lançamento 6.0").
    expect(radarSource).not.toContain("DEFAULT_ANOMALIES");
    expect(radarSource).not.toContain("Black Premium");
    expect(radarSource).not.toContain("Lançamento 6.0");
    expect(radarSource).not.toContain("R$ 38,45");
    expect(radarSource).not.toContain("R$ 12.450");
    expect(radarSource).not.toContain("Página de Vendas");
  });

  it("o radar deriva os alertas das metricas reais", () => {
    expect(radarSource).toContain("deriveMissionAnomalies");
    expect(dashboardSource).toContain("<AnomalyRadar");
    expect(dashboardSource).toContain("metrics={{");
  });

  it("as 4 metricas de apoio do funil ficam em uma linha so", () => {
    // `grid-cols-2 lg:grid-cols-4` quebrava a 4a metrica em uma segunda
    // linha em telas medias, deixando o card com um bloco orfao embaixo.
    expect(funnelSource).toContain("grid grid-cols-4");
    expect(funnelSource).not.toContain("grid-cols-2 lg:grid-cols-4");
  });

  it("a tela de login fica centralizada na vertical", () => {
    expect(indexCss).toMatch(/\.auth-cosmic-right-panel\s*\{[^}]*top:\s*50%[^}]*transform:\s*translateY\(-50%\)/);
  });

  it("o foguete da tela de login desce um pouco", () => {
    // O deslocamento vertical da arte foi de 44% para 38%: a nave estava
    // colada no topo da tela.
    expect(indexCss).toContain("background-position: center 38%");
  });
});
