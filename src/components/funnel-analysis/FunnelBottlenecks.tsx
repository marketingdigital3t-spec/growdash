import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelBottlenecks({ a }: { a: FunnelAnalytics }) {
  const b = a.bottleneck;
  const worstStage = [...a.stages].filter((s) => !s.is_lost && !s.is_won).sort((x, y) => y.avgDaysInStage - x.avgDaysInStage)[0];

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">4. Gargalos do funil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {b ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-3">
            <TrendingDown className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Maior queda: {b.from} → {b.to}</div>
              <div className="text-muted-foreground mt-0.5">
                Perda de {b.lossPct.toFixed(1)}% dos leads nessa transição.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Sem dados de transição entre etapas.</div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
            <Clock className="h-4 w-4 text-amber-400 mx-auto mb-1" />
            <div className="text-xl font-semibold">{a.agingBuckets.gt3}</div>
            <div className="text-[10px] text-muted-foreground">parados &gt; 3 dias</div>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-center">
            <Clock className="h-4 w-4 text-orange-400 mx-auto mb-1" />
            <div className="text-xl font-semibold">{a.agingBuckets.gt7}</div>
            <div className="text-[10px] text-muted-foreground">parados &gt; 7 dias</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
            <AlertTriangle className="h-4 w-4 text-red-400 mx-auto mb-1" />
            <div className="text-xl font-semibold">{a.agingBuckets.gt15}</div>
            <div className="text-[10px] text-muted-foreground">parados &gt; 15 dias</div>
          </div>
        </div>

        {worstStage && worstStage.avgDaysInStage > 0 && (
          <div className="text-xs text-muted-foreground">
            Etapa com maior tempo médio parado: <span className="text-foreground font-medium">{worstStage.name}</span>
            {" "}({worstStage.avgDaysInStage.toFixed(1)} dias)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
