import { useState } from "react";
import { AlertTriangle, ChevronDown, Target } from "lucide-react";
import { formatInteger, formatPercent } from "@/lib/format/formatPtBr";
import { useEffectivePhase } from "@/lib/phase/phaseStore";
import { SpaceRocket } from "@/components/space/SpaceRocket";

export interface OrbitalStage {
  key: string;
  label: string;
  current: number;
  previous?: number;
}

interface FunnelOrbitalInteractiveProps {
  stages: OrbitalStage[];
  /** Taxa de conversao acumulada em relacao a etapa anterior. */
  conversionRates?: number[];
  /** Indice da etapa que é o maior gargalo (menor taxa de conversão). */
  bottleneckIndex?: number;
  className?: string;
}

/**
 * Funil Orbital interativo (seção 9.4).
 *
 * Anéis elípticos empilhados; clicar numa etapa abre o detalhamento com
 * o comparativo entre o período atual e o anterior. Destaca em neon o
 * maior gargalo (menor taxa de conversão).
 */
export function FunnelOrbitalInteractive({
  stages,
  conversionRates,
  bottleneckIndex,
  className = "",
}: FunnelOrbitalInteractiveProps) {
  const phase = useEffectivePhase();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const rates = conversionRates ?? [];
  // O gargalo e a etapa com a menor taxa de conversao entre etapas.
  const resolvedBottleneck =
    bottleneckIndex ??
    (rates.length ? rates.reduce((lowest, rate, idx) => (rate < rates[lowest] ? idx : lowest), 0) : -1);

  const selected = selectedIndex !== null ? stages[selectedIndex] : null;

  return (
    <section
      aria-label="Funil orbital interativo"
      className={`rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm">
            <Target className="h-4 w-4" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
            Funil Orbital Interativo
          </h2>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-neon">
          {stages.length} etapas
        </span>
      </div>

      {/* Pilha conica de aneis em perspectiva com proporcao real de funil */}
      <div className="relative my-6 flex min-h-[320px] items-center justify-center">
        {/* Foguete em orbita conica na esquerda */}
        <div className="pointer-events-none absolute left-3 top-1/3 z-20 -rotate-45 sm:left-10" aria-hidden="true">
          <div className="relative text-primary drop-shadow-[0_0_14px_currentColor] animate-pulse motion-reduce:animate-none">
            <SpaceRocket className="h-12 w-12 sm:h-14 sm:w-14" />
            <span className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-primary blur-[3px] opacity-75" />
          </div>
        </div>

        {/* Funil conico centralizado com max-width proporcional */}
        <div className="relative z-10 mx-auto flex w-full max-w-[500px] flex-col items-center gap-2.5 sm:max-w-[540px]">
          {stages.map((stage, index) => {
            // Largura conica de 100% ate 40% para ter forma real de funil 3D
            const widthPercent = 100 - index * (60 / Math.max(stages.length - 1, 1));
            const isSelected = selectedIndex === index;
            const isBottleneck = index === resolvedBottleneck + 1;
            const rate = rates[index];

            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setSelectedIndex(isSelected ? null : index)}
                aria-pressed={isSelected}
                className="group relative flex w-full items-center justify-center transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                style={{ width: `${widthPercent}%` }}
              >
                <div
                  className="flex w-full items-center justify-center rounded-[999px/50%] border py-3 text-center transition-all"
                  style={{
                    borderColor: isBottleneck
                      ? "var(--danger)"
                      : isSelected
                      ? "var(--primary-neon)"
                      : "var(--card-border-active)",
                    backgroundColor: "rgba(5, 12, 24, 0.75)",
                    boxShadow: isBottleneck
                      ? "0 0 18px -4px var(--danger)"
                      : isSelected
                      ? "0 0 20px -4px var(--primary-neon)"
                      : "0 0 12px -6px var(--primary-neon)",
                  }}
                >
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted group-hover:text-text-secondary sm:text-[10px]">
                      {stage.label}
                    </span>
                    <strong className="font-display text-xs font-bold text-text-primary tabular-nums sm:text-sm">
                      {formatInteger(stage.current)}
                    </strong>
                  </div>
                </div>

                {/* Taxa de conversao entre etapas alinhada */}
                {typeof rate === "number" && (
                  <span
                    className={`absolute -right-16 sm:-right-20 top-1/2 -translate-y-1/2 rounded-md border px-2 py-0.5 text-[10px] font-bold tabular-nums shadow-sm ${
                      isBottleneck
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-card-border bg-bg-elevated/80 text-primary-neon"
                    }`}
                  >
                    {rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhamento da etapa selecionada */}
      {selected ? (
        <div className="rounded-xl border border-card-border-active bg-bg-elevated/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-neon">
                Etapa selecionada
              </span>
              <h3 className="font-display text-base font-bold text-text-primary">
                {selected.label}
              </h3>
            </div>
            <ChevronDown className="h-4 w-4 rotate-180 text-text-muted" />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-card-border/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Período atual
              </span>
              <b className="font-display mt-1 block text-lg font-bold text-text-primary tabular-nums">
                {formatInteger(selected.current)}
              </b>
            </div>
            <div className="rounded-lg border border-card-border/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Período anterior
              </span>
              <b className="font-display mt-1 block text-lg font-bold text-text-secondary tabular-nums">
                {formatInteger(selected.previous ?? 0)}
              </b>
            </div>
            <div className="rounded-lg border border-card-border/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Variação
              </span>
              <b
                className={`font-display mt-1 block text-lg font-bold tabular-nums ${
                  selected.previous && selected.current >= selected.previous
                    ? "text-success"
                    : "text-danger"
                }`}
              >
                {selected.previous
                  ? formatPercent(
                      ((selected.current - selected.previous) / selected.previous) * 100,
                      1,
                    )
                  : "—"}
              </b>
            </div>
          </div>

          {selectedIndex === resolvedBottleneck + 1 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Maior vazamento de combustível da jornada</span>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-card-border p-4 text-center text-xs text-text-muted">
          Selecione uma etapa do funil para ver o comparativo entre os períodos.
        </p>
      )}
    </section>
  );
}
