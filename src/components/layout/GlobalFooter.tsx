import { Activity, CheckCircle2, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffectivePhase } from "@/lib/phase/phaseStore";
import { PHASES } from "@/lib/phase/phase";

interface GlobalFooterProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Rodape global da plataforma.
 *
 * Exibe o status da missao, integracoes conectadas, saude dos sistemas
 * da nave e botao de atualizacao de dados.
 */
export function GlobalFooter({
  onRefresh,
  isRefreshing = false,
  className = "",
}: GlobalFooterProps) {
  const phase = useEffectivePhase();
  const info = PHASES[phase];

  return (
    <footer
      className={`mt-8 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-card-bg/60 px-4 py-3 text-xs text-text-secondary shadow-sm backdrop-blur-xl sm:px-6 ${className}`}
      aria-label="Status da missão"
    >
      <div className="flex flex-wrap items-center gap-4 text-[11px] sm:gap-6">
        {/* Saude da nave */}
        <span className="inline-flex items-center gap-1.5 font-medium text-text-primary">
          <span className="h-2 w-2 rounded-full bg-success shadow-glow-sm" />
          <span>Sistemas da nave: 100%</span>
        </span>

        {/* Integracoes */}
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary-neon" />
          <span>Integrações ativas: Meta, RD e WhatsApp</span>
        </span>

        {/* Proximo checkpoint */}
        <span className="hidden items-center gap-1.5 md:inline-flex">
          <Activity className="h-3.5 w-3.5 text-primary-soft" />
          <span>Checkpoint: Fase {info.label}</span>
        </span>

        {/* Tempo da ultima atualizacao */}
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          <span>Atualizado agora</span>
        </span>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-[11px] font-bold text-text-primary shadow-sm transition hover:border-card-border-active hover:text-primary-neon disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Atualizar dados</span>
        </button>
      )}
    </footer>
  );
}
