import { NavLink } from "react-router-dom";
import { ChevronRight, Info, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { useEffectivePhase } from "@/lib/phase/phaseStore";

export type AnomalySeverity = "alta" | "media" | "ok";

export interface AnomalyItem {
  id: string;
  title: string;
  context: string;
  metric: string;
  severity: AnomalySeverity;
  /** Posição relativa no radar para plotar o blip: x(-1 a 1), y(-1 a 1) */
  blip?: { x: number; y: number };
}

interface AnomalyRadarProps {
  items?: AnomalyItem[];
  lastUpdatedText?: string;
  className?: string;
}

const DEFAULT_ANOMALIES: AnomalyItem[] = [
  {
    id: "1",
    title: "CPL acima do esperado",
    context: "Campanha: Black Premium",
    metric: "CPL atual: R$ 38,45",
    severity: "alta",
    blip: { x: 0.45, y: -0.38 },
  },
  {
    id: "2",
    title: "Queda de conversão",
    context: "Etapa: Página de Vendas",
    metric: "Taxa atual: 7,11%",
    severity: "media",
    blip: { x: -0.52, y: 0.22 },
  },
  {
    id: "3",
    title: "Gasto acelerado",
    context: "Campanha: Lançamento 6.0",
    metric: "Gasto hoje: R$ 12.450",
    severity: "media",
    blip: { x: 0.28, y: 0.58 },
  },
  {
    id: "4",
    title: "Tudo sob controle",
    context: "Monitoramento geral estável",
    metric: "Sem anomalias críticas",
    severity: "ok",
  },
];

const SEVERITY_CONFIG: Record<
  AnomalySeverity,
  { label: string; textClass: string; borderClass: string; bgClass: string; dotClass: string }
> = {
  alta: {
    label: "ALTA",
    textClass: "text-danger",
    borderClass: "border-danger/40",
    bgClass: "bg-danger/10",
    dotClass: "bg-danger shadow-[0_0_10px_#FF3B5C]",
  },
  media: {
    label: "MÉDIA",
    textClass: "text-warning",
    borderClass: "border-warning/40",
    bgClass: "bg-warning/10",
    dotClass: "bg-warning shadow-[0_0_10px_#FF9F1C]",
  },
  ok: {
    label: "OK",
    textClass: "text-success",
    borderClass: "border-success/40",
    bgClass: "bg-success/10",
    dotClass: "bg-success shadow-[0_0_10px_#22F27A]",
  },
};

/**
 * Radar de Anomalias circular com feixe giratorio e alertas operacionais.
 *
 * Conforme a secao 9.1 do Prompt Mestre e a referencia oficial:
 * - Feixe luminoso girando continuamente em 360 graus
 * - Aneis concentricos pontilhados e eixos ortogonais na cor da fase
 * - Blips piscantes nas posicoes correspondentes aos alertas
 * - Lista de anomalias com pills de severidade (ALTA / MEDIA / OK)
 * - Link de acesso rapido "VER TODOS OS ALERTAS >"
 */
export function AnomalyRadar({
  items = DEFAULT_ANOMALIES,
  lastUpdatedText = "ATUALIZADO AGORA",
  className = "",
}: AnomalyRadarProps) {
  const phase = useEffectivePhase();

  return (
    <section
      aria-labelledby="anomaly-radar-title"
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl transition hover:border-card-border-active hover:shadow-glow-lg sm:p-6 ${className}`}
    >
      {/* Reflexo luminoso no topo do card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-neon to-transparent opacity-60" />

      {/* Cabecalho do Radar */}
      <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm">
            <Radar className="h-4 w-4" />
          </span>
          <h2 id="anomaly-radar-title" className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
            Radar de Anomalias
          </h2>
          <span title="Deteccao automatica de desvios operacionais, CPL e conversao">
            <Info className="h-3.5 w-3.5 text-text-muted hover:text-text-primary cursor-pointer" />
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
          {lastUpdatedText}
          <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_#22F27A] animate-pulse" />
        </span>
      </div>

      {/* Plot central do radar circular com feixe giratorio */}
      <div className="relative my-4 flex items-center justify-center py-2">
        <div
          className="relative aspect-square w-full max-w-[210px] overflow-hidden rounded-full border border-card-border bg-bg-elevated/70 shadow-glow-sm sm:max-w-[230px]"
          style={{
            boxShadow: "0 0 24px -6px var(--primary-neon), inset 0 0 20px rgba(0,0,0,0.8)",
          }}
        >
          {/* Aneis concentricos */}
          <span className="pointer-events-none absolute inset-3 rounded-full border border-card-border/60 stroke-dash" style={{ borderStyle: "dashed" }} />
          <span className="pointer-events-none absolute inset-10 rounded-full border border-card-border/70" />
          <span className="pointer-events-none absolute inset-16 rounded-full border border-card-border/80 stroke-dash" style={{ borderStyle: "dashed" }} />

          {/* Eixos ortogonais */}
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-card-border/60" />
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-card-border/60" />

          {/* Ponto central luminoso */}
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-neon shadow-[0_0_10px_var(--primary-neon)]" />

          {/* Feixe giratorio continuo (radar sweep 360 graus) */}
          <div
            className="pointer-events-none absolute inset-0 origin-center animate-[spin_6s_linear_infinite] motion-reduce:animate-none"
            style={{
              background:
                "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 300deg, var(--primary-neon) 360deg)",
              opacity: 0.28,
            }}
          />

          {/* Blips das anomalias plotados nas coordenadas */}
          {items
            .filter((item) => item.blip)
            .map((item) => {
              const config = SEVERITY_CONFIG[item.severity];
              // Mapeia -1..1 para 10%..90% do diametro
              const left = `${((item.blip!.x + 1) / 2) * 80 + 10}%`;
              const top = `${((item.blip!.y + 1) / 2) * 80 + 10}%`;

              return (
                <span
                  key={item.id}
                  className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${config.dotClass} animate-pulse motion-reduce:animate-none`}
                  style={{ left, top }}
                  title={`${item.title} (${config.label})`}
                />
              );
            })}
        </div>
      </div>

      {/* Lista de alertas com pills de severidade */}
      <div className="space-y-2 border-t border-card-border/60 pt-3">
        {items.map((item) => {
          const config = SEVERITY_CONFIG[item.severity];
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-card-border/50 bg-bg-elevated/50 p-2.5 text-xs transition hover:border-card-border hover:bg-bg-elevated"
            >
              <div className="flex items-start gap-2.5 min-w-0 grow">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${config.dotClass}`} />
                <div className="min-w-0 grow">
                  <b className="block truncate text-[12px] font-bold text-text-primary">
                    {item.title}
                  </b>
                  <span className="block truncate text-[10px] text-text-secondary">
                    {item.context}
                  </span>
                  <span className="block truncate text-[10px] font-medium text-text-muted">
                    {item.metric}
                  </span>
                </div>
              </div>

              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${config.borderClass} ${config.bgClass} ${config.textClass}`}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Botao de acesso rapido para todos os alertas */}
      <NavLink
        to="/alertas"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-card-border bg-primary/10 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-primary-neon shadow-glow-sm transition hover:border-card-border-active hover:bg-primary/20 hover:shadow-glow-lg"
      >
        <span>Ver todos os alertas</span>
        <ChevronRight className="h-4 w-4" />
      </NavLink>
    </section>
  );
}
