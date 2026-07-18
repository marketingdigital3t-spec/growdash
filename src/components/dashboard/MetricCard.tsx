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

  return (
    <Card className="gd-metric-card group h-full min-w-0 cursor-default overflow-hidden transition-shadow duration-300" title={description} aria-label={`${title}. ${description}`}>
      <CardContent className="min-w-0 p-3 sm:p-4 xl:p-5">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
          <div className="min-w-0 space-y-1 sm:space-y-2">
            <p className="line-clamp-2 min-h-[2.35em] max-w-full break-words text-[9px] font-bold uppercase leading-[1.18] tracking-[.08em] text-muted-foreground sm:text-[10px] xl:text-xs" title={title}>{title}</p>
            <p className={cn("max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl 2xl:text-2xl", colorByValue && value > 0 && "text-emerald-600 dark:text-emerald-400", colorByValue && value < 0 && "text-red-500 dark:text-red-400")} title={`${prefix ?? ""}${value}${suffix ?? ""}`}>
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} duration={700} />
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15 sm:h-10 sm:w-10">
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
