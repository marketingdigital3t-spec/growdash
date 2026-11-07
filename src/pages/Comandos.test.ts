import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const comandosSource = readFileSync(
  fileURLToPath(new URL("./Comandos.tsx", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../App.tsx", import.meta.url)),
  "utf8",
);
const navSource = readFileSync(
  fileURLToPath(new URL("../growdash/navigation.ts", import.meta.url)),
  "utf8",
);

describe("ETAPA 5 — Central de Comandos da Missão com IA (seção 9.2)", () => {
  it("implementa o console da nave com input de IA e chips sugeridos", () => {
    expect(comandosSource).toContain("Central de Comando da Missão");
    expect(comandosSource).toContain("Digite um comando para a missão");
    expect(comandosSource).toContain("Pausar anúncios com CPL acima da meta");
    expect(comandosSource).toContain("Redistribuir verba para campanhas com maior ROAS");
  });

  it("exibe os contadores de impacto da IA (horas economizadas, acoes executadas)", () => {
    expect(comandosSource).toContain("Horas Economizadas");
    expect(comandosSource).toContain("Ações Executadas");
    expect(comandosSource).toContain("Impacto Estimado");
  });

  it("lista as recomendações com diagnóstico, confiança e botão aprovar", () => {
    expect(comandosSource).toContain("Recomendações da Missão");
    expect(comandosSource).toContain("Aprovar e executar");
    expect(comandosSource).toContain("confiança");
    expect(comandosSource).toContain("Log de Bordo");
  });

  it("registra a rota /comandos no roteador e no menu MISSÃO", () => {
    expect(appSource).toContain('path="comandos"');
    expect(navSource).toContain('path: "/comandos"');
    expect(navSource).toContain('label: "Comandos"');
  });
});
