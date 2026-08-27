import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Users, Trophy, Percent, Clock, DollarSign, TrendingUp, Target } from "lucide-react";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { metricDescription } from "@/lib/metricPresentation";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";

interface Props {
  a: FunnelAnalytics;
  metaLeads: number;
  trafficSpend: number;
  cpl?: number | null;
  cac?: number | null;
  salesConversionRate?: number | null;
  previousAvgDaysToConvert?: number | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FunnelKPIs({ a, metaLeads, trafficSpend, cpl, cac, salesConversionRate, previousAvgDaysToConvert }: Props) {
  const timeChange = previousAvgDaysToConvert && previousAvgDaysToConvert > 0 ? ((a.avgDaysToConvert - previousAvgDaysToConvert) / previousAvgDaysToConvert) * 100 : null;
  const cards = [
    { label: "Investimento em tráfego", value: trafficSpend, icon: DollarSign, color: "text-yellow-400", format: "brl" as const },
    { label: "Leads totais Meta", value: metaLeads, icon: Users, color: "text-sky-400", format: "int" as const },
    { label: "Conversões / Vendas", value: a.conversions, icon: Trophy, color: "text-emerald-400", format: "int" as const },
    { label: "Conversão Meta → venda", value: salesConversionRate ?? 0, icon: Percent, color: "text-sky-400", format: "pct" as const, decimals: 2 },
    { label: "Tempo médio até conversão", value: a.avgDaysToConvert, icon: Clock, color: timeChange != null && timeChange > 0 ? "text-red-400" : "text-amber-400", format: "days" as const, detail: timeChange == null ? "Sem período anterior" : `${Math.abs(timeChange).toFixed(0)}% ${timeChange <= 0 ? "menor" : "maior"} que período anterior` },
    { label: "Ticket médio", value: a.avgTicket, icon: Target, color: "text-sky-400", format: "brl" as const },
    { label: "Receita gerada", value: a.revenue, icon: DollarSign, color: "text-emerald-400", format: "brl" as const },
    {
      label: "CPL / CAC",
      value: 0,
      icon: TrendingUp,
      color: "text-yellow-400",
      format: "custom" as const,
      custom: `${fmtBRL(cpl ?? 0)} / ${fmtBRL(cac ?? 0)}`,
    },
  ];

  return (
    <div className="gd-kpi-grid gd-funnel-kpi-grid grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <MetricHelpTooltip key={c.label} title={c.label} description={metricDescription(c.label)} className="h-full" showHint>
            <Card className={`gd-metric-card gd-funnel-kpi cursor-default bg-card/75 border-border/60 border-l-2 backdrop-blur ${c.color.replace("text-", "border-")}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2 pr-5">
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                  <Icon className={`h-4 w-4 ${c.color} dark:text-white`} />
                </div>
                <div className={`text-2xl font-semibold ${c.color} dark:text-white`}>
                  {c.format === "int" && <AnimatedNumber value={Math.round(c.value)} decimals={0} />}
                  {c.format === "pct" && <><AnimatedNumber value={c.value} decimals={c.decimals ?? 1} />%</>}
                  {c.format === "days" && <><AnimatedNumber value={c.value} decimals={1} /> <span className="text-sm text-muted-foreground">dias</span></>}
                  {c.format === "brl" && fmtBRL(c.value)}
                  {c.format === "custom" && <span className="text-base">{c.custom}</span>}
                </div>
                {c.detail && <p className="mt-1 text-[10px] text-muted-foreground">{c.detail}</p>}
              </CardContent>
            </Card>
          </MetricHelpTooltip>
        );
      })}
    </div>
  );
}
