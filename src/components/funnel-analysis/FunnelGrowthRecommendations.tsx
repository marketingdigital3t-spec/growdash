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
    if (media.spend > 0 && media.sales === 0) {
      items.push({ tone: "warning", title: "Pare a escala até validar a conversão", detail: `${brl(media.spend)} foram investidos sem venda confirmada no período. Revise primeiro a oferta, o criativo e o follow-up; aumentar orçamento agora não tem evidência de retorno.` });
    } else if (media.roas !== null && media.roas < 1) {
      items.push({ tone: "warning", title: "ROAS abaixo da recuperação do investimento", detail: `O ROAS registrado é ${media.roas.toFixed(2)}x. Reduza a verba nas campanhas selecionadas e corrija o gargalo comercial antes de ampliar alcance.` });
    }
    if (media.spend > 0 && media.metaLeads === 0) {
      items.push({ tone: "warning", title: "Mídia sem aquisição registrada", detail: `Há ${brl(media.spend)} de investimento, mas nenhum lead de formulário ou conversa iniciada foi reportado pela Meta neste recorte. Verifique objetivo, período e integração antes de otimizar o criativo.` });
    } else if (media.metaLeads > 0 && media.rdCoverage !== null && media.rdCoverage < 80) {
      items.push({ tone: "warning", title: "Cobertura RD abaixo do esperado", detail: `A Meta reporta ${media.metaLeads} aquisição(ões), e o RD contém ${analytics.totalLeads} lead(s) no mesmo recorte (${media.rdCoverage.toFixed(0)}% de cobertura). Corrija UTMs e a entrada no RD antes de usar CPL/CAC para escala.` });
    }
    if (analytics.bottleneck && analytics.bottleneck.lossPct > 0) {
      items.push({ tone: "tip", title: "Ataque o gargalo antes de comprar mais tráfego", detail: `${analytics.bottleneck.from} → ${analytics.bottleneck.to} tem a maior perda estimada (${analytics.bottleneck.lossPct.toFixed(1)}%). Defina responsável, SLA de resposta e cadência de follow-up para essa passagem.` });
    }
    if (analytics.agingBuckets.gt7 > 0) {
      items.push({ tone: "tip", title: "Recupere leads antes de gerar novos custos", detail: `${analytics.agingBuckets.gt7} lead(s) estão parados há mais de 7 dias. Faça uma lista de reativação e meça resposta, oportunidade e venda antes de abrir nova campanha.` });
    }
    if (analytics.totalLeads > 0 && analytics.conversions === 0) {
      items.push({ tone: "warning", title: "Funil sem venda confirmada", detail: "Há leads no período, mas nenhuma venda canônica confirmada. Valide atendimento e registro do fechamento no RD; só depois conclua que o problema é a mídia." });
    }
    if (media.spend > 0 && media.cac !== null && analytics.avgTicket > 0) {
      const ratio = media.cac / analytics.avgTicket;
      items.push({ tone: ratio > 1 ? "warning" : "tip", title: "Compare CAC de mídia com o ticket confirmado", detail: `CAC de mídia: ${brl(media.cac)}; ticket médio confirmado: ${brl(analytics.avgTicket)}. Esta leitura não inclui impostos, reembolsos, equipe ou custos operacionais, portanto não equivale à margem.` });
    }
    if (!items.length) items.push({ tone: "ok", title: "Sem sinal crítico neste recorte", detail: "Os dados carregados não apontam perda urgente. Continue acompanhando conversão, cobertura Meta → RD e tempo parado antes de aumentar o investimento." });
    return items;
  }, [analytics, media]);

  return <Card className="gd-analysis-card border-border/60 bg-card/70"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-primary" />Dicas para reduzir custos e aumentar faturamento</CardTitle><p className="text-xs text-muted-foreground">Prioridades calculadas apenas com funil, vendas confirmadas e mídia do recorte selecionado. Margem líquida, impostos, notas, reembolsos e custos operacionais não têm fonte estruturada aqui.</p></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{recommendations.map((item) => { const Icon = item.tone === "warning" ? TriangleAlert : item.tone === "ok" ? CheckCircle2 : Lightbulb; const color = item.tone === "warning" ? "text-amber-500" : item.tone === "ok" ? "text-emerald-500" : "text-primary"; return <div key={item.title} className="rounded-lg border border-border/50 bg-background/40 p-3"><div className="flex items-start gap-2"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} /><div><h3 className="text-xs font-bold">{item.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p></div></div></div>; })}</CardContent></Card>;
}

function brl(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value); }
