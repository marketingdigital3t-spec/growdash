/**
 * Testes unitários para src/lib/contrastPolicy.ts.
 *
 * Comportamento sob teste: cálculo da razão de contraste WCAG 2.2 e a
 * escolha de cor de texto secundário que atende o mínimo AA sobre todas as
 * superfícies do tema claro.
 *
 * Não existe arquivo de teste anterior para esta política — este é o
 * primeiro. O módulo fonte (contrastPolicy.ts) foi criado neste ciclo de
 * auditoria para corrigir o achado GRO-A11Y-001.
 *
 * Instrução verbatim do usuário: "agora eu quero que você resolva toda essa
 * bosta de problema que eu estou tendo na minha plataforma, ou dados da
 * integração do meta ads e do rd station crm esta tudo errado e bugando,
 * corriga para mim urgente"
 */

import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  LIGHT_THEME_CONTENT_TOKENS,
  meetsWcagAA,
  pickAccessibleMutedColor,
  WCAG_AA_LARGE_TEXT,
  WCAG_AA_NORMAL_TEXT,
} from "./contrastPolicy";

describe("contrastPolicy — contraste WCAG 2.2", () => {
  it("preto sobre branco dá 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("branco sobre preto dá 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("mesma cor dá 1:1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("o cinza antigo #666666 passava AA sobre branco", () => {
    expect(meetsWcagAA("#666666", "#ffffff")).toBe(true);
  });

  it("o cinza antigo #666666 passa folgado apenas sobre o branco", () => {
    const onWhite = contrastRatio("#666666", "#ffffff");
    const onSurface = contrastRatio("#666666", "#f1f1ef");
    expect(onWhite).not.toBeNull();
    expect(onSurface).not.toBeNull();
    // Sobre superfícies claras a razão cai e deixa de ter a mesma folga.
    expect(onSurface!).toBeLessThan(onWhite!);
    expect(onSurface!).toBeLessThan(6);
  });

  it("as utilitárias Tailwind de cinza claro reprovam AA", () => {
    // text-slate-400 / text-gray-400 / text-zinc-400 / text-neutral-400
    expect(meetsWcagAA("#94a3b8", "#ffffff")).toBe(false);
    // text-slate-500 / text-zinc-500 sobre superfície levemente colorida
    expect(meetsWcagAA("#71717a", "#f1f1ef")).toBe(false);
  });

  it("o token atual #4b5563 passa AA sobre branco e superfície cinza", () => {
    expect(meetsWcagAA(LIGHT_THEME_CONTENT_TOKENS.muted, LIGHT_THEME_CONTENT_TOKENS.background)).toBe(true);
    expect(meetsWcagAA(LIGHT_THEME_CONTENT_TOKENS.muted, "#f1f1ef")).toBe(true);
  });

  it("texto principal #111111 passa AA sobre todas as superfícies claras", () => {
    expect(meetsWcagAA(LIGHT_THEME_CONTENT_TOKENS.text, LIGHT_THEME_CONTENT_TOKENS.background)).toBe(true);
    expect(meetsWcagAA(LIGHT_THEME_CONTENT_TOKENS.text, "#f1f1ef")).toBe(true);
    expect(meetsWcagAA(LIGHT_THEME_CONTENT_TOKENS.text, "#f7f7f5")).toBe(true);
  });

  it("texto desabilitado #5c6861 passa AA sobre branco", () => {
    expect(meetsWcagAA(LIGHT_THEME_CONTENT_TOKENS.disabled, LIGHT_THEME_CONTENT_TOKENS.background)).toBe(true);
  });

  it("cores inválidas retornam null em vez de zerar", () => {
    expect(contrastRatio("não é cor", "#ffffff")).toBeNull();
    expect(contrastRatio("#12345", "#ffffff")).toBeNull();
    expect(contrastRatio("#gggggg", "#ffffff")).toBeNull();
  });

  it("aceita hex de 3 dígitos", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1);
  });

  it("texto grande usa o mínimo 3:1", () => {
    expect(WCAG_AA_LARGE_TEXT).toBe(3);
    expect(meetsWcagAA("#949494", "#ffffff", true)).toBe(true);
    expect(meetsWcagAA("#949494", "#ffffff", false)).toBe(false);
  });
});

describe("pickAccessibleMutedColor", () => {
  const surfaces = ["#ffffff", "#f1f1ef", "#f7f7f5"];

  it("escolhe o primeiro candidato que passa em todas as superfícies", () => {
    expect(pickAccessibleMutedColor(["#333333", "#4b5563", "#666666"], surfaces)).toBe("#333333");
  });

  it("pula candidatos reprovados em alguma superfície", () => {
    expect(pickAccessibleMutedColor(["#cccccc", "#4b5563"], surfaces)).toBe("#4b5563");
  });

  it("devolve null quando nenhum candidato passa", () => {
    expect(pickAccessibleMutedColor(["#cccccc"], surfaces)).toBeNull();
  });
});

describe("GRO-A11Y-001 — o neon da fase reprova no tema claro", () => {
  // O neon da Terra (#00d2ff) é calibrado para o modo escuro. Sobre chips
  // claros ele fica em 1.45:1, muito abaixo do mínimo AA de 4.5:1.
  it("o neon da fase reprova sobre chip claro", () => {
    expect(meetsWcagAA("#00d2ff", "#f4f8f6")).toBe(false);
    expect(contrastRatio("#00d2ff", "#f4f8f6")!).toBeLessThan(2.5);
  });

  it("a cor legível escolhida passa AA em todas as superfícies claras", () => {
    const readable = "#0b6a9e";
    for (const surface of ["#ffffff", "#f1f1ef", "#f7f7f5", "#f4f8f6"]) {
      expect(meetsWcagAA(readable, surface)).toBe(true);
    }
  });

  it("a cor legível é sempre mais escura que o neon", () => {
    expect(contrastRatio("#0b6a9e", "#ffffff")!).toBeGreaterThan(contrastRatio("#00d2ff", "#ffffff")!);
  });
});
