import { describe, expect, it } from "vitest";
import {
  getFuelProgress,
  getPhase,
  isNextPhaseInSight,
  resolvePhaseWithHistory,
  PHASES,
  type PhaseState,
} from "./phase";

describe("motor de fases — calculo por faturamento", () => {
  it("aplica os tetos exatos definidos no prompt mestre", () => {
    // Terra: 0 ate 50.000,00
    expect(getPhase(0)).toBe("terra");
    expect(getPhase(25_000)).toBe("terra");
    expect(getPhase(50_000)).toBe("terra");

    // Orbita: 50.000,01 ate 100.000,00
    expect(getPhase(50_000.01)).toBe("orbita");
    expect(getPhase(75_000)).toBe("orbita");
    expect(getPhase(100_000)).toBe("orbita");

    // Galaxia: acima de 100.000,00
    expect(getPhase(100_000.01)).toBe("galaxia");
    expect(getPhase(250_000)).toBe("galaxia");
    expect(getPhase(1_000_000)).toBe("galaxia");
  });

  it("trata entradas invalidas caindo com seguranca em Terra", () => {
    expect(getPhase(-100)).toBe("terra");
    expect(getPhase(Number.NaN)).toBe("terra");
    expect(getPhase(Number.POSITIVE_INFINITY)).toBe("galaxia");
  });

  it("calcula o combustivel da missao por fase", () => {
    expect(getFuelProgress(25_000, "terra")).toEqual({
      current: 25_000,
      target: 50_000,
      percent: 50,
    });
    expect(getFuelProgress(75_000, "orbita")).toEqual({
      current: 75_000,
      target: 100_000,
      percent: 75,
    });
    expect(getFuelProgress(150_000, "galaxia", 300_000)).toEqual({
      current: 150_000,
      target: 300_000,
      percent: 50,
    });
  });

  it("alerta proxima fase a vista quando passa de 90% do teto", () => {
    expect(isNextPhaseInSight(44_999, "terra")).toBe(false);
    expect(isNextPhaseInSight(45_000, "terra")).toBe(true);
    expect(isNextPhaseInSight(89_999, "orbita")).toBe(false);
    expect(isNextPhaseInSight(90_000, "orbita")).toBe(true);
    expect(isNextPhaseInSight(500_000, "galaxia")).toBe(false); // Galaxia ja e o topo
  });

  it("sobe de fase imediatamente", () => {
    const state: PhaseState = {
      currentPhase: "terra",
      highestPhaseEver: "terra",
      phaseHistory: [],
    };
    const result = resolvePhaseWithHistory(55_000, state, false);
    expect(result).toEqual({ phase: "orbita", changed: true, direction: "up" });
  });

  it("bloqueia descida de fase antes da virada do mes", () => {
    const state: PhaseState = {
      currentPhase: "orbita",
      highestPhaseEver: "orbita",
      phaseHistory: [],
    };
    // O faturamento cai (estorno, mudanca de filtro), mas nao e dia 1.
    const midMonth = resolvePhaseWithHistory(30_000, state, false);
    expect(midMonth).toEqual({ phase: "orbita", changed: false, direction: "none" });

    // Na virada do mes a descida e liberada sem atrito.
    const monthBoundary = resolvePhaseWithHistory(30_000, state, true);
    expect(monthBoundary).toEqual({ phase: "terra", changed: true, direction: "down" });
  });
});
