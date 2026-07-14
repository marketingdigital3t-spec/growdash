import { describe, expect, it } from "vitest";
import { splitTrafficAIReport } from "./trafficAIReport";

describe("splitTrafficAIReport", () => {
  it("separa todas as seções obrigatórias mesmo com acentos", () => {
    const report = [
      "## RESUMO EXECUTIVO", "Resumo", "## CAMPANHAS", "Campanhas",
      "## CONJUNTOS", "Conjuntos", "## ANÚNCIOS", "Anúncios",
      "## PLANO DE AÇÃO", "Ações", "## PROJEÇÕES", "Projeções",
    ].join("\n");
    const sections = splitTrafficAIReport(report);
    expect(sections.summary).toContain("Resumo");
    expect(sections.campaigns).toContain("Campanhas");
    expect(sections.adsets).toContain("Conjuntos");
    expect(sections.ads).toContain("Anúncios");
    expect(sections.actions).toContain("Ações");
    expect(sections.projections).toContain("Projeções");
  });

  it("preserva uma resposta sem títulos no resumo", () => {
    expect(splitTrafficAIReport("Resposta parcial").summary).toContain("Resposta parcial");
  });
});
