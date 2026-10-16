import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip as StageTooltip, TooltipContent as StageTooltipContent, TooltipProvider, TooltipTrigger as StageTooltipTrigger } from "@/components/ui/tooltip";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { funnelStageDistributionTotal, funnelStageVisualColor, funnelStageVisualTextColor, funnelStageVisualWidth } from "@/lib/funnelStageDistribution";

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
  // The funnel is the primary representation. The table remains available
  // for users who need a dense, row-by-row comparison.
  const [visualMode, setVisualMode] = useState(true);
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
          <div className="flex flex-col items-center gap-3 py-2" aria-label="Funil visual por etapa">
            <div className="w-full overflow-x-auto rounded-2xl border border-border/50 bg-background/30 px-2 py-4 sm:px-5 sm:py-6">
              <div className="mx-auto flex min-w-[320px] max-w-3xl flex-col items-center">
                <TooltipProvider delayDuration={250}>
                  {stages.map((stage, index) => {
                    const width = funnelStageVisualWidth(index, visualStageCount);
                    const color = funnelStageVisualColor(index, visualStageCount);
                    const textColor = funnelStageVisualTextColor(index, visualStageCount);
                    const avgTime = stage.avgDaysInStage > 0 ? `${stage.avgDaysInStage.toFixed(1)} dias` : "Indisponível";
                    const negotiationValue = stage.valueInNegotiation > 0 ? fmtBRL(stage.valueInNegotiation) : "Nenhum valor";
                    const accessibleDescription = `${stage.name}: ${stage.count} leads, ${stage.pct.toFixed(1)}% do total. Tempo médio: ${avgTime}. Valor em negociação: ${negotiationValue}.`;
                    const isBright = index / Math.max(visualStageCount - 1, 1) >= 0.34;
                    return (
                      <StageTooltip key={stage.rd_stage_id}>
                        <StageTooltipTrigger asChild>
                          <div
                            tabIndex={0}
                            className="group relative z-10 -mt-px flex min-h-[72px] cursor-help flex-col items-center justify-center px-5 py-2 text-center shadow-[0_8px_20px_-14px_rgba(0,0,0,.9)] outline-none transition-[width,filter,transform] duration-300 first:mt-0 hover:z-20 hover:brightness-110 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[82px] sm:px-8"
                            style={{
                              width: `max(${width}%, 220px)`,
                              color: textColor,
                              background: `linear-gradient(105deg, color-mix(in srgb, ${color} 86%, black), ${color} 52%, color-mix(in srgb, ${color} 82%, white))`,
                              clipPath: "polygon(4% 0, 96% 0, 91% 100%, 9% 100%)",
                            }}
                            aria-label={accessibleDescription}
                          >
                            <span className="max-w-full truncate text-[11px] font-bold uppercase tracking-[0.08em] sm:text-xs">{stage.name}</span>
                            <span className="mt-0.5 text-base font-extrabold tabular-nums sm:text-lg">{stage.count} <span className="text-[10px] font-semibold uppercase tracking-normal opacity-80 sm:text-[11px]">leads</span></span>
                            <span className="text-[11px] font-semibold tabular-nums opacity-85">{stage.pct.toFixed(1)}% do total</span>
                            <span className={`mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] font-medium ${isBright ? "text-slate-950/70" : "text-white/80"}`}>
                              <span>{stage.avgDaysInStage > 0 ? `${stage.avgDaysInStage.toFixed(1)} d médio` : "Tempo indisponível"}</span>
                              <span>{stage.valueInNegotiation > 0 ? fmtBRL(stage.valueInNegotiation) : "Sem valor"}</span>
                            </span>
                          </div>
                        </StageTooltipTrigger>
                        <StageTooltipContent side="top" className="max-w-xs space-y-1.5 px-3 py-2.5 text-xs">
                          <p className="font-semibold text-foreground">{stage.name}</p>
                          <p>{stage.count} leads · {stage.pct.toFixed(1)}% do total</p>
                          <p>Tempo médio: {avgTime}</p>
                          <p>Valor em negociação: {negotiationValue}</p>
                        </StageTooltipContent>
                      </StageTooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{unavailable ? "—" : total}</span>
              <span>{unavailable ? "Indisponível" : "negociações no período · métricas dentro do funil"}</span>
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
