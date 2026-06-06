import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { InsightRow } from "@/hooks/useInsights";

interface FunnelChartViewProps {
  insights: InsightRow[];
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalLeads: number;
  salesValue: number;
  revenueValue: number;
}

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(v: number) {
  return v.toLocaleString("pt-BR");
}

interface MetricCardData {
  title: string;
  value: string;
  change: string;
}

export function FunnelChartView({
  insights,
  totalSpend,
  totalImpressions,
  totalClicks,
  totalReach,
  totalLeads,
}: FunnelChartViewProps) {
  // Build a single unified sparkline from daily spend data
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of insights) {
      map.set(r.date, (map.get(r.date) || 0) + r.spend);
    }
    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ v }));
    return sorted.length > 1 ? sorted : [{ v: 0 }, { v: 0 }];
  }, [insights]);

  const cards: MetricCardData[] = [
    { title: "Valor Gasto", value: formatCurrency(totalSpend), change: `+${formatCurrency(totalSpend)}` },
    { title: "Impressões", value: formatNumber(totalImpressions), change: `+${formatNumber(totalImpressions)}` },
    { title: "Cliques", value: formatNumber(totalClicks), change: `+${formatNumber(totalClicks)}` },
    { title: "Visitas Totais", value: formatNumber(totalReach), change: `+${formatNumber(totalReach)}` },
    { title: "Leads", value: formatNumber(totalLeads), change: `+${formatNumber(totalLeads)}` },
  ];

  return (
    <div className="relative rounded-lg border bg-card overflow-hidden">
      {/* Cards row */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 divide-x divide-border">
        {cards.map((card) => (
          <div key={card.title} className="px-4 pt-4 pb-48 sm:pb-56">
            <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
            <p className="text-xl font-bold mt-1">{card.value}</p>
            <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              <span>{card.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Single continuous chart spanning full width at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-48 sm:h-56 z-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 40, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="funnel-chart-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="hsl(221, 83%, 70%)"
              strokeWidth={2}
              fill="url(#funnel-chart-grad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
