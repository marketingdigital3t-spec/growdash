import { NavLink } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import { PHASES, getPhaseProgress } from "@/lib/phase/phase";

interface ShipLevelCardProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Card "NÍVEL DA NAVE" exibido no rodape da sidebar.
 *
 * Mostra a fase atual com mini barra de progresso de combustivel e da
 * acesso a pagina de Jornada.
 */
export function ShipLevelCard({ collapsed = false, className = "" }: ShipLevelCardProps) {
  const phase = useEffectivePhase();
  const monthlyRevenue = usePhaseStore((state) => state.monthlyRevenue);
  const info = PHASES[phase];
  const progress = getPhaseProgress(monthlyRevenue, phase);

  if (collapsed) {
    return (
      <NavLink
        to="/jornada"
        aria-label={`Nível da nave: ${info.label}`}
        className={`group relative flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-card-bg text-primary-neon shadow-glow-sm transition hover:border-card-border-active hover:shadow-glow-lg ${className}`}
      >
        <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
        <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-primary-neon shadow-[0_0_8px_currentColor]" />
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/jornada"
      aria-label={`Ver jornada da nave — Fase atual: ${info.label}`}
      className={`group block rounded-xl border border-card-border bg-card-bg/80 p-3 shadow-glow-sm backdrop-blur-xl transition hover:border-card-border-active hover:shadow-glow-lg ${className}`}
    >
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
        <span className="flex items-center gap-1.5 text-primary-soft">
          <Sparkles className="h-3 w-3 text-primary-neon" /> NÍVEL DA NAVE
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary-neon" />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between">
        <b className="font-display text-sm font-bold tracking-tight text-text-primary">
          {info.label}
        </b>
        <span className="text-[10px] font-semibold tabular-nums text-primary-neon">
          {progress.toFixed(0)}%
        </span>
      </div>

      {/* Mini barra de progresso da fase */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full border border-card-border bg-bg-elevated">
        <div
          className="gd-fuel-fill h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </NavLink>
  );
}
