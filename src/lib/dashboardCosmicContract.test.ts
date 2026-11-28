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
    // O redesign trocou a cena cósmica pela "prévia da plataforma": o card
    // de acesso é centralizado pela própria composição em vez de um
    // deslocamento artificial do painel.
    expect(indexCss).toMatch(/\.auth-preview-login\s*\{[^}]*width:\s*min\(100%\s*-\s*32px,\s*468px\)/);
    expect(indexCss).toMatch(/\.auth-preview\s*\{[^}]*display:\s*grid[^}]*place-items:\s*center/);
  });

  it("a tela de login mantem a previa da plataforma ao fundo", () => {
    // O painel do dashboard ao fundo substitui o foguete: e a mesma ideia de
    // "mostrar o produto antes de entrar", agora com os tokens da fase.
    expect(indexCss).toContain(".auth-preview-dashboard");
    expect(indexCss).toContain(".auth-preview-metrics");
    expect(indexCss).not.toContain("auth-cosmic-right-panel");
  });
});
