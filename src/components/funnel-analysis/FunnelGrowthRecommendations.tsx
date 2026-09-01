import { useMemo } from "react";
import { CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import type { FunnelMediaMetrics } from "@/lib/funnelMediaMetrics";

type Recommendation = { title: string; detail: string; tone: "warning" | "tip" | "ok" };

/** Recomendações transparentes: nunca presume custos/receitas que não vieram das fontes exibidas. */
export function FunnelGrowthRecommendations({ analytics, media }: { analytics: FunnelAnalytics; media: FunnelMediaMetrics }) {
  const recommendations = useMemo<Recommendation[]>(() => {
    const items: Recommendation[] = [];
    if (media.spend > 0 && media.sales === 0) items.push({ tone: "warning", title: "Aquisição sem venda confirmada", detail: `Há ${brl(media.spend)} investidos e nenhuma venda confirmada no período. Revise oferta, criativos e follow-up antes de aumentar o orçamento.` });
    else if (media.roas !== null && media.roas < 1) items.push({ tone: "warning", title: "ROAS abaixo do ponto de equilíbrio", detail: `O ROAS atual é ${media.roas.toFixed(2)}x. Reduza desperdícios e teste uma oferta de entrada antes de escalar.` });
    if (analytics.bottleneck) items.push({ tone: "tip", title: "Atue no gargalo antes de comprar mais tráfego", detail: `${analytics.bottleneck.from} → ${analytics.bottleneck.to} concentra a maior perda (${analytics.bottleneck.lossPct.toFixed(1)}%). Priorize script, SLA e follow-up nessa transição.` });
    if (analytics.agingBuckets.gt7 > 0) items.push({ tone: "tip", title: "Recupere leads parados", detail: `${analytics.agingBuckets.gt7} lead(s) estão há mais de 7 dias sem avanço. Crie uma sequência de reativação e acompanhe a taxa de resposta.` });
    if (analytics.totalLeads > 0 && analytics.conversions === 0) items.push({ tone: "warning", title: "Funil sem conversão no período", detail: "Não há venda registrada para os leads filtrados. Valide a oferta, o atendimento e a atribuição antes de concluir que a mídia é o problema." });
    if (!items.length) items.push({ tone: "ok", title: "Nenhum alerta de escala detectado", detail: "Os dados atuais não indicam um gargalo crítico. Continue monitorando ROAS, conversão e tempo parado antes de elevar investimento." });
    return items;
  }, [analytics, media]);

  return <Card className="gd-analysis-card border-border/60 bg-card/70"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-primary" />Dicas para reduzir custos e aumentar faturamento</CardTitle><p className="text-xs text-muted-foreground">Recomendações calculadas com o funil e a mídia selecionados. Dados financeiros detalhados (despesas, impostos e notas) não estão disponíveis nesta análise.</p></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{recommendations.map((item) => { const Icon = item.tone === "warning" ? TriangleAlert : item.tone === "ok" ? CheckCircle2 : Lightbulb; const color = item.tone === "warning" ? "text-amber-500" : item.tone === "ok" ? "text-emerald-500" : "text-primary"; return <div key={item.title} className="rounded-lg border border-border/50 bg-background/40 p-3"><div className="flex items-start gap-2"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} /><div><h3 className="text-xs font-bold">{item.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p></div></div></div>; })}</CardContent></Card>;
}

function brl(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value); }
