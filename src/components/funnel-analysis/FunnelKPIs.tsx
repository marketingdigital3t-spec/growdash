import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Users, CheckCircle2, Trophy, Percent, Clock, DollarSign, TrendingUp, Target } from "lucide-react";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

interface Props {
  a: FunnelAnalytics;
  cpl?: number | null;
  cac?: number | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FunnelKPIs({ a, cpl, cac }: Props) {
  const cards = [
    { label: "Leads totais", value: a.totalLeads, icon: Users, color: "text-blue-400", format: "int" as const },
    { label: "Leads qualificados", value: a.qualifiedLeads, icon: CheckCircle2, color: "text-cyan-400", format: "int" as const },
    { label: "Conversões / Vendas", value: a.conversions, icon: Trophy, color: "text-emerald-400", format: "int" as const },
    { label: "Taxa de conversão", value: a.conversionRate, icon: Percent, color: "text-violet-400", format: "pct" as const },
    { label: "Tempo médio até conversão", value: a.avgDaysToConvert, icon: Clock, color: "text-amber-400", format: "days" as const },
    { label: "Ticket médio", value: a.avgTicket, icon: Target, color: "text-cyan-400", format: "brl" as const },
    { label: "Receita gerada", value: a.revenue, icon: DollarSign, color: "text-emerald-400", format: "brl" as const },
    {
      label: "CPL / CAC",
      value: 0,
      icon: TrendingUp,
      color: "text-pink-400",
      format: "custom" as const,
      custom: cpl != null || cac != null
        ? `${cpl != null ? fmtBRL(cpl) : "—"} / ${cac != null ? fmtBRL(cac) : "—"}`
        : "Sem dados",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="bg-card/60 border-border/40 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="text-2xl font-semibold">
                {c.format === "int" && <AnimatedNumber value={c.value} decimals={0} />}
                {c.format === "pct" && (
                  <><AnimatedNumber value={c.value} decimals={1} />%</>
                )}
                {c.format === "days" && (
                  <><AnimatedNumber value={c.value} decimals={1} /> <span className="text-sm text-muted-foreground">dias</span></>
                )}
                {c.format === "brl" && fmtBRL(c.value)}
                {c.format === "custom" && <span className="text-base">{c.custom}</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
