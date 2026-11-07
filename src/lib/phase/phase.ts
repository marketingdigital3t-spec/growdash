/**
 * Motor de fases da Growdash.
 *
 * A fase e derivada do faturamento do mes corrente. Subir de fase e
 * imediato; descer de fase so acontece na virada do mes (ver
 * `resolvePhaseWithHistory`).
 */

export type Phase = "terra" | "orbita" | "galaxia";

export const PHASES = {
  terra: { min: 0, max: 50_000, label: "TERRA", order: 1 },
  orbita: { min: 50_000.01, max: 100_000, label: "ÓRBITA", order: 2 },
  galaxia: { min: 100_000.01, max: Infinity, label: "GALÁXIA", order: 3 },
} as const;

export const PHASE_ORDER: Phase[] = ["terra", "orbita", "galaxia"];

export const PHASE_SUBTITLES: Record<Phase, string> = {
  terra: "Missão em andamento: R$ 0 a R$ 50 mil",
  orbita: "Missão em aceleração: R$ 50 mil a R$ 100 mil",
  galaxia: "Missão no topo: acima de R$ 100 mil",
};

/** Teto de faturamento que alimenta a barra de combustível de cada fase. */
export const PHASE_FUEL_CEILINGS: Record<Phase, number> = {
  terra: 50_000,
  orbita: 100_000,
  galaxia: 250_000,
};

export function getPhase(monthlyRevenue: number): Phase {
  if (monthlyRevenue === Number.POSITIVE_INFINITY) return "galaxia";
  const revenue = Number.isFinite(monthlyRevenue) ? monthlyRevenue : 0;
  if (revenue >= PHASES.galaxia.min) return "galaxia";
  if (revenue >= PHASES.orbita.min) return "orbita";
  return "terra";
}

export function getFuelProgress(
  monthlyRevenue: number,
  phase: Phase,
  galaxyGoal?: number,
): { current: number; target: number; percent: number } {
  const target = phase === "galaxia"
    ? (galaxyGoal && galaxyGoal > 0 ? galaxyGoal : PHASE_FUEL_CEILINGS.galaxia)
    : PHASE_FUEL_CEILINGS[phase];
  const current = Number.isFinite(monthlyRevenue) ? monthlyRevenue : 0;
  const percent = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  return { current, target, percent };
}

/** Percentual de combustível consumido dentro da fase atual (para a proxima). */
export function getPhaseProgress(monthlyRevenue: number, phase: Phase): number {
  const revenue = Number.isFinite(monthlyRevenue) ? monthlyRevenue : 0;
  if (phase === "galaxia") return 100;
  const ceiling = PHASE_FUEL_CEILINGS[phase];
  return ceiling > 0 ? Math.max(0, Math.min(100, (revenue / ceiling) * 100)) : 0;
}

export type PhaseHistoryEntry = {
  phase: Phase;
  enteredAt: string;
  revenueAtEntry: number;
};

export type PhaseState = {
  currentPhase: Phase;
  highestPhaseEver: Phase;
  phaseHistory: PhaseHistoryEntry[];
};

/**
 * Decide a fase efetiva considerando o historico.
 *
 * Subir de fase e imediato. Descer de fase so e permitido na virada do mes:
 * o parametro `isMonthBoundary` libera a queda.
 */
export function resolvePhaseWithHistory(
  monthlyRevenue: number,
  state: PhaseState,
  isMonthBoundary = false,
): { phase: Phase; changed: boolean; direction: "up" | "down" | "none" } {
  const computed = getPhase(monthlyRevenue);
  if (computed === state.currentPhase) return { phase: computed, changed: false, direction: "none" };

  const currentOrder = PHASES[state.currentPhase].order;
  const computedOrder = PHASES[computed].order;

  if (computedOrder < currentOrder && !isMonthBoundary) {
    // Descida travada: a fase so cai no fechamento do mes.
    return { phase: state.currentPhase, changed: false, direction: "none" };
  }

  return {
    phase: computed,
    changed: true,
    direction: computedOrder > currentOrder ? "up" : "down",
  };
}

export function isNextPhaseInSight(monthlyRevenue: number, phase: Phase): boolean {
  const revenue = Number.isFinite(monthlyRevenue) ? monthlyRevenue : 0;
  if (phase === "galaxia") return false;
  const next = phase === "terra" ? "orbita" : "galaxia";
  return revenue >= PHASE_FUEL_CEILINGS[phase] * 0.9;
}
