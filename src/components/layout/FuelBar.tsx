import { Fuel, Sparkles, TrendingUp } from "lucide-react";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import {
  getFuelProgress,
  isNextPhaseInSight,
  sanitizePhase,
  type Phase,
} from "@/lib/phase/phase";
import { formatCurrency, formatPercent } from "@/lib/format/formatPtBr";

interface FuelBarProps {
  /** Se true, renderiza a versao compacta para headers de abas internas. */
  compact?: boolean;
  /** Se true, renderiza a versao integrada na barra superior (topbar horizontal). */
  topbar?: boolean;
  /** Meta personalizada para a fase Galaxia (padrao R$ 250.000). */
  galaxyGoal?: number;
  className?: string;
}

/**
 * Barra "COMBUSTÍVEL DA MISSÃO".
 *
 * Exibe o faturamento do mes corrente em relacao ao teto da fase ativa.
 * Utiliza o gradiente da fase (`--gradient-fuel`), brilho na ponta e exibe
 * o chip "Proxima fase a vista" quando ultrapassa 90% do teto.
 */
export function FuelBar({
  compact = false,
  topbar = false,
  galaxyGoal,
  className = "",
}: FuelBarProps) {
  const phase = sanitizePhase(useEffectivePhase());
  const monthlyRevenue = usePhaseStore((state) => state.monthlyRevenue);
  const { current, target, percent } = getFuelProgress(
    Number.isFinite(monthlyRevenue) ? monthlyRevenue : 0,
    phase,
    Number.isFinite(galaxyGoal) ? galaxyGoal : undefined,
  );
  const nextInSight = isNextPhaseInSight(current, phase);

  if (topbar) {
    return (
      <div className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-card-border/70 bg-card-bg/60 px-3 py-1.5 shadow-sm backdrop-blur-md ${className}`}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-card-border bg-primary/10 text-primary-neon">
          <Fuel className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 grow">
          <div className="flex items-baseline justify-between gap-2 text-[10px]">
            <span className="truncate font-bold uppercase tracking-[0.12em] text-primary-neon">
              Combustível da Missão
            </span>
            <span className="font-semibold text-text-secondary tabular-nums">
              {formatCurrency(current)} de {formatCurrency(target)} | <b className="font-bold text-text-primary">{formatPercent(percent, 0)}</b>
            </span>
          </div>
          <div className="relative mt-1.5 h-3 w-full overflow-hidden rounded-full border border-card-border/80 bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] p-0.5">
            {/* Fundo com rastro de plasma de combustível */}
            <div
              className="gd-fuel-fill relative h-full rounded-full transition-all duration-700 ease-out overflow-hidden"
              style={{ width: `${Math.max(percent, 2)}%` }}
            >
              {/* Feixe de luz correndo pelo tubo de combustível */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-[fuel-shimmer_1.6s_ease-in-out_infinite] opacity-75" />
              {/* Ponta brilhante de propulsão cósmica */}
              <span className="absolute right-0 top-0 h-full w-2.5 bg-white shadow-[0_0_12px_2px_#ffffff] rounded-full" />
            </div>
          </div>
        </div>
        {nextInSight && (
          <span className="hidden xl:inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[9px] font-bold text-warning animate-pulse shrink-0">
            <Sparkles className="h-2.5 w-2.5" /> Próxima fase
          </span>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex min-w-[220px] max-w-[320px] items-center gap-2.5 text-xs ${className}`}>
        <Fuel className="h-3.5 w-3.5 shrink-0 text-primary-neon" />
        <div className="min-w-0 grow space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="truncate font-bold uppercase tracking-wider text-primary-neon">
              Combustível
            </span>
            <span className="font-bold tabular-nums text-text-primary">
              {formatPercent(percent, 0)}
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-card-border bg-bg-elevated">
            <div
              className="gd-fuel-fill h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Combustível da Missão"
      className={`relative overflow-hidden rounded-2xl border border-card-border bg-card-bg p-4 shadow-glow-sm backdrop-blur-xl sm:p-5 ${className}`}
    >
      {/* Reflexo luminoso no topo do card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-neon to-transparent opacity-60" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-card-border bg-primary/10 text-primary-neon shadow-glow-sm">
              <Fuel className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-primary-neon sm:text-sm">
                Combustível da Missão
              </h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                {formatCurrency(current)} de {formatCurrency(target)} |{" "}
                <strong className="font-bold text-text-primary tabular-nums">
                  {formatPercent(percent, 0)}
                </strong>
              </p>
            </div>
          </div>

          {nextInSight && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/15 px-3 py-1 text-[11px] font-bold text-warning animate-pulse shadow-glow-sm">
              <Sparkles className="h-3 w-3" /> Próxima fase à vista
            </span>
          )}
        </div>

        {/* Trilho e preenchimento da barra */}
        <div className="relative h-3 w-full overflow-hidden rounded-full border border-card-border bg-bg-elevated/80 shadow-inner">
          <div
            className="gd-fuel-fill relative h-full rounded-full transition-all duration-700 ease-out before:absolute before:inset-0 before:rounded-full before:animate-[plasma_2s_linear_infinite] before:bg-[conic-gradient(from_90deg_at_center,rgba(0,168,255,0.3),rgba(255,255,255,0.9),rgba(0,168,255,0.3))]"
            style={{ width: `${percent}%` }}
          >
            {/* Brilho neon na ponta de avanco da barra */}
            <span className="absolute right-0 top-0 h-full w-3 bg-white/70 shadow-[0_0_12px_2px_#ffffff]" />
          </div>
        </div>
      </div>
    </section>
  );
}
