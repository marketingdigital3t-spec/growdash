import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelLostReasons({ a }: { a: FunnelAnalytics }) {
  const data = a.lostReasons.slice(0, 8).map((r) => ({
    name: r.reason.length > 28 ? r.reason.slice(0, 28) + "…" : r.reason,
    count: r.count,
    pct: Number(r.pct.toFixed(1)),
  }));
  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">6. Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma perda registrada.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ left: 100, right: 30 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
                  formatter={(v: number, _n, p: any) => [`${v} (${p.payload.pct}%)`, "Perdas"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.map((_, i) => <Cell key={i} fill="hsl(0 84% 60%)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
