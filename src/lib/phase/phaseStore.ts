import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  getPhase,
  resolvePhaseWithHistory,
  sanitizePhase,
  type Phase,
  type PhaseHistoryEntry,
} from "@/lib/phase/phase";
import { safeSetLocalStorage } from "@/lib/localCache";

/**
 * Storage seguro que NUNCA deixa uma `QuotaExceededError` escapar.
 * A cota do navegador pode estourar com caches historicos acumulados; a
 * falha precisa ficar contida para nao derrubar o React durante o render.
 */
const safePhaseStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    safeSetLocalStorage(name, value);
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

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
      storage: createJSONStorage(() => safePhaseStorage),
      partialize: (state) => ({
        currentPhase: state.currentPhase,
        highestPhaseEver: state.highestPhaseEver,
        phaseHistory: (state.phaseHistory || []).slice(-10),
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
