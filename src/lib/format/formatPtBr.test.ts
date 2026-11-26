import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDateBr,
  formatDecimal,
  formatInteger,
  formatMultiple,
  formatPercent,
} from "./formatPtBr";

describe("formatacao pt-BR do design system", () => {
  it("formata moeda no padrao R$ 1.245.000,00", () => {
    // Espaco quebravel vs inquebravel: normalizamos espacos para comparacao estavel
    const normalize = (s: string) => s.replace(/\s/g, " ");
    expect(normalize(formatCurrency(1_245_000))).toBe("R$ 1.245.000,00");
    expect(normalize(formatCurrency(0))).toBe("R$ 0,00");
    expect(normalize(formatCurrency(-368.4))).toMatch(/-?R\$\s*368,40/);
    expect(normalize(formatCurrency(null))).toBe("R$ 0,00");
  });

  it("formata inteiros com separador de milhar brasileiro", () => {
    expect(formatInteger(33_214)).toBe("33.214");
    expect(formatInteger(24_750_521)).toBe("24.750.521");
    expect(formatInteger(0)).toBe("0");
  });

  it("formata percentuais e multiplicadores", () => {
    expect(formatPercent(18.6)).toBe("18,6%");
    expect(formatPercent(22.4, 1)).toBe("22,4%");
    expect(formatMultiple(4.37)).toBe("4,37x");
    expect(formatMultiple(0)).toBe("0,00x");
  });

  it("formata datas no padrao dd/mm/aaaa", () => {
    const date = new Date("2026-11-06T12:00:00Z");
    expect(formatDateBr(date)).toBe("06/11/2026");
    expect(formatDateBr("2026-08-20")).toBe("20/08/2026");
    expect(formatDateBr(null)).toBe("—");
  });
});
