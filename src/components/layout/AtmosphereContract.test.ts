import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const growdashLayoutSource = readFileSync(
  fileURLToPath(new URL("../../growdash/GrowdashLayout.tsx", import.meta.url)),
  "utf8",
);
const appLayoutSource = readFileSync(
  fileURLToPath(new URL("../AppLayout.tsx", import.meta.url)),
  "utf8",
);
const tokensCssSource = readFileSync(
  fileURLToPath(new URL("../../styles/tokens.css", import.meta.url)),
  "utf8",
);

describe("ETAPA 4 — Atmosfera Global, Superfícies e Profundidade", () => {
  it("aplica .gd-nebula-bg no container mestre do GrowdashLayout e AppLayout", () => {
    expect(growdashLayoutSource).toContain("gd-nebula-bg");
    expect(appLayoutSource).toContain("gd-nebula-bg");
  });

  it("adiciona camada fixa .gd-noise-overlay com 3.5% de opacidade orgânica", () => {
    expect(growdashLayoutSource).toContain("gd-noise-overlay");
    expect(appLayoutSource).toContain("gd-noise-overlay");
    expect(tokensCssSource).toContain(".gd-noise-overlay");
    expect(tokensCssSource).toContain("opacity='0.035'");
  });

  it("garante que a camada de ruído tem pointer-events-none para não bloquear cliques", () => {
    expect(growdashLayoutSource).toContain("pointer-events-none");
    expect(appLayoutSource).toContain("pointer-events-none");
  });
});
