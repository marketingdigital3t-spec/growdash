import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffectivePhase } from "@/lib/phase/phaseStore";

export interface KpiCardProps {
  /** Rotulo da metrica em CAIXA ALTA (ex.: "IMPRESSÕES", "ROAS"). */
  label: string;
  /** Valor formatado em pt-BR (ex.: "24.750.521", "4,37x", "R$ 23,61"). */
  value: string;
  /** Percentual de variacao vs mes anterior (ex.: 18.6 ou -11.2). */
  changePercent?: number;
  /** Texto complementar da variacao (padrao: "vs mês anterior"). */
  changeLabel?: string;
  /** Se true, queda e positiva (ex.: CPL, CAC, custos onde cair e bom). */
  invertChangeColor?: boolean;
  /** Icone exibido dentro da moldura circular neon. */
  icon: ReactNode;
  /** Pontos para desenhar a sparkline (8 a 14 valores numericos). */
  sparklineData?: number[];
  className?: string;
}

/**
 * Card de KPI premium do Dashboard (ETAPA 3).
 *
 * Segue a anatomia oficial da referencia:
 * - Moldura circular com borda neon ao redor do icone
 * - Rotulo em caixa alta e tracking largo
 * - Numero grande em Space Grotesk com `tabular-nums`
 * - Sparkline SVG fluida na cor neon da fase com area em degradê
 * - Variacao percentual com verde para positivo e vermelho para negativo
 */
export function KpiCard({
  label,
  value,
  changePercent,
  changeLabel = "vs mês anterior",
  invertChangeColor = false,
  icon,
  sparklineData = [12, 16, 14, 22, 19, 28, 24, 32, 29, 38],
  className = "",
}: KpiCardProps) {
  const phase = useEffectivePhase();
  const hasChange = typeof changePercent === "number" && Number.isFinite(changePercent);
  const isDrop = hasChange && changePercent < 0;

  // Se cair for bom (CPL, custo), a queda e positiva (verde)
  const isPositive = invertChangeColor ? isDrop : !isDrop;
  const changeColorClass = isPositive ? "text-success" : "text-danger";
  const ChangeIcon = isDrop ? TrendingDown : TrendingUp;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:border-card-border-active hover:shadow-glow-lg ${className}`}
      aria-label={`${label}: ${value}`}
    >
      {/* Linha luminosa no topo do card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-neon to-transparent opacity-60" />

      <div className="flex items-start justify-between gap-3">
        {/* Icone em moldura circular com borda neon */}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm transition group-hover:scale-105">
          {icon}
        </span>
        <p className="truncate text-right text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
          {label}
        </p>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        {/* Valor da metrica grande e denso em Space Grotesk */}
        <strong className="font-display text-2xl font-bold tracking-tight text-text-primary tabular-nums sm:text-3xl">
          {value}
        </strong>

        {/* Sparkline na cor da fase ativa */}
        <div className="h-10 w-24 shrink-0 sm:w-28" aria-hidden="true">
          <MiniSparkline data={sparklineData} phase={phase} />
        </div>
      </div>

      {/* Variacao percentual */}
      {hasChange && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span className={`inline-flex items-center gap-0.5 font-bold ${changeColorClass}`}>
            <ChangeIcon className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {Math.abs(changePercent).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
          </span>
          <span className="truncate text-[11px] text-text-muted">
            {changeLabel}
          </span>
        </div>
      )}
    </article>
  );
}

/** Sparkline SVG pura e leve, sem dependencias externas pesadas */
function MiniSparkline({ data, phase }: { data: number[]; phase: string }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 110;
  const height = 40;
  const padding = 3;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val - min) / range) * (height - padding * 2) - padding;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width - padding},${height} L ${padding},${height} Z`;
  const gradId = `spark-grad-${phase}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-neon)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--primary-neon)" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="var(--primary-neon)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_6px_var(--primary-neon)]"
      />
    </svg>
  );
}
