import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip as StageTooltip, TooltipContent as StageTooltipContent, TooltipProvider, TooltipTrigger as StageTooltipTrigger } from "@/components/ui/tooltip";
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
          <div className="flex flex-col items-center gap-2 py-1" aria-label="Funil visual por etapa">
            <div className="w-full rounded-2xl border border-border/50 bg-background/30 px-1 py-2 sm:px-2 sm:py-3">
              <div className="mx-auto flex w-full max-w-[280px] flex-col items-center">
                <TooltipProvider delayDuration={250}>
                  {stages.map((stage, index) => {
                    const width = funnelStageVisualWidth(index, visualStageCount);
                    const accentColor = funnelStageVisualColor(index, visualStageCount);
                    const avgTime = stage.avgDaysInStage > 0 ? `${stage.avgDaysInStage.toFixed(1)} dias` : "Indisponível";
                    const negotiationValue = stage.valueInNegotiation > 0 ? fmtBRL(stage.valueInNegotiation) : "Nenhum valor";
                    const accessibleDescription = `${stage.name}: ${stage.count} leads, ${stage.pct.toFixed(1)}% do total. Tempo médio: ${avgTime}. Valor em negociação: ${negotiationValue}.`;
                    return (
                      <StageTooltip key={stage.rd_stage_id}>
                        <StageTooltipTrigger asChild>
                          <div
                            tabIndex={0}
                            className="group relative z-10 -mt-px flex min-h-[36px] cursor-help flex-col items-center justify-center overflow-hidden border-y border-white/20 px-2 py-0.5 text-center text-white shadow-[0_6px_14px_-12px_rgba(0,0,0,.95)] outline-none transition-[width,filter,transform] duration-300 first:mt-0 hover:z-20 hover:brightness-110 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[40px] sm:px-3"
                            style={{
                              width: `max(${width}%, 132px)`,
                              background: "linear-gradient(105deg, #08090b 0%, #4b4f56 14%, #15171b 27%, #050506 53%, #777c84 85%, #17191d 100%)",
                              clipPath: "polygon(5% 0, 95% 0, 86% 100%, 14% 100%)",
                              filter: "drop-shadow(0 3px 3px rgba(0,0,0,.28))",
                            }}
                            aria-label={accessibleDescription}
                          >
                            <span className="pointer-events-none absolute inset-x-[7%] top-0 h-px rounded-full bg-gradient-to-r from-white/20 via-white/90 to-white/20" aria-hidden="true" />
                            <span className="pointer-events-none absolute inset-x-[11%] bottom-0 h-[3px] rounded-full border-t border-white/60 bg-gradient-to-r from-slate-500 via-white/90 to-slate-500 shadow-[0_-1px_3px_rgba(255,255,255,.55)]" aria-hidden="true" />
                            <span className="relative z-10 flex max-w-[92%] items-center justify-center gap-1 truncate text-[7px] font-bold uppercase leading-tight tracking-[0.06em] sm:text-[8px]">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: accentColor }} aria-hidden="true" />
                              <span className="truncate">{stage.name}</span>
                            </span>
                            <span className="relative z-10 text-[11px] font-extrabold leading-tight tabular-nums sm:text-xs">{stage.count} <span className="text-[7px] font-semibold uppercase tracking-normal text-white/70 sm:text-[8px]">leads</span> <span className="text-[7px] font-semibold text-white/70 sm:text-[8px]">· {stage.pct.toFixed(1)}%</span></span>
                            <span className="relative z-10 flex max-w-[94%] items-center justify-center gap-x-2 truncate text-[6px] font-medium leading-tight text-white/65 sm:text-[7px]">
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
                <div className="mt-0.5 h-2 w-10 rounded-b-md border-x border-b border-white/50 bg-gradient-to-r from-slate-500 via-slate-100 to-slate-600 shadow-[0_4px_8px_-5px_rgba(0,0,0,.9)]" aria-hidden="true" />
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
