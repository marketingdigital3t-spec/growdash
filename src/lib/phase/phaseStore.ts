import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getPhase,
  resolvePhaseWithHistory,
  sanitizePhase,
  type Phase,
  type PhaseHistoryEntry,
} from "@/lib/phase/phase";

type PhaseStore = {
  currentPhase: Phase;
  highestPhaseEver: Phase;
  phaseHistory: PhaseHistoryEntry[];
  /** Faturamento do mes corrente usado para derivar a fase. */
  monthlyRevenue: number;
  /** Fase forcada pelo seletor de desenvolvimento (Ctrl+Shift+P). */
  devOverride: Phase | null;
  setMonthlyRevenue: (revenue: number, isMonthBoundary?: boolean) => void;
  setDevOverride: (phase: Phase | null) => void;
  registerPhaseEntry: (phase: Phase, revenue: number) => void;
  reset: () => void;
};

const orderOf = (phase: Phase) => (phase === "terra" ? 1 : phase === "orbita" ? 2 : 3);

export const usePhaseStore = create<PhaseStore>()(
  persist(
    (set, get) => ({
      currentPhase: "terra",
      highestPhaseEver: "terra",
      phaseHistory: [],
      monthlyRevenue: 0,
      devOverride: null,

      setMonthlyRevenue: (revenue, isMonthBoundary = false) => {
        const state = get();
        const resolved = resolvePhaseWithHistory(
          revenue,
          {
            currentPhase: state.currentPhase,
            highestPhaseEver: state.highestPhaseEver,
            phaseHistory: state.phaseHistory,
          },
          isMonthBoundary,
        );

        const highestPhaseEver = orderOf(resolved.phase) > orderOf(state.highestPhaseEver)
          ? resolved.phase
          : state.highestPhaseEver;

        if (resolved.changed) {
          const entry: PhaseHistoryEntry = {
            phase: resolved.phase,
            enteredAt: new Date().toISOString(),
            revenueAtEntry: Number.isFinite(revenue) ? revenue : 0,
          };
          set({
            monthlyRevenue: revenue,
            currentPhase: resolved.phase,
            highestPhaseEver,
            phaseHistory: [...state.phaseHistory, entry],
          });
          return;
        }

        set({ monthlyRevenue: revenue, highestPhaseEver });
      },

      setDevOverride: (phase) => set({ devOverride: phase }),

      registerPhaseEntry: (phase, revenue) => {
        const state = get();
        const highestPhaseEver = orderOf(phase) > orderOf(state.highestPhaseEver)
          ? phase
          : state.highestPhaseEver;
        set({
          highestPhaseEver,
          phaseHistory: [
            ...state.phaseHistory,
            { phase, enteredAt: new Date().toISOString(), revenueAtEntry: revenue },
          ],
        });
      },

      reset: () =>
        set({
          currentPhase: "terra",
          highestPhaseEver: "terra",
          phaseHistory: [],
          monthlyRevenue: 0,
          devOverride: null,
        }),
    }),
    {
      name: "growdash:phase",
      partialize: (state) => ({
        currentPhase: state.currentPhase,
        highestPhaseEver: state.highestPhaseEver,
        phaseHistory: state.phaseHistory,
      }),
    },
  ),
);

/** Fase efetiva: o override de desenvolvimento tem prioridade e o retorno e sempre sanitizado. */
export function useEffectivePhase(): Phase {
  const currentPhase = usePhaseStore((state) => state.currentPhase);
  const devOverride = usePhaseStore((state) => state.devOverride);
  return sanitizePhase(devOverride ?? currentPhase);
}

export { getPhase };
