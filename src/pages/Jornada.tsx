import { Globe, Orbit, Sparkles, Award, CheckCircle2, Lock } from "lucide-react";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import { PHASES, getPhaseInfo, getPhaseSubtitle, type Phase } from "@/lib/phase/phase";
import { formatCurrency, formatDateBr } from "@/lib/format/formatPtBr";

const PHASE_CONFIG: Record<
  Phase,
  { icon: typeof Globe; label: string; range: string; colorClass: string; borderClass: string; bgClass: string }
> = {
  terra: {
    icon: Globe,
    label: "TERRA",
    range: "R$ 0 a R$ 50 mil/mês",
    colorClass: "text-sky-400",
    borderClass: "border-sky-500/40",
    bgClass: "bg-sky-500/10",
  },
  orbita: {
    icon: Orbit,
    label: "ÓRBITA",
    range: "R$ 50 mil a R$ 100 mil/mês",
    colorClass: "text-amber-400",
    borderClass: "border-amber-500/40",
    bgClass: "bg-amber-500/10",
  },
  galaxia: {
    icon: Sparkles,
    label: "GALÁXIA",
    range: "Acima de R$ 100 mil/mês",
    colorClass: "text-fuchsia-400",
    borderClass: "border-fuchsia-500/40",
    bgClass: "bg-fuchsia-500/10",
  },
};

export default function JornadaPage() {
  const currentPhase = useEffectivePhase();
  const highestPhase = usePhaseStore((state) => state.highestPhaseEver);
  const history = usePhaseStore((state) => state.phaseHistory);
  const monthlyRevenue = usePhaseStore((state) => state.monthlyRevenue);

  const orderOf = (p: Phase) => getPhaseInfo(p).order;
  const currentOrder = orderOf(currentPhase);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Cabecalho da pagina */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-card-border bg-card-bg/80 p-6 shadow-glow-sm backdrop-blur-xl">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-neon">
            Evolução da Missão
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Jornada da Nave
          </h1>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">
            Seu faturamento mensal dita o nível da nave e destrava novas fases e visualizações na plataforma.
          </p>
        </div>
        <div className="rounded-xl border border-card-border bg-bg-elevated/70 p-4 text-right">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Faturamento Atual do Mês
          </span>
          <b className="font-display text-xl font-bold text-text-primary tabular-nums sm:text-2xl">
            {formatCurrency(monthlyRevenue)}
          </b>
        </div>
      </div>

      {/* Rota orbital horizontal conectando as 3 fases */}
      <section aria-label="Linha do tempo orbital" className="rounded-2xl border border-card-border bg-card-bg/80 p-6 shadow-glow-sm backdrop-blur-xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-primary-soft">
          Rota Orbital das Fases
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {(Object.keys(PHASES) as Phase[]).map((phaseKey) => {
            const config = PHASE_CONFIG[phaseKey];
            const phaseOrder = orderOf(phaseKey);
            const isCurrent = phaseKey === currentPhase;
            const isUnlocked = phaseOrder <= currentOrder || phaseOrder <= orderOf(highestPhase);
            const Icon = config.icon;

            return (
              <article
                key={phaseKey}
                className={`relative flex flex-col justify-between rounded-xl border p-5 transition ${
                  isCurrent
                    ? `${config.borderClass} ${config.bgClass} shadow-glow-lg ring-1 ring-primary-neon`
                    : isUnlocked
                    ? "border-card-border bg-card-bg/50 opacity-90"
                    : "border-card-border/50 bg-bg-elevated/40 opacity-55"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl border ${config.borderClass} ${config.bgClass} ${config.colorClass}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary-neon bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-neon shadow-glow-sm">
                      <CheckCircle2 className="h-3 w-3" /> Fase Ativa
                    </span>
                  ) : isUnlocked ? (
                    <span className="text-[10px] font-bold uppercase text-success">
                      Desbloqueada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                      <Lock className="h-3 w-3" /> Bloqueada
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-1">
                  <h3 className={`font-display text-lg font-bold tracking-tight ${isCurrent ? config.colorClass : "text-text-primary"}`}>
                    FASE {config.label}
                  </h3>
                  <p className="text-xs text-text-muted">{config.range}</p>
                  <p className="text-[11px] text-text-secondary">{getPhaseSubtitle(phaseKey)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Historico de conquistas */}
      <section aria-label="Histórico de conquistas" className="rounded-2xl border border-card-border bg-card-bg/80 p-6 shadow-glow-sm backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-soft">
          <Award className="h-4 w-4 text-primary-neon" />
          <h2>Diário de Conquistas da Missão</h2>
        </div>

        {history.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-card-border p-6 text-center text-xs text-text-muted">
            Sua jornada começou em Terra. A cada faturamento conquistado, as entradas da missão serão registradas aqui.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-card-border">
            {history.map((entry, index) => {
              const config = PHASE_CONFIG[entry.phase];
              return (
                <div key={`${entry.phase}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg border ${config.borderClass} ${config.bgClass} ${config.colorClass}`}>
                      <Award className="h-4 w-4" />
                    </span>
                    <div>
                      <b className="block text-xs font-bold text-text-primary">
                        Conquista: Fase {config.label}
                      </b>
                      <span className="text-[11px] text-text-muted">
                        {formatDateBr(entry.enteredAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-text-muted">Faturamento no momento:</span>{" "}
                    <b className="text-primary-neon tabular-nums">
                      {formatCurrency(entry.revenueAtEntry)}
                    </b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
