import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { cn } from "@/lib/utils";

export function FunnelStageConversion({ a }: Props) {
  const data = a.stageConversion.map((s) => ({
    label: s.label,
    funnelName: s.funnelName,
    rate: Math.min(100, Math.max(0, Number(s.rate.toFixed(1)))),
    // Older stage-history rows may not contain lossPct. Keep the transition
    // visible instead of crashing the entire analysis screen.
    lossPct: Number((Number(s.lossPct) || 0).toFixed(1)),
    lost: Math.max(0, Math.round(s.lost || 0)),
    fromCount: Math.max(0, Math.round(s.fromCount || 0)),
    toCount: Math.max(0, Math.round(s.toCount || 0)),
    isBottleneck: s.isBottleneck && s.lost > 0,
  }));

  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">2. Taxa de avanço entre etapas</CardTitle>
        <p className="text-xs text-muted-foreground">
          {a.stageConversionMode === "history"
            ? "Transições reais do RD combinadas com o estágio atual de cada negócio para manter o denominador correto."
            : a.stageConversionMode === "estimated"
              ? "Estimativa calculada pela etapa atual de cada lead; o histórico do RD não está completo."
              : "Sem histórico ou sequência suficiente para calcular o avanço entre etapas."}
        </p>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem histórico de movimentações para calcular avanço entre etapas.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((d, i) => (
              <div key={`${d.funnelName}-${d.label}-${i}`} className="min-w-0 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5" title={d.label}>
                <div className="flex items-start justify-between gap-2 text-[11px]">
                  <div className="min-w-0">
                    <span className="mb-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">{d.funnelName}</span>
                    <span className="line-clamp-2 font-medium leading-snug text-muted-foreground">{d.label}</span>
                  </div>
                  <span className={cn("shrink-0 tabular-nums font-bold", d.isBottleneck ? "text-red-400" : "text-foreground")}>{d.rate}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", d.isBottleneck ? "bg-red-400" : "bg-emerald-500")} style={{ width: `${d.rate}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{d.toCount} de {d.fromCount} avançaram</span>
                  <span className={cn("tabular-nums", d.lost > 0 && "text-red-400")}>{d.lost > 0 ? `−${d.lost}` : "0"} parados</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Props { a: FunnelAnalytics }
