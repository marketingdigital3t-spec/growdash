import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { ReactNode } from "react";
import { metricDescription } from "@/lib/metricPresentation";

interface MetricCardProps {
  title: string;
  value: number;
  variation?: number;
  icon: ReactNode;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  colorByValue?: boolean;
  tooltip?: string;
}

export function MetricCard({ title, value, variation, icon, prefix, suffix, decimals = 2, colorByValue, tooltip }: MetricCardProps) {
  const isPositive = (variation ?? 0) >= 0;
  const description = metricDescription(title, tooltip);
  const valueTone = metricValueTone(title, value);

  return (
    <Card className="dashboard-terra-card gd-metric-card group h-full min-w-0 cursor-default overflow-hidden" title={description} aria-label={`${title}. ${description}`}>
      <CardContent className="flex min-h-[96px] min-w-0 items-center p-3 sm:min-h-[104px] sm:p-4 xl:min-h-[112px] xl:p-5">
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 flex-col items-start justify-center gap-1 text-left">
            <p className="line-clamp-2 min-h-[2.35em] max-w-full break-words text-[9px] font-bold uppercase leading-[1.18] tracking-[.08em] text-muted-foreground sm:text-[10px] xl:text-xs" title={title}>{title}</p>
            <p className={cn("dashboard-terra-metric-value max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl 2xl:text-2xl", valueTone === "positive" && "text-emerald-500 dark:text-emerald-400", valueTone === "negative" && "text-red-500 dark:text-red-400")} title={`${prefix ?? ""}${value}${suffix ?? ""}`}>
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} duration={700} />
            </p>
          </div>
          <div className="gd-metric-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10">
            {icon}
          </div>
        </div>
        {variation !== undefined && (
          <div className={cn("mt-2 flex min-w-0 items-center gap-1 overflow-hidden text-[10px] font-medium sm:mt-3 sm:text-xs", isPositive ? "text-emerald-600" : "text-red-500")}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <AnimatedNumber value={variation} prefix={isPositive ? "+" : ""} suffix="%" decimals={1} duration={500} />
            <span className="ml-1 hidden truncate font-normal text-muted-foreground sm:inline">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function metricValueTone(title: string, value: number): "positive" | "negative" | "neutral" {
  const normalized = title.toLocaleLowerCase();
  if (value < 0) return "negative";
  if (/cpl|cpm|cpc|cac|investimento|gasto|despesa|tr[aá]fego pago/.test(normalized)) return "negative";
  if (/receita|faturamento|lucro|margem|roas|convers[aã]o|leads|vendas|resultado|saldo/.test(normalized)) return value > 0 ? "positive" : "neutral";
  return "neutral";
}
