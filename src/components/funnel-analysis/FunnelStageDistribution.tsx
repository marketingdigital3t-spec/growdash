import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { funnelStageDistributionTotal, funnelStageVisualColor, funnelStageVisualWidth } from "@/lib/funnelStageDistribution";

interface Props {
  a: FunnelAnalytics;
  liveState?: "idle" | "refreshing" | "fresh" | "error";
  lastUpdatedAt?: Date | null;
  liveError?: string | null;
  onRefresh?: () => void;
}

const STAGE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / .84)",
  "hsl(var(--primary) / .68)",
  "hsl(var(--primary) / .52)",
  "hsl(var(--primary) / .38)",
  "hsl(var(--warning))",
  "hsl(25 95% 53%)",
  "hsl(0 84% 60%)",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function stageColor(stage: FunnelAnalytics["stages"][number], index: number) {
  if (stage.is_won) return "hsl(142 71% 45%)";
  if (stage.is_lost) return "hsl(0 84% 60%)";
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

export function FunnelStageDistribution({ a, liveState = "idle", lastUpdatedAt, liveError, onRefresh }: Props) {
  // Include lost and won stages so the distribution reconciles exactly to the
  // current RD deal inventory for the selected account and funnel.
  const stages = a.stages;
  const total = funnelStageDistributionTotal(a);
  const [visualMode, setVisualMode] = useState(false);
  const visualStageCount = stages.length;

  const data = stages.map((s, i) => ({
    name: s.name,
    value: s.count,
    color: stageColor(s, i),
  }));
  const unavailable = liveState === "error" && !lastUpdatedAt && total === 0;

  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">2. Distribuição por etapa do funil (RD)</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground" aria-label="Modo de visualização do funil">
              <span className={!visualMode ? "font-semibold text-foreground" : undefined}>Tabela</span>
              <Switch
                aria-label="Alternar entre tabela e visual do funil"
                checked={visualMode}
                onCheckedChange={setVisualMode}
              />
              <span className={visualMode ? "font-semibold text-foreground" : undefined}>Visual</span>
            </div>
            <span className={`text-[11px] ${liveState === "error" ? "text-destructive" : liveState === "refreshing" ? "text-amber-500" : "text-muted-foreground"}`}>
              {liveState === "refreshing"
                ? "Atualizando agora"
                : liveState === "error"
                  ? "Última atualização não confirmada"
                  : lastUpdatedAt
                    ? `Atualizado há ${Math.max(0, Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000))}s`
                    : "Aguardando atualização"}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Negociações no período selecionado para as contas e funis do RD.</p>
        {liveState === "error" && liveError && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-destructive">{liveError}</p>
            {onRefresh && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onRefresh}>Sincronizar agora</Button>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {visualMode ? (
          <div className="flex flex-col items-center gap-2 py-2" aria-label="Funil visual por etapa">
            <div className="flex w-full max-w-2xl flex-col items-center gap-1.5">
              {stages.map((stage, index) => {
                const width = funnelStageVisualWidth(index, visualStageCount);
                const color = funnelStageVisualColor(index, visualStageCount);
                const details = `${stage.name}: ${stage.count} leads (${stage.pct.toFixed(1)}%). Tempo médio: ${stage.avgDaysInStage > 0 ? `${stage.avgDaysInStage.toFixed(1)} dias` : "indisponível"}. Em negociação: ${stage.valueInNegotiation > 0 ? fmtBRL(stage.valueInNegotiation) : "nenhum valor"}.`;
                return (
                  <div
                    key={stage.rd_stage_id}
                    className="flex min-h-14 items-center justify-center px-4 text-center text-xs font-semibold text-white shadow-sm transition-[width] duration-300"
                    style={{ width: `${width}%`, background: color, clipPath: "polygon(4% 0, 96% 0, 100% 100%, 0 100%)" }}
                    title={details}
                    aria-label={details}
                  >
                    <span className="min-w-0 truncate">{stage.name} · {stage.count} ({stage.pct.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{unavailable ? "—" : total}</span>
              <span>{unavailable ? "Indisponível" : "negociações no período"}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
            <div className="relative mx-auto h-56 w-full max-w-[240px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={56}
                    outerRadius={88}
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
                <span className="text-2xl font-semibold">{unavailable ? "—" : total}</span>
                <span className="text-xs text-muted-foreground">{unavailable ? "Indisponível" : "leads no funil"}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="py-2.5 text-left font-semibold">Etapa</th>
                    <th className="py-2.5 text-right font-semibold">Leads</th>
                    <th className="py-2.5 text-right font-semibold">% total</th>
                    <th className="py-2.5 text-right text-xs font-medium">Tempo médio</th>
                    <th className="py-2.5 text-right text-xs font-medium">Em negociação</th>
                  </tr>
                </thead>
                <tbody>
                  {a.stages.map((s, i) => (
                    <tr key={s.rd_stage_id} className="border-b border-border/20">
                      <td className="flex items-center gap-2 py-2.5 font-medium">
                        {!s.is_lost && (
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: stageColor(s, i) }}
                          />
                        )}
                        <span className={s.is_lost ? "text-red-400" : s.is_won ? "text-emerald-400" : ""}>
                          {s.name}
                        </span>
                        {s.is_won && <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">ganho</Badge>}
                        {s.is_lost && <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">perda</Badge>}
                      </td>
                      <td className="py-2.5 text-right text-base font-bold tabular-nums">{s.count}</td>
                      <td className="py-2.5 text-right text-base font-bold tabular-nums text-foreground">{s.pct.toFixed(1)}%</td>
                      <td className="py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                        {s.avgDaysInStage > 0 ? `${s.avgDaysInStage.toFixed(1)} d` : "—"}
                      </td>
                      <td className="py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                        {s.valueInNegotiation > 0 ? fmtBRL(s.valueInNegotiation) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
