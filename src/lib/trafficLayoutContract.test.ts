import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignsSource = readFileSync(
  new URL("../pages/Campaigns.tsx", import.meta.url),
  "utf8",
);
const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("contrato de layout do trafego pago", () => {
  it("os controles do header podem quebrar em vez de transbordar", () => {
    // Com `shrink-0` e altura travada, os botoes da direita saiam da
    // viewport e ficavam inalcancaveis — o bug visual do topo.
    expect(campaignsSource).toContain("campaign-app-header flex min-w-0 flex-wrap items-center");
    expect(campaignsSource).toContain("ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3");
    expect(campaignsSource).not.toContain("ml-auto flex shrink-0 items-center gap-3");
  });

  it("o CSS nao trava mais a altura do header de campanhas", () => {
    const bloco = indexCss.match(/\.campaigns-workspace \.campaign-app-header \{[^}]*\}/g) ?? [];
    const comAlturaTravada = bloco.filter((regra) => /height:\s*56px !important/.test(regra));
    // A regra que travava a altura foi trocada por uma que permite quebra.
    expect(comAlturaTravada.every((regra) => /height:\s*auto !important/.test(regra))).toBe(true);
    expect(indexCss).toMatch(/\.campaigns-workspace \.campaign-app-header \{[^}]*flex-wrap: wrap/);
  });
});
