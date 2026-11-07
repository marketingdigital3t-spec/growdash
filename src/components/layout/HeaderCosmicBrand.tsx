import { Globe, Orbit, Sparkles } from "lucide-react";
import { useEffectivePhase } from "@/lib/phase/phaseStore";
import { getPhaseInfo, getPhaseSubtitle, sanitizePhase, type Phase } from "@/lib/phase/phase";

interface HeaderCosmicBrandProps {
  /** Titulo da aba ativa (ex.: "TRÁFEGO PAGO"). Se omitido, usa "GROWDASH". */
  pageTitle?: string;
  className?: string;
}

function PhaseCosmicIcon({ phase }: { phase: Phase }) {
  switch (phase) {
    case "terra":
      return <Globe className="h-5 w-5 text-primary-neon animate-pulse motion-reduce:animate-none" />;
    case "orbita":
      return <Orbit className="h-5 w-5 text-primary-neon animate-spin [animation-duration:20s] motion-reduce:animate-none" />;
    case "galaxia":
      return <Sparkles className="h-5 w-5 text-primary-neon animate-pulse motion-reduce:animate-none" />;
  }
}

/**
 * Cabecalho cosmico da pagina.
 *
 * Exemplo: `GROWDASH | FASE TERRA` com o subtitulo oficial da fase em
 * `--text-secondary`. Regra: nunca usar travessao longo (em-dash).
 */
export function HeaderCosmicBrand({ pageTitle, className = "" }: HeaderCosmicBrandProps) {
  const phase = sanitizePhase(useEffectivePhase());
  const info = getPhaseInfo(phase);
  const subtitle = getPhaseSubtitle(phase);
  const titlePrefix = pageTitle ? pageTitle.toUpperCase() : "GROWDASH";

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-card-border bg-primary/10 shadow-glow-sm backdrop-blur-md">
        <PhaseCosmicIcon phase={phase} />
      </span>
      <div className="min-w-0">
        <h1 className="font-display flex items-baseline gap-2 truncate text-base font-bold tracking-tight text-text-primary sm:text-lg">
          <span>{titlePrefix}</span>
          <span className="text-text-muted font-normal">|</span>
          <span className="text-primary-neon drop-shadow-[0_0_8px_currentColor]">
            FASE {info.label}
          </span>
        </h1>
        <p className="truncate text-xs text-text-secondary sm:text-[13px]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
