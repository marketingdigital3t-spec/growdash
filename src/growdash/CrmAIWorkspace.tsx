import { useMemo, useState, type ReactNode } from "react";
import { differenceInDays } from "date-fns";
import { AlertTriangle, Bot, ChartNoAxesCombined, CircleCheck, Clock3, Link2Off, MessageSquareText, ShieldCheck, Sparkles, TrendingUp, UserRoundCheck } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInsights } from "@/hooks/useInsights";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { Sale } from "@/hooks/useSales";
import { realizedSales } from "@/lib/saleRevenue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Props = { deals: RDDealLite[]; sales: Sale[]; accountId?: string };

export default function CrmAIWorkspace({ deals, sales, accountId }: Props) {
  const { startDate, endDate } = useGlobalFilters();
  // Sem uma conta específica, a IA deve analisar todas as contas liberadas ao
  // usuário — o seletor "Todas as contas" não pode transformar Meta em zero.
  const { data: insights = [] } = useInsights({ adAccountId: accountId, startDate, endDate, enabled: true });
  const [monitored, setMonitored] = useState(() => window.localStorage.getItem("growdash:crm-ai-monitored") === "true");
  const analytics = useMemo(() => analyze(deals, insights, sales), [deals, insights, sales]);

  function toggleMonitored() {
    const next = !monitored;
    setMonitored(next);
    window.localStorage.setItem("growdash:crm-ai-monitored", String(next));
  }

  return <div className="mt-4 space-y-4">
    <section className="gd-panel overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary"><Bot className="h-5 w-5" /></span><div><h2 className="font-black">IA do Funil</h2><p className="text-[10px] text-muted-foreground">Auditoria do RD, atribuição Meta e fila segura de correções do pipeline.</p></div></div>
        <Button className="sm:ml-auto" variant={monitored ? "default" : "outline"} onClick={toggleMonitored}><ShieldCheck className="mr-2 h-4 w-4" />{monitored ? "Monitoramento ativo" : "Ativar monitoramento"}</Button>
      </header>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
        <AIKpi label="Leads Meta" value={number.format(analytics.metaLeads)} note="resultado oficial armazenado" />
        <AIKpi label="Negócios RD" value={number.format(deals.length)} note="histórico da conta" />
        <AIKpi label="Diferença Meta × RD" value={`${analytics.coverage.toFixed(1)}%`} note={analytics.difference > 5 ? "acima da tolerância" : "dentro da tolerância"} alert={analytics.difference > 5} />
        <AIKpi label="UTMs incompletas" value={number.format(analytics.missingUtm.length)} note="negócios sem origem confiável" alert={analytics.missingUtm.length > 0} />
        <AIKpi label="Receita prevista" value={brl.format(analytics.forecast)} note="probabilidade por etapa" />
        <AIKpi label="Ações sugeridas" value={number.format(analytics.actions.length)} note="nenhuma mudança automática" emphasis />
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-2">
      <Panel icon={<ChartNoAxesCombined />} title="RD oficial × Growdash" description="A mesma conta e o mesmo período, sem misturar origens.">
        <div className="space-y-3"><CompareRow label="Meta Ads" value={`${number.format(analytics.metaLeads)} leads`} progress={100} /><CompareRow label="RD Station" value={`${number.format(deals.length)} negócios`} progress={analytics.metaLeads ? Math.min(100, deals.length / analytics.metaLeads * 100) : 0} /><div className={cn("rounded-xl border p-3 text-xs", analytics.difference > 5 ? "border-red-500/30 bg-red-500/7 text-red-500" : "border-emerald-500/25 bg-emerald-500/7 text-emerald-500")}>{analytics.difference > 5 ? `A divergência de ${analytics.difference.toFixed(1)}% supera a tolerância de 5%. Revise UTMs, atribuição e janela de datas.` : "A cobertura está dentro da tolerância configurada."}</div></div>
      </Panel>
      <Panel icon={<TrendingUp />} title="Previsão por etapa" description="Receita ponderada pela probabilidade de avanço de cada estágio.">
        <div className="space-y-2">{analytics.stages.slice(0, 8).map((stage) => <div key={stage.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"><span className="truncate font-bold">{stage.name}</span><span className="text-muted-foreground">{number.format(stage.count)} · {Math.round(stage.probability * 100)}%</span><b>{brl.format(stage.weighted)}</b></div>)}{!analytics.stages.length && <Empty text="As etapas aparecerão após a primeira sincronização do RD." />}</div>
      </Panel>
      <Panel icon={<UserRoundCheck />} title="Ranking de responsáveis" description="Conversão, receita e velocidade de atendimento.">
        <div className="space-y-2">{analytics.owners.slice(0, 10).map((owner, index) => <div key={owner.name} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border p-2 text-xs"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 font-black text-primary">{index + 1}</span><span className="min-w-0"><b className="block truncate">{owner.name}</b><small className="text-muted-foreground">{owner.won}/{owner.total} ganhos · {owner.avgDays.toFixed(1)}d médios</small></span><b>{brl.format(owner.revenue)}</b></div>)}{!analytics.owners.length && <Empty text="Nenhum responsável identificado no histórico." />}</div>
      </Panel>
      <Panel icon={<Sparkles />} title="Assistente de gargalos" description="Ações concretas priorizadas por risco e impacto.">
        <div className="space-y-2">{analytics.actions.map((action) => <div key={action.id} className="flex gap-3 rounded-xl border border-border bg-muted/20 p-3"><span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", action.critical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500")}>{action.icon}</span><span className="min-w-0"><b className="text-xs">{action.title}</b><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{action.description}</p></span></div>)}{!analytics.actions.length && <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-xs text-emerald-500"><CircleCheck className="h-5 w-5" />Nenhum gargalo crítico detectado.</div>}</div>
      </Panel>
    </div>

    <section className="gd-panel overflow-hidden">
      <header className="border-b border-border p-4"><h2 className="font-black">Fila monitorada de organização do RD</h2><p className="text-[10px] text-muted-foreground">Negócios possivelmente parados ou com etapa incompatível. A Growdash não altera dados reais sem uma ação aprovada e auditável.</p></header>
      <div className="divide-y divide-border">{analytics.stale.slice(0, 25).map((deal) => <div key={deal.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><b className="block truncate text-sm">{deal.contact_name || deal.contact_email || "Contato sem identificação"}</b><p className="mt-1 text-[10px] text-muted-foreground">{deal.rd_stage_name || "Sem etapa"} · parado há {deal.staleDays} dia(s) · responsável: {deal.deal_owner_name || "não informado"}</p></div><Button size="sm" variant="outline" disabled title="A alteração exige um endpoint auditável de atualização no RD Station.">Revisar antes de mover</Button></div>)}{!analytics.stale.length && <Empty text="Nenhuma negociação parada acima do limite de 7 dias." />}</div>
    </section>
  </div>;
}

function analyze(deals: RDDealLite[], insights: Array<{ leads?: number | null }>, sales: Sale[]) {
  const metaLeads = insights.reduce((sum, row) => sum + Number(row.leads || 0), 0);
  const coverage = metaLeads ? deals.length / metaLeads * 100 : deals.length ? 100 : 0;
  const difference = metaLeads ? Math.abs(deals.length - metaLeads) / metaLeads * 100 : deals.length ? 100 : 0;
  const missingUtm = deals.filter((deal) => !deal.utm_source || !deal.utm_campaign);
  const stagesMap = new Map<string, { count: number; total: number; order: number }>();
  deals.forEach((deal) => { const name = deal.rd_stage_name || "Sem etapa"; const row = stagesMap.get(name) || { count: 0, total: 0, order: deal.rd_stage_order ?? 999 }; row.count += 1; row.total += Number(deal.amount_total || 0); stagesMap.set(name, row); });
  const sortedStages = Array.from(stagesMap, ([name, row]) => ({ name, ...row })).sort((a, b) => a.order - b.order);
  const denominator = Math.max(1, sortedStages.length - 1);
  const stages = sortedStages.map((stage, index) => { const probability = Math.min(.95, Math.max(.08, index / denominator)); return { ...stage, probability, weighted: stage.total * probability }; });
  const forecast = stages.reduce((sum, stage) => sum + stage.weighted, 0);
  const visibleDealIds = new Set(deals.map((deal) => deal.rd_deal_id));
  const salesByDeal = new Map(
    realizedSales(sales)
      .filter((sale) => sale.rd_deal_id && visibleDealIds.has(sale.rd_deal_id))
      .map((sale) => [sale.rd_deal_id as string, sale]),
  );
  const ownersMap = new Map<string, { total: number; won: number; revenue: number; days: number[] }>();
  deals.forEach((deal) => { const name = deal.deal_owner_name || "Sem responsável"; const row = ownersMap.get(name) || { total: 0, won: 0, revenue: 0, days: [] }; const sale = salesByDeal.get(deal.rd_deal_id); row.total += 1; row.won += sale ? 1 : 0; row.revenue += sale ? Number(sale.net_revenue || 0) : 0; if (deal.lead_created_at && deal.stage_updated_at) row.days.push(Math.max(0, differenceInDays(new Date(deal.stage_updated_at), new Date(deal.lead_created_at)))); ownersMap.set(name, row); });
  const owners = Array.from(ownersMap, ([name, row]) => ({ name, ...row, avgDays: row.days.length ? row.days.reduce((a, b) => a + b, 0) / row.days.length : 0 })).sort((a, b) => b.revenue - a.revenue || b.won - a.won);
  const now = new Date();
  const stale = deals.map((deal) => ({ ...deal, staleDays: deal.stage_updated_at ? Math.max(0, differenceInDays(now, new Date(deal.stage_updated_at))) : 999 })).filter((deal) => !deal.win && deal.stage_bucket !== "lost" && deal.staleDays >= 7).sort((a, b) => b.staleDays - a.staleDays);
  const actions: Array<{ id: string; title: string; description: string; critical: boolean; icon: ReactNode }> = [];
  if (difference > 5) actions.push({ id: "reconcile", title: "Reconciliar Meta × RD", description: `A diferença é de ${difference.toFixed(1)}%. Compare data da conta, atribuição e formulários antes de otimizar campanhas.`, critical: true, icon: <AlertTriangle className="h-4 w-4" /> });
  if (missingUtm.length) actions.push({ id: "utm", title: "Corrigir atribuição por UTM", description: `${missingUtm.length} negócio(s) não possuem origem e campanha completas.`, critical: missingUtm.length / Math.max(1, deals.length) > .1, icon: <Link2Off className="h-4 w-4" /> });
  if (stale.length) actions.push({ id: "stale", title: "Revisar negociações paradas", description: `${stale.length} negócio(s) estão há pelo menos 7 dias sem movimentação.`, critical: stale.some((deal) => deal.staleDays >= 15), icon: <Clock3 className="h-4 w-4" /> });
  if (!deals.some((deal) => deal.deal_owner_name)) actions.push({ id: "owner", title: "Definir responsáveis", description: "Os negócios não possuem responsável suficiente para medir tempo de atendimento e conversão.", critical: false, icon: <MessageSquareText className="h-4 w-4" /> });
  return { metaLeads, coverage, difference, missingUtm, stages, forecast, owners, stale, actions };
}

function Panel({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) { return <section className="gd-panel overflow-hidden"><header className="flex items-center gap-3 border-b border-border p-4"><span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span><div><h2 className="text-sm font-black">{title}</h2><p className="text-[10px] text-muted-foreground">{description}</p></div></header><div className="p-4">{children}</div></section>; }
function AIKpi({ label, value, note, alert, emphasis }: { label: string; value: string; note: string; alert?: boolean; emphasis?: boolean }) { return <article className={cn("rounded-xl border bg-muted/15 p-4", alert ? "border-red-500/35" : emphasis ? "border-primary/45 bg-primary/5" : "border-border")}><span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</span><b className={cn("mt-2 block text-xl", alert && "text-red-500")}>{value}</b><small className="mt-1 block text-[9px] text-muted-foreground">{note}</small></article>; }
function CompareRow({ label, value, progress }: { label: string; value: string; progress: number }) { return <div><div className="mb-1 flex items-center justify-between text-xs"><b>{label}</b><span>{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div></div>; }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-xs text-muted-foreground">{text}</div>; }
