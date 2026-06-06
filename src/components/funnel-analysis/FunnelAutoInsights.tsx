import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, MapPin, Clock, AlertTriangle, Trophy } from "lucide-react";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelAutoInsights({ a }: { a: FunnelAnalytics }) {
  const insights: { icon: any; color: string; text: string }[] = [];

  // Melhor origem por conversão (com volume mínimo)
  const bestSource = [...a.sourceBreakdown]
    .filter((s) => s.leads >= 5)
    .sort((x, y) => y.conversionRate - x.conversionRate)[0];
  if (bestSource) {
    insights.push({
      icon: Trophy,
      color: "text-emerald-400",
      text: `A origem "${bestSource.source}" converte ${bestSource.conversionRate.toFixed(1)}% — sua melhor performance.`,
    });
  }

  // Origem com mais volume vs melhor conversão
  const mostVolume = [...a.sourceBreakdown].sort((x, y) => y.leads - x.leads)[0];
  if (mostVolume && bestSource && mostVolume.source !== bestSource.source) {
    insights.push({
      icon: TrendingUp,
      color: "text-cyan-400",
      text: `${mostVolume.source} gera mais volume, mas ${bestSource.source} tem melhor taxa de conversão.`,
    });
  }

  // Gargalo
  if (a.bottleneck) {
    insights.push({
      icon: AlertTriangle,
      color: "text-red-400",
      text: `Maior gargalo: ${a.bottleneck.from} → ${a.bottleneck.to} (perda de ${a.bottleneck.lossPct.toFixed(1)}%).`,
    });
  }

  // Estado líder
  const topState = a.stateBreakdown.filter((s) => s.state !== "—")[0];
  if (topState) {
    insights.push({
      icon: MapPin,
      color: "text-blue-400",
      text: `${topState.state} lidera em volume com ${topState.leads} leads e ${topState.conversions} conversões.`,
    });
  }

  // Etapa lenta
  const slowest = [...a.stages].filter((s) => !s.is_lost && !s.is_won).sort((x, y) => y.avgDaysInStage - x.avgDaysInStage)[0];
  if (slowest && slowest.avgDaysInStage > 5) {
    insights.push({
      icon: Clock,
      color: "text-amber-400",
      text: `A etapa "${slowest.name}" tem alto tempo médio parado (${slowest.avgDaysInStage.toFixed(1)} dias).`,
    });
  }

  // Aging risco
  if (a.agingBuckets.gt7 > 0) {
    insights.push({
      icon: AlertTriangle,
      color: "text-orange-400",
      text: `${a.agingBuckets.gt7} leads parados há mais de 7 dias — risco de perda comercial.`,
    });
  }

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          8. Insights automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Sem dados suficientes para gerar insights.</div>
        ) : (
          insights.map((i, idx) => {
            const Icon = i.icon;
            return (
              <div key={idx} className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/40 p-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${i.color}`} />
                <span className="text-xs leading-relaxed">{i.text}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
