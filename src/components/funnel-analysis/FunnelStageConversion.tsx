import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { cn } from "@/lib/utils";

export function FunnelStageConversion({ a }: Props) {
  const data = a.stageConversion.map((s) => ({
    label: s.label,
    shortLabel: shortenLabel(s.label),
    rate: Math.min(100, Math.max(0, Number(s.rate.toFixed(1)))),
    lossPct: Number(s.lossPct.toFixed(1)),
    lost: Math.max(0, Math.round(s.lost || 0)),
    isBottleneck: s.isBottleneck && s.lost > 0,
  }));
  const chartHeight = Math.min(480, Math.max(250, data.length * 48 + 24));

  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">3. Taxa de avanço entre etapas</CardTitle>
        <p className="text-xs text-muted-foreground">Estimativa pelo estágio atual de cada negociação no RD. Cada taxa considera apenas funis que possuem exatamente esse par de etapas; o histórico individual de movimentações não é armazenado.</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem etapas suficientes para calcular.</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[520px]" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 8, left: 8, right: 30, bottom: 8 }} barCategoryGap="22%">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="shortLabel" type="category" width={158} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
                    labelFormatter={(_value, payload) => payload?.[0]?.payload?.label || _value}
                    formatter={(v: number) => [`${v}%`, "Taxa de avanço"]}
                  />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                    {data.map((d, i) => (
                      <Cell key={i} fill={d.isBottleneck ? "hsl(0 84% 60%)" : "hsl(160 84% 39%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {data.map((d, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground" title={d.label}>{d.label}</span>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
                    <span className="tabular-nums font-semibold">{d.rate}% avanço</span>
                    <span className={cn("tabular-nums", d.lost > 0 ? "text-red-400" : "text-muted-foreground")}>{d.lost > 0 ? `−${d.lost}` : "0"} leads</span>
                    {d.isBottleneck && (
                      <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px]">
                        Gargalo principal
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface Props { a: FunnelAnalytics }

function shortenLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 24) return normalized;
  const [from, to] = normalized.split(/\s*→\s*/);
  if (from && to) {
    const fromShort = from.length > 11 ? `${from.slice(0, 10).trim()}…` : from;
    const toShort = to.length > 11 ? `${to.slice(0, 10).trim()}…` : to;
    return `${fromShort} → ${toShort}`;
  }
  return `${normalized.slice(0, 22).trim()}…`;
}
