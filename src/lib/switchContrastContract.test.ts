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

describe("contraste do switch (toggle) nos dois modos de tema", () => {
  it("não usa a cor do fundo para a bolinha", () => {
    // `--background` é quase preto no modo escuro: com ele, a bolinha some
    // sobre o trilho e o estado do controle fica ilegível.
    expect(switchSource).toContain("bg-[hsl(var(--switch-thumb))]");
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
    expect(light).toBe("0 0% 100%");
    expect(dark).toBe("0 0% 100%");
  });
});
