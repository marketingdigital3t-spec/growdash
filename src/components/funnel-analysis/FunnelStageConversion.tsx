import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelStageConversion({ a }: Props) {
  const data = a.stageConversion.map((s) => ({
    label: s.label,
    rate: Number(s.rate.toFixed(1)),
    lossPct: Number(s.lossPct.toFixed(1)),
    lost: s.lost,
    isBottleneck: s.isBottleneck,
  }));

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">2. Taxa de avanço entre etapas</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem etapas suficientes para calcular.</div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ left: 80, right: 30 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="label" type="category" width={200} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
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
            <div className="mt-4 space-y-1.5">
              {data.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{d.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{d.rate}% avanço</span>
                    <span className="text-red-400 tabular-nums">−{d.lost} leads</span>
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
