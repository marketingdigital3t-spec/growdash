import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

interface Props {
  a: FunnelAnalytics;
}

const STAGE_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(199 89% 48%)",
  "hsl(188 95% 43%)",
  "hsl(160 84% 39%)",
  "hsl(142 71% 45%)",
  "hsl(45 93% 55%)",
  "hsl(25 95% 53%)",
  "hsl(0 84% 60%)",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FunnelStageDistribution({ a }: Props) {
  const stages = a.stages.filter((s) => !s.is_lost);
  const total = stages.reduce((s, x) => s + x.count, 0);

  const data = stages.map((s, i) => ({
    name: s.name,
    value: s.count,
    color: STAGE_COLORS[i % STAGE_COLORS.length],
  }));

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">1. Distribuição por etapa do funil (RD)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
                  formatter={(v: number, n) => [`${v} leads`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-semibold">{total}</span>
              <span className="text-xs text-muted-foreground">leads no funil</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 font-medium">Etapa</th>
                  <th className="text-right py-2 font-medium">Leads</th>
                  <th className="text-right py-2 font-medium">% total</th>
                  <th className="text-right py-2 font-medium">Tempo médio</th>
                  <th className="text-right py-2 font-medium">Em negociação</th>
                </tr>
              </thead>
              <tbody>
                {a.stages.map((s, i) => (
                  <tr key={s.rd_stage_id} className="border-b border-border/20">
                    <td className="py-2 flex items-center gap-2">
                      {!s.is_lost && (
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }}
                        />
                      )}
                      <span className={s.is_lost ? "text-red-400" : s.is_won ? "text-emerald-400" : ""}>
                        {s.name}
                      </span>
                      {s.is_won && <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">ganho</Badge>}
                      {s.is_lost && <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">perda</Badge>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.count}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{s.pct.toFixed(1)}%</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {s.avgDaysInStage > 0 ? `${s.avgDaysInStage.toFixed(1)} d` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {s.valueInNegotiation > 0 ? fmtBRL(s.valueInNegotiation) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
