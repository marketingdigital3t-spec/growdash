import { useState } from "react";
import { Award, Check, Copy, Share2, Sparkles, X } from "lucide-react";
import { getPhaseInfo, type Phase } from "@/lib/phase/phase";
import { formatCurrency, formatDateBr } from "@/lib/format/formatPtBr";

interface AchievementModalProps {
  phase: Phase | null;
  revenue: number;
  date?: string;
  onClose: () => void;
}

/**
 * Modal com badge hexagonal de conquista da fase (secao 8.2).
 */
export function AchievementModal({ phase, revenue, date, onClose }: AchievementModalProps) {
  const [copied, setCopied] = useState(false);

  if (!phase) return null;

  const info = getPhaseInfo(phase);
  const isGalaxia = phase === "galaxia";
  const isOrbita = phase === "orbita";
  const neonColor = isGalaxia ? "#B15CFF" : isOrbita ? "#FFC21A" : "#3D9BFF";
  const entryDate = date ? formatDateBr(date) : formatDateBr(new Date());

  const handleShare = async () => {
    const shareText = `🚀 Conquistei a FASE ${info.label} na Growdash com ${formatCurrency(revenue)} de faturamento mensal! #Growdash #SaaS #Growth`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[520] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-card-border bg-card-bg p-6 text-center shadow-glow-lg sm:p-8"
      >
        {/* Linha luminosa no topo */}
        <div
          style={{ background: `linear-gradient(90deg, transparent, ${neonColor}, transparent)` }}
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar conquista"
          className="absolute right-4 top-4 rounded-lg p-2 text-text-muted transition hover:bg-white/10 hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Badge hexagonal com glow da fase */}
        <div className="relative mx-auto mt-2 flex h-28 w-28 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_0_16px_var(--primary-neon)]">
            {/* Poligono hexagonal */}
            <polygon
              points="50 3, 90 25, 90 75, 50 97, 10 75, 10 25"
              fill="rgba(4, 9, 20, 0.92)"
              stroke={neonColor}
              strokeWidth="2.5"
            />
            <polygon
              points="50 10, 84 29, 84 71, 50 90, 16 71, 16 29"
              fill="none"
              stroke={neonColor}
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.6"
            />
          </svg>
          <Award style={{ color: neonColor }} className="absolute h-12 w-12 drop-shadow-[0_0_8px_currentColor]" />
        </div>

        <div className="mt-4 space-y-1">
          <span style={{ color: neonColor }} className="text-[11px] font-bold uppercase tracking-[0.2em]">
            Insígnia de Conquista
          </span>
          <h2 id="achievement-title" className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            FASE {info.label}
          </h2>
          <p className="text-xs text-text-secondary">
            Conquistada em {entryDate} com faturamento de{" "}
            <b className="text-text-primary tabular-nums">{formatCurrency(revenue)}</b>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-card-border bg-primary/10 py-3 text-xs font-bold uppercase tracking-wider text-primary-neon shadow-glow-sm transition hover:bg-primary/20"
          >
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            <span>{copied ? "Copiado para Stories!" : "Compartilhar"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: `linear-gradient(135deg, ${neonColor}, ${neonColor}dd)`,
              boxShadow: `0 0 20px -3px ${neonColor}`,
            }}
            className="flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-black transition hover:scale-105"
          >
            Continuar missão
          </button>
        </div>
      </div>
    </div>
  );
}
