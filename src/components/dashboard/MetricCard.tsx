import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { ReactNode } from "react";

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

  return (
    <Card className="cursor-default h-full group transition-shadow duration-300" title={tooltip}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 sm:space-y-2 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate sm:whitespace-nowrap sm:overflow-visible sm:text-clip">{title}</p>
            <p className={cn("text-lg sm:text-2xl font-bold tabular-nums truncate sm:whitespace-nowrap sm:overflow-visible sm:text-clip", colorByValue && value > 0 && "text-emerald-600 dark:text-emerald-400", colorByValue && value < 0 && "text-red-500 dark:text-red-400")}>
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} duration={700} />
            </p>
          </div>
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 transition-all duration-300 group-hover:bg-primary/15 group-hover:scale-110">
            {icon}
          </div>
        </div>
        {variation !== undefined && (
          <div className={cn("flex items-center gap-1 mt-2 sm:mt-3 text-[10px] sm:text-xs font-medium", isPositive ? "text-emerald-600" : "text-red-500")}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <AnimatedNumber value={variation} prefix={isPositive ? "+" : ""} suffix="%" decimals={1} duration={500} />
            <span className="text-muted-foreground font-normal ml-1 hidden sm:inline">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
