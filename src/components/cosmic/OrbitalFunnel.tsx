import { Info, Sparkles, TrendingUp, Clock, DollarSign, Target } from "lucide-react";
import { useEffectivePhase } from "@/lib/phase/phaseStore";
import { formatCurrency, formatInteger } from "@/lib/format/formatPtBr";
import { SpaceRocket } from "@/components/space/SpaceRocket";

export interface FunnelStep {
  label: string;
  value: number;
  conversionRate?: number; // taxa em relacao a etapa anterior
}

interface OrbitalFunnelProps {
  steps?: FunnelStep[];
  totalConversionRate?: number;
  averageCycleDays?: number;
  averageTicket?: number;
  monthlyRevenue?: number;
  className?: string;
}

const DEFAULT_STEPS: FunnelStep[] = [
  { label: "VISITANTES", value: 2_475_052 },
  { label: "CLIQUES", value: 241_582, conversionRate: 9.76 },
  { label: "LEADS", value: 33_214, conversionRate: 13.75 },
  { label: "OPORTUNIDADES", value: 6_842, conversionRate: 20.61 },
  { label: "CLIENTES", value: 1_256, conversionRate: 18.37 },
];

/**
 * Funil Orbital da Missao 3D (ETAPA 3).
 *
 * Reproduz a anatomia oficial da referencia do usuario:
 * - Aneis elipticos concentricos empilhados em perspectiva 3D
 * - Trajetoria orbital pontilhada com foguete em voo
 * - Taxas de conversao entre etapas alinhadas a direita
 * - Grade inferior com as 4 metricas de suporte (Taxa conv. total, Ciclo medio, Ticket medio, Faturamento)
 */
export function OrbitalFunnel({
  steps = DEFAULT_STEPS,
  totalConversionRate = 0.051,
  averageCycleDays = 23,
  averageTicket = 622.73,
  monthlyRevenue = 780_000,
  className = "",
}: OrbitalFunnelProps) {
  const phase = useEffectivePhase();

  // Cores de aneis por fase (na Orbita usa multi-funnel tokens)
  const ringColors = [
    "var(--primary-neon)",
    "var(--accent)",
    "var(--primary)",
    "var(--primary-soft)",
    "var(--success)",
  ];

  return (
    <section
      aria-labelledby="orbital-funnel-title"
      className={`relative overflow-hidden rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl transition hover:border-card-border-active hover:shadow-glow-lg sm:p-6 ${className}`}
    >
      {/* Reflexo luminoso no topo do card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-neon to-transparent opacity-60" />

      {/* Cabecalho do funil */}
      <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm">
            <Target className="h-4 w-4" />
          </span>
          <h2 id="orbital-funnel-title" className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
            Funil Orbital da Missão
          </h2>
          <span title="Jornada completa de conversão do tráfego até o cliente final">
            <Info className="h-3.5 w-3.5 text-text-muted hover:text-text-primary cursor-pointer" />
          </span>
        </div>

        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-neon">
          {steps[steps.length - 1]?.value ? formatInteger(steps[steps.length - 1].value) : "—"} clientes
        </span>
      </div>

      {/* Corpo do Funil 3D com aneis elipticos e foguete orbitando */}
      <div className="relative my-6 flex min-h-[300px] flex-col items-center justify-center sm:min-h-[340px]">
        {/* Foguete em orbita na trajetoria eliptica esquerda */}
        <div
          className="pointer-events-none absolute left-[4%] top-[34%] z-20 -rotate-45 sm:left-[8%]"
          aria-hidden="true"
        >
          <div className="relative text-primary-neon drop-shadow-[0_0_12px_var(--primary-neon)] animate-pulse motion-reduce:animate-none">
            <SpaceRocket className="h-12 w-12 sm:h-14 sm:w-14" />
            {/* Rastro luminoso da propulsao */}
            <span className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-primary-neon blur-[3px] opacity-75" />
          </div>
        </div>

        {/* Pilha de aneis elipticos conicos */}
        <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center gap-2.5 sm:max-w-[480px]">
          {steps.map((step, index) => {
            // Largura decrescente em perspectiva conica de funil: 100%, 86%, 72%, 58%, 44%
            const widthPercent = 100 - index * 14;
            const ringColor = ringColors[index % ringColors.length];

            return (
              <div
                key={step.label}
                className="relative flex w-full items-center justify-center"
              >
                {/* Anel eliptico com glow neon e translucididade */}
                <div
                  className="group relative flex items-center justify-center rounded-[999px/50%] border py-2.5 px-4 text-center transition-all duration-300 hover:scale-[1.03] hover:shadow-glow-lg sm:py-3.5"
                  style={{
                    width: `${widthPercent}%`,
                    borderColor: ringColor,
                    backgroundColor: "rgba(5, 12, 24, 0.75)",
                    boxShadow: `0 0 16px -4px ${ringColor}, inset 0 0 14px rgba(0, 0, 0, 0.6)`,
                  }}
                >
                  {/* Conteudo do anel: rotulo e valor */}
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted group-hover:text-text-secondary sm:text-[10px]">
                      {step.label}
                    </span>
                    <strong className="font-display text-xs font-bold text-text-primary tabular-nums sm:text-sm">
                      {formatInteger(step.value)}
                    </strong>
                  </div>
                </div>

                {/* Taxa de conversao da etapa alinhada a direita */}
                {typeof step.conversionRate === "number" && (
                  <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[10px] sm:text-xs">
                    <span className="hidden h-px w-6 bg-card-border sm:inline-block" />
                    <span className="rounded-md border border-card-border bg-bg-elevated/80 px-2 py-0.5 font-bold text-primary-neon tabular-nums shadow-sm">
                      {step.conversionRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </span>
                    <span className="hidden text-[9px] text-text-muted xl:inline">
                      taxa conv.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grade de 4 metricas de suporte abaixo do funil */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-card-border/60 pt-4 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-card-border/70 bg-bg-elevated/60 p-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <TrendingUp className="h-3 w-3 text-primary-neon" /> Taxa conv. total
          </span>
          <b className="font-display mt-1 block text-sm font-bold text-text-primary tabular-nums sm:text-base">
            {totalConversionRate.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%
          </b>
        </div>

        <div className="rounded-xl border border-card-border/70 bg-bg-elevated/60 p-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <Clock className="h-3 w-3 text-primary-soft" /> Ciclo médio
          </span>
          <b className="font-display mt-1 block text-sm font-bold text-text-primary tabular-nums sm:text-base">
            {averageCycleDays} dias
          </b>
        </div>

        <div className="rounded-xl border border-card-border/70 bg-bg-elevated/60 p-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <DollarSign className="h-3 w-3 text-primary-neon" /> Ticket médio
          </span>
          <b className="font-display mt-1 block text-sm font-bold text-text-primary tabular-nums sm:text-base">
            {formatCurrency(averageTicket)}
          </b>
        </div>

        <div className="rounded-xl border border-card-border/70 bg-bg-elevated/60 p-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <Sparkles className="h-3 w-3 text-primary-neon" /> Faturamento mês
          </span>
          <b className="font-display mt-1 block text-sm font-bold text-text-primary tabular-nums sm:text-base">
            {formatCurrency(monthlyRevenue)}
          </b>
        </div>
      </div>
    </section>
  );
}
