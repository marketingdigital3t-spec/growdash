import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const switchSource = readFileSync(
  new URL("../components/ui/switch.tsx", import.meta.url),
  "utf8",
);
const premiumSource = readFileSync(
  new URL("../styles/premium.css", import.meta.url),
  "utf8",
);
const indexSource = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8",
);

describe("contraste do switch (toggle) nos dois modos de tema", () => {
  it("não usa a cor do fundo para a bolinha", () => {
    // `--background` é quase preto no modo escuro: com ele, a bolinha some
    // sobre o trilho e o estado do controle fica ilegível.
    expect(switchSource).toContain("bg-[var(--switch-thumb)]");
    expect(switchSource).not.toContain("bg-background");
  });

  it("define a cor da bolinha para o modo claro e para o modo escuro", () => {
    const light = premiumSource.match(/html:not\(\.dark\)[\s\S]*?--switch-thumb:\s*([^;]+);/);
    const dark = premiumSource.match(/html\.dark[\s\S]*?--switch-thumb:\s*([^;]+);/);

    expect(light?.[1]?.trim()).toBeTruthy();
    expect(dark?.[1]?.trim()).toBeTruthy();
  });

  it("mantém a bolinha clara nos dois modos", () => {
    const light = premiumSource.match(/html:not\(\.dark\)[\s\S]*?--switch-thumb:\s*([^;]+);/)?.[1]?.trim();
    const dark = premiumSource.match(/html\.dark[\s\S]*?--switch-thumb:\s*([^;]+);/)?.[1]?.trim();

    // Branco puro nos dois: é a única cor que contrasta com o trilho tanto
    // no verde-claro do modo claro quanto no cinza-azulado do modo escuro.
    // Hex completo: o shorthand `background` recusa HSL sem tipo de cor e
    // zera a propriedade, deixando a bolinha invisível.
    expect(light).toBe("#FFFFFF");
    expect(dark).toBe("#FFFFFF");
  });

  it("não força mais uma bolinha preta nos switches do modo escuro", () => {
    // A regra antiga aplicava `--gd-control-active-thumb` (#05070C) com
    // !important em todo `[role="switch"][data-state="checked"] > span`.
    // Era ela que vencia a cor da classe e escondia a bolinha.
    const forced = indexSource.match(
      /\[role="switch"\]\[data-state="checked"\][^{]*\{[^}]*--gd-control-active-thumb[^}]*\}/,
    );
    expect(forced).toBeNull();

    // A regra vigente usa a variável de bolinha clara.
    expect(indexSource).toMatch(
      /\[role="switch"\]\[data-state="checked"\][^{]*\{[^}]*--switch-thumb[^}]*\}/,
    );
  });

  it("mantém a bolinha escura no toggle de campanha, que usa trilho claro", () => {
    // O toggle de campanha pinta o próprio trilho claro no modo escuro; a
    // bolinha escura continua sendo a que contrasta com ele.
    expect(indexSource).toMatch(
      /\.campaign-row-toggle\[class\*="bg-\[#f3f4f6\]"\]\s*>\s*span\s*\{[^}]*background:\s*#090909\s*!important/,
    );
  });
});
