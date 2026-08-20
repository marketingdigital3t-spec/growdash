import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelLostReasons({ a }: { a: FunnelAnalytics }) {
  const data = a.lostReasons.slice(0, 8).map((r) => ({
    name: r.reason.length > 28 ? r.reason.slice(0, 28) + "…" : r.reason,
    count: r.count,
    pct: Number(r.pct.toFixed(1)),
  }));
  const standby = a.standbyReasons.slice(0, 5);
  const reasonList = (rows: typeof a.lostReasons, empty: string, tone: "loss" | "standby") => rows.length === 0 ? (
    <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
  ) : (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/50 bg-background/35 px-3 py-2 text-xs">
          <span className="truncate" title={row.reason}>{row.reason}</span>
          <span className={tone === "loss" ? "font-semibold tabular-nums text-red-400" : "font-semibold tabular-nums text-amber-400"}>{row.count} · {row.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">6. Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold text-foreground">Perdas registradas</h3>
          {data.length === 0 ? reasonList([], "Nenhuma perda registrada.", "loss") : (
          <div className="h-48">
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
          </div>)}
        </section>
        <section className="border-t border-border/50 pt-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Motivos em espera / Stand By</h3>
          {reasonList(standby, "Nenhuma negociação está em espera.", "standby")}
        </section>
      </CardContent>
    </Card>
  );
}
