import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { funnelStageDistributionTotal } from "@/lib/funnelStageDistribution";

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
  "hsl(var(--primary) / .30)",
  "hsl(var(--primary) / .24)",
  "hsl(var(--primary) / .18)",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function stageColor(stage: FunnelAnalytics["stages"][number], index: number) {
  if (stage.is_won) return "hsl(var(--primary))";
  if (stage.is_lost) return "hsl(0 84% 60%)";
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

export function FunnelStageDistribution({ a, liveState = "idle", lastUpdatedAt, liveError, onRefresh }: Props) {
  // Include lost and won stages so the distribution reconciles exactly to the
  // current RD deal inventory for the selected account and funnel.
  const total = funnelStageDistributionTotal(a);
  const unavailable = liveState === "error" && !lastUpdatedAt && total === 0;

  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">3. Distribuição por etapa do funil (RD)</CardTitle>
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
        <p className="text-xs text-muted-foreground">Negociações no período selecionado para as contas e funis do RD.</p>
        {liveState === "error" && liveError && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-destructive">{liveError}</p>
            {onRefresh && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onRefresh}>Sincronizar agora</Button>}
          </div>
        )}
      </CardHeader>
      <CardContent>
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
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{unavailable ? "—" : total}</span>
          <span>{unavailable ? "Indisponível" : "negociações no período"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
