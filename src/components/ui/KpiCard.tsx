import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

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
  /** Marca o KPI de faturamento quando a meta de fase foi atingida. */
  revenueTargetMet?: boolean;
  className?: string;
}

/**
 * Card de KPI premium do Dashboard (ETAPA 3).
 *
 * Segue a anatomia oficial da referencia:
 * - Moldura circular com borda neon ao redor do icone
 * - Rotulo em caixa alta e tracking largo
 * - Numero grande em Space Grotesk com `tabular-nums`
 * - Variacao percentual com verde para positivo e vermelho para negativo
 */
export function KpiCard({
  label,
  value,
  changePercent,
  changeLabel = "vs mês anterior",
  invertChangeColor = false,
  icon,
  revenueTargetMet = false,
  className = "",
}: KpiCardProps) {
  const hasChange = typeof changePercent === "number" && Number.isFinite(changePercent);
  const isDrop = hasChange && changePercent < 0;

  // Se cair for bom (CPL, custo), a queda e positiva (verde)
  const isPositive = invertChangeColor ? isDrop : !isDrop;
  const changeColorClass = isPositive ? "text-success" : "text-danger";
  const ChangeIcon = isDrop ? TrendingDown : TrendingUp;
  const metricTone = getMetricTone(label);
  const metricToneClasses = {
    // A fase colore a moldura; a semântica fica reservada à variação abaixo.
    success: "border-cardBorderActive bg-primary/10 text-primary-neon shadow-phase-glow",
    expense: "border-cardBorderActive bg-primary/10 text-primary-neon shadow-phase-glow",
    phase: "border-cardBorderActive bg-primary/10 text-primary-neon shadow-phase-glow",
    neutral: "border-cardBorderActive bg-primary/10 text-primary-neon shadow-phase-glow",
  }[metricTone];

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-cardBorder bg-card p-5 shadow-phase-glow backdrop-blur-xl transition hover:-translate-y-1 hover:border-cardBorderActive hover:shadow-phase-glow-lg ${className}`}
      aria-label={`${label}: ${value}`}
      {...(revenueTargetMet ? { "data-revenue-target": "met" } : {})}
    >
      {/* Linha luminosa no topo do card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-neon to-transparent opacity-60" />

      <div className="flex items-start justify-between gap-3">
        {/* Icone em moldura circular com borda neon */}
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition group-hover:scale-105 ${metricToneClasses}`}>
          {icon}
        </span>
        {/* O rotulo precisa de min-w-0 para que o truncate funcione: sem isso o
            flex item nao cede espaco e o texto vaza para fora do card. */}
        <p className="min-w-0 truncate text-right text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted" title={label}>
          {label}
        </p>
      </div>

      {/* Valor da metrica grande e denso em Space Grotesk */}
      <strong className="mt-3 block min-w-0 truncate font-display text-2xl font-bold tracking-tight text-text-primary tabular-nums sm:text-3xl" title={value}>
        {value}
      </strong>

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

function getMetricTone(label: string): "success" | "expense" | "phase" | "neutral" {
  const normalized = label.toLocaleLowerCase();
  if (/faturamento|receita|lucro|margem|vendas/.test(normalized)) return "success";
  if (/gasto|investimento|cpc|cpl|cac|cpm|despesa/.test(normalized)) return "expense";
  if (/roas|convers[aã]o|taxa/.test(normalized)) return "phase";
  return "neutral";
}
