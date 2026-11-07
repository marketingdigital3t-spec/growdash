import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import { PHASES, type Phase } from "@/lib/phase/phase";
import { PhaseTransitionOverlay } from "@/components/phase/PhaseTransitionOverlay";
import { AchievementModal } from "@/components/phase/AchievementModal";

/**
 * Aplica `data-phase` no <html> e orquestra a experiencia cinematografica
 * de evolucao de fase + modal de conquista hexagonal (secao 8).
 */
export function PhaseProvider({ children }: { children: ReactNode }) {
  const phase = useEffectivePhase();
  const monthlyRevenue = usePhaseStore((state) => state.monthlyRevenue);
  const lastPhaseRef = useRef<Phase>(phase);

  const [activeTransition, setActiveTransition] = useState<{
    from: Phase;
    to: Phase;
    revenue: number;
  } | null>(null);
  const [achievementPhase, setAchievementPhase] = useState<Phase | null>(null);

  useEffect(() => {
    document.documentElement.dataset.phase = phase;
    document.documentElement.dataset.spacePhase = phase;

    const previous = lastPhaseRef.current;
    if (previous && previous !== phase) {
      const prevOrder = PHASES[previous].order;
      const nextOrder = PHASES[phase].order;
      // Dispara animacao apenas quando SOBE de fase
      if (nextOrder > prevOrder) {
        setActiveTransition({ from: previous, to: phase, revenue: monthlyRevenue || PHASES[phase].min });
      }
    }
    lastPhaseRef.current = phase;
  }, [phase, monthlyRevenue]);

  const handleTransitionComplete = () => {
    const target = activeTransition?.to ?? null;
    setActiveTransition(null);
    if (target) {
      setAchievementPhase(target);
    }
  };

  return (
    <>
      {children}
      {/* Animacao cinematografica em tela cheia */}
      <PhaseTransitionOverlay
        transition={activeTransition}
        onComplete={handleTransitionComplete}
      />
      {/* Badge de conquista hexagonal com opcao de compartilhamento */}
      <AchievementModal
        phase={achievementPhase}
        revenue={monthlyRevenue || (achievementPhase ? PHASES[achievementPhase].min : 0)}
        onClose={() => setAchievementPhase(null)}
      />
    </>
  );
}

/** Seletor de fase para desenvolvimento (Ctrl+Shift+P). */
export function PhaseDevSwitcher() {
  const devOverride = usePhaseStore((state) => state.devOverride);
  const setDevOverride = usePhaseStore((state) => state.setDevOverride);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey && (event.key === "P" || event.key === "p"))) return;
      event.preventDefault();
      const order: Phase[] = ["terra", "orbita", "galaxia"];
      const current = devOverride ?? "terra";
      const next = order[(order.indexOf(current) + 1) % order.length];
      setDevOverride(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [devOverride, setDevOverride]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[400] flex items-center gap-2 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-[11px] font-bold text-white shadow-2xl backdrop-blur-xl">
      <span className="text-white/60">Fase (dev)</span>
      {(["terra", "orbita", "galaxia"] as Phase[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setDevOverride(option)}
          className={`rounded-md px-2 py-1 uppercase transition ${
            devOverride === option ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
          }`}
        >
          {option}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setDevOverride(null)}
        className="rounded-md border border-white/15 px-2 py-1 text-white/60 transition hover:text-white"
      >
        auto
      </button>
    </div>
  );
}
