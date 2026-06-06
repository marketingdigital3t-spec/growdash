import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FunnelWeekdayChart({ a }: { a: FunnelAnalytics }) {
  const data = a.weekdayBreakdown.map((w) => ({
    label: w.label.slice(0, 3),
    Conversões: w.conversions,
    Taxa: Number(w.conversionRate.toFixed(1)),
    Receita: w.revenue,
  }));

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">9. Dias que mais convertem</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
                formatter={(v: number, name) => name === "Receita" ? [fmtBRL(v), name] : [v, name]}
              />
              <Bar dataKey="Conversões" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill="hsl(142 71% 45%)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-7 gap-1 mt-3 text-[10px] text-center text-muted-foreground">
          {a.weekdayBreakdown.map((w) => (
            <div key={w.weekday}>
              <div>{w.label.slice(0, 3)}</div>
              <div className="text-foreground">{w.conversionRate.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
