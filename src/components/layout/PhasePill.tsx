import { useEffectivePhase } from "@/lib/phase/phaseStore";
import { PHASES, type Phase } from "@/lib/phase/phase";

interface PhasePillProps {
  overridePhase?: Phase;
  className?: string;
}

/**
 * Pill indicadora de fase no header.
 *
 * Exemplo: `FASE: TERRA` com borda neon e ponto pulsante na cor da fase ativa.
 */
export function PhasePill({ overridePhase, className = "" }: PhasePillProps) {
  const activePhase = useEffectivePhase();
  const phase = overridePhase ?? activePhase;
  const info = PHASES[phase];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-card-border-active bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-neon shadow-glow-sm backdrop-blur-md ${className}`}
      aria-label={`Fase atual: ${info.label}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-neon opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-neon shadow-[0_0_8px_currentColor]" />
      </span>
      <span>FASE: {info.label}</span>
    </span>
  );
}
