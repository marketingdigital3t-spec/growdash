import { useEffect, type ReactNode } from "react";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import type { Phase } from "@/lib/phase/phase";

/**
 * Aplica `data-phase` no <html> e mantem o layout em sincronia com a fase
 * efetiva (faturamento do mes ou override de desenvolvimento).
 */
export function PhaseProvider({ children }: { children: ReactNode }) {
  const phase = useEffectivePhase();

  useEffect(() => {
    document.documentElement.dataset.phase = phase;
    document.documentElement.dataset.spacePhase = phase;
  }, [phase]);

  return <>{children}</>;
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
