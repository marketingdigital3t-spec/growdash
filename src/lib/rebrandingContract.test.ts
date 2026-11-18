import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const rocketSource = readFileSync(
  new URL("../components/space/SpaceRocket.tsx", import.meta.url),
  "utf8",
);
const phaseBackgroundSource = readFileSync(
  new URL("../components/space/SpacePhaseBackground.tsx", import.meta.url),
  "utf8",
);
const commercialPageSource = readFileSync(
  new URL("../growdash/CommercialPage.tsx", import.meta.url),
  "utf8",
);
const financePageSource = readFileSync(
  new URL("../growdash/FinancePage.tsx", import.meta.url),
  "utf8",
);
const funnelAnalysisSource = readFileSync(
  new URL("../pages/FunnelAnalysis.tsx", import.meta.url),
  "utf8",
);

describe("contrato do rebranding e do growth intelligence", () => {
  it("os meteoros tem cabeca, cauda e a cor da fase", () => {
    // O `grayscale(1)` transformava os meteoros em riscos cinza sem brilho.
    expect(indexCss).not.toMatch(/\.space-phase-meteors\s*\{[^}]*grayscale/);
    expect(indexCss).toMatch(/\.space-phase-meteors i::before/);
    expect(indexCss).toMatch(/\.space-phase-meteors i::after/);
    expect(indexCss).toMatch(/\.space-phase-meteors i \{[^}]*drop-shadow/);
  });

  it("a fase tem mais meteoros conforme avanca", () => {
    expect(phaseBackgroundSource).toContain("function meteorCount");
    expect(phaseBackgroundSource).toMatch(/terra" \? 6 : phase === "orbita" \? 10 : 14/);
  });

  it("o foguete tem chama de combustao em tres camadas", () => {
    expect(rocketSource).toContain("rocket-flame-core");
    expect(rocketSource).toContain("rocket-flame-body");
    expect(rocketSource).toContain("rocket-flame-smoke");
    expect(rocketSource).toContain("space-rocket-flame");
    // Viewbox alto: o SVG rasteriza na densidade real e continua nitido em 8K.
    expect(rocketSource).toContain('viewBox="0 0 512 512"');
  });

  it("a chama do foguete respeita movimento reduzido", () => {
    expect(indexCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(indexCss).toMatch(/\.space-rocket-flame animate \{ display: none; \}/);
  });

  it("a textura 8K da Terra e usada com fallback 2K", () => {
    expect(phaseBackgroundSource).toContain("earth-8k-300dpi.jpg");
    expect(phaseBackgroundSource).toContain("earth-2k-web.jpg");
    // O `image-set` nao aceita `var()` dentro do `url()`, entao o caminho
    // do asset 8K aparece literal no CSS.
    expect(indexCss).toContain('image-set(url("/assets/growth/earth-8k-300dpi.jpg")');
    // A 2K segue como base da regra principal.
    expect(indexCss).toContain("var(--earth-texture)");
  });

  it("a troca de fase e animada, nao um corte", () => {
    expect(indexCss).toMatch(/@property --phase-color\s*\{[^}]*syntax:\s*"<color>"/);
    expect(indexCss).toMatch(/\.space-phase-bg \{[^}]*--phase-color 1\.4s/);
    // Cada fase tem a propria geometria no ceu.
    expect(indexCss).toContain('.space-phase-bg[data-phase="orbita"] .space-phase-planet');
    expect(indexCss).toContain('.space-phase-bg[data-phase="galaxia"] .space-phase-planet');
  });

  it("o painel de performance vem antes do rank da tripulacao", () => {
    // A posicao importa no JSX: o import do CrewRanking vem antes na
    // arvore de arquivos, entao a comparacao usa o uso no markup.
    const painel = commercialPageSource.indexOf("<SellerPerformancePanel");
    const rank = commercialPageSource.indexOf("<CrewRanking");
    expect(painel).toBeGreaterThan(-1);
    expect(rank).toBeGreaterThan(-1);
    expect(painel).toBeLessThan(rank);
  });

  it("a analise de funil mostra leads Meta + RD e leads por venda", () => {
    expect(funnelAnalysisSource).toContain("FunnelGrowthBlock");
    expect(funnelAnalysisSource).toContain("metaLeads");
    expect(funnelAnalysisSource).toContain("periodAnalytics.totalLeads");
    expect(funnelAnalysisSource).toContain("periodAnalytics.conversions");
  });

  it("o financeiro mostra o investimento semanal com meta e colocado", () => {
    expect(financePageSource).toContain("WeeklyInvestmentPanel");
    expect(financePageSource).toContain("buildWeeklyInvestment");
    expect(financePageSource).toContain("deriveWeeklyTarget");
    expect(financePageSource).toContain("traffic_investment_plans");
  });
});
