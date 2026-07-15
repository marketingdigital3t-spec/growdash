import { lazy, Suspense, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bot, CalendarRange, Check, ChevronRight, CircleAlert, Copy, GitBranch, Megaphone,
  RefreshCw, Sparkles, Target, TrendingUp, WalletCards, X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { TrafficAIAnalysis } from "@/components/campaigns/TrafficAIAnalysis";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTrafficFunnelTemplates, trafficObjectives, type TrafficObjectiveId } from "@/lib/trafficFunnelTemplates";
import { useToast } from "@/hooks/use-toast";

const CampaignsManager = lazy(() => import("@/pages/Campaigns"));
const validTabs = new Set(["campaigns", "budget", "ai", "funnels"]);
const tabs = [
  { id: "campaigns", label: "Campanhas", icon: Megaphone },
  { id: "budget", label: "Orçamento (BM)", icon: WalletCards },
  { id: "ai", label: "IA & Relatórios de Leads", icon: Bot },
  { id: "funnels", label: "Funis de Tráfego", icon: GitBranch },
] as const;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export default function TrafficPage() {
  const [params, setParams] = useSearchParams();
  const activeTab = validTabs.has(params.get("aba") || "") ? params.get("aba")! : "campaigns";
  const [heroVisible, setHeroVisible] = useState(true);
  const { adAccountId, setAdAccountId, startDate, endDate, businessUnitId, segment } = useGlobalFilters();
  const { data: accounts = [] } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId
    ? accounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : accounts, [accounts, businessUnitId, segment]);
  const account = visibleAccounts.find((item) => item.id === adAccountId);

  return (
    <div className="mx-auto max-w-[1700px] space-y-3">
      {heroVisible && <WelcomeHero onClose={() => setHeroVisible(false)} />}
      <nav className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/70 p-1 lg:grid-cols-4" aria-label="Áreas de Tráfego Pago">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setParams({ aba: id })} className={cn("flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-[11px] font-black transition", activeTab === id ? "bg-gradient-to-r from-[#bb8211] via-[#f1c94c] to-[#b97b08] text-[#2f2308] shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground")}><Icon className="h-4 w-4" />{label}</button>)}
      </nav>

      {activeTab !== "campaigns" && <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <span className="text-[10px] font-black uppercase tracking-[.14em] text-primary">Conta de anúncio</span>
        <Select value={adAccountId} onValueChange={setAdAccountId}><SelectTrigger className="h-9 w-full bg-background sm:max-w-md"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas da unidade</SelectItem>{visibleAccounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-600"><Check className="h-3 w-3" />Dados sincronizados</span>
        <span className="text-[10px] text-muted-foreground sm:ml-auto"><CalendarRange className="mr-1 inline h-3.5 w-3.5" />{format(startDate, "dd/MM/yyyy")}–{format(endDate, "dd/MM/yyyy")}</span>
      </section>}

      {activeTab === "campaigns" && <Suspense fallback={<Loading />}><CampaignsManager /></Suspense>}
      {activeTab === "budget" && <BudgetWorkspace accountId={adAccountId} visibleAccountIds={visibleAccounts.map((item) => item.id)} />}
      {activeTab === "ai" && <AIAndLeadReports accountId={adAccountId} accountName={account?.name} />}
      {activeTab === "funnels" && <TrafficFunnels />}
    </div>
  );
}

function WelcomeHero({ onClose }: { onClose: () => void }) {
  return <section className="relative overflow-hidden rounded-xl border border-[#6f551c] bg-[#0f0d09] px-5 py-6 text-center text-[#f8db84] shadow-[inset_0_0_80px_rgba(205,148,28,.14)] sm:px-10 sm:py-8"><div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_16%_12%,rgba(245,203,91,.38),transparent_20%),radial-gradient(circle_at_84%_80%,rgba(236,178,48,.27),transparent_22%),linear-gradient(115deg,transparent_0_28%,rgba(197,139,31,.18)_40%,transparent_55%)]" /><div className="relative mx-auto flex max-w-5xl items-center justify-center gap-4"><TrendingUp className="hidden h-12 w-12 text-[#e2b447] sm:block" strokeWidth={1.3} /><div><h1 className="font-serif text-3xl font-semibold tracking-tight text-[#f5dc91] sm:text-5xl">Central de Tráfego Pago</h1><p className="mt-2 font-serif text-sm text-[#dbc48a] sm:text-xl">Campanhas, orçamento, inteligência e funis em uma única operação</p></div></div><button onClick={onClose} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#4b4339]" aria-label="Fechar boas-vindas"><X className="h-4 w-4" /></button></section>;
}

function BudgetWorkspace({ accountId, visibleAccountIds }: { accountId: string; visibleAccountIds: string[] }) {
  const all = useBudgetAnalysis();
  const rows = all.filter((item) => visibleAccountIds.includes(item.id) && (accountId === "all" || item.id === accountId));
  const totals = rows.reduce((sum, item) => ({ budget: sum.budget + item.dailyBudgetActive, spend: sum.spend + item.avgDailySpend, balance: sum.balance + Number(item.balance || 0) }), { budget: 0, spend: 0, balance: 0 });
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Orçamento diário ativo" value={brl.format(totals.budget)} note="Soma dos conjuntos ativos" /><Kpi label="Gasto médio por dia" value={brl.format(totals.spend)} note="Média móvel dos últimos 7 dias" emphasis /><Kpi label="Saldo informado" value={brl.format(totals.balance)} note="Saldo consolidado das contas" /><Kpi label="Autonomia estimada" value={totals.spend > 0 ? `${Math.floor(totals.balance / totals.spend)} dias` : "Sem histórico"} note="Saldo ÷ gasto médio" /></div><section className="overflow-hidden rounded-xl border border-border bg-card"><header className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center"><div><h2 className="font-black">Orçamento por BM e conta</h2><p className="text-xs text-muted-foreground">Ritmo, saldo, autonomia e risco de interrupção.</p></div><Button variant="outline" size="sm" className="sm:ml-auto"><RefreshCw className="mr-2 h-4 w-4" />Atualizar saldos</Button></header><div className="grid gap-3 p-4 lg:grid-cols-2">{rows.map((item) => { const use = item.dailyBudgetActive > 0 ? Math.min(100, item.avgDailySpend / item.dailyBudgetActive * 100) : 0; return <article key={item.id} className="rounded-xl border border-border bg-muted/15 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{item.name}</h3><p className="mt-1 text-[10px] text-muted-foreground">{item.summary}</p></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-black uppercase", item.severity === "critical" ? "bg-red-500/10 text-red-500" : item.severity === "warning" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>{item.severity === "critical" ? "Crítico" : item.severity === "warning" ? "Atenção" : "Saudável"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><SmallMetric label="Orçamento ativo" value={brl.format(item.dailyBudgetActive)} /><SmallMetric label="Média diária" value={brl.format(item.avgDailySpend)} /><SmallMetric label="Saldo" value={item.balance == null ? "Não informado" : brl.format(item.balance)} /><SmallMetric label="Autonomia" value={item.daysBalanceLasts == null ? "Sem estimativa" : `${item.daysBalanceLasts} dias`} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", use > 100 ? "bg-red-500" : use > 85 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(use, 100)}%` }} /></div>{item.reasons.length > 0 && <p className="mt-3 text-[10px] text-muted-foreground"><CircleAlert className="mr-1 inline h-3.5 w-3.5" />{item.reasons[0]}</p>}</article>; })}{rows.length === 0 && <Empty text="Nenhuma conta com orçamento ou saldo disponível." />}</div></section></div>;
}

function AIAndLeadReports({ accountId, accountName }: { accountId: string; accountName?: string }) {
  const { startDate, endDate } = useGlobalFilters();
  const single = accountId !== "all" ? accountId : undefined;
  const { data: insights = [], isLoading: loadingMeta } = useInsights({ adAccountId: single, startDate, endDate, enabled: !!single });
  const { data: deals = [], isLoading: loadingRD } = useRDDealsForPeriod({ startDate, endDate, adAccountId: single, enabled: !!single });
  const { toast } = useToast();
  const metaLeads = insights.reduce((sum, item) => sum + Number(item.leads || 0), 0);
  const spend = insights.reduce((sum, item) => sum + Number(item.spend || 0), 0);
  const won = deals.filter((deal) => deal.win).length;
  const revenue = deals.filter((deal) => deal.win).reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0);
  const byCampaign = useMemo(() => { const map = new Map<string, { leads: number; spend: number }>(); for (const item of insights) { const name = item.campaign_name || "Sem campanha"; const row = map.get(name) || { leads: 0, spend: 0 }; row.leads += Number(item.leads || 0); row.spend += Number(item.spend || 0); map.set(name, row); } return Array.from(map, ([name, value]) => ({ name, ...value })).sort((a, b) => b.leads - a.leads); }, [insights]);
  const copyReport = async () => { const report = `Relatório de leads — ${accountName || "Conta"}\nPeríodo: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}\nMeta Ads: ${integer.format(metaLeads)} leads | ${brl.format(spend)} investidos | CPL ${brl.format(metaLeads ? spend / metaLeads : 0)}\nRD Station: ${integer.format(deals.length)} negócios | ${won} vendas | ${brl.format(revenue)} em receita`; await navigator.clipboard.writeText(report); toast({ title: "Relatório copiado" }); };
  return <div className="space-y-4"><TrafficAIAnalysis accountId={accountId} accountName={accountName} startDate={startDate} endDate={endDate} selectedCampaignIds={[]} />{!single ? <Empty text="Selecione uma conta específica para cruzar Meta Ads e RD Station sem misturar origens." /> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Leads Meta Ads" value={loadingMeta ? "Carregando…" : integer.format(metaLeads)} note="Insights do período" /><Kpi label="Investimento" value={brl.format(spend)} note="Meta Ads" /><Kpi label="CPL Meta" value={brl.format(metaLeads ? spend / metaLeads : 0)} note="Investimento ÷ leads" emphasis /><Kpi label="Negócios RD" value={loadingRD ? "Carregando…" : integer.format(deals.length)} note={`${won} venda(s) ganha(s)`} /><Kpi label="Receita RD" value={brl.format(revenue)} note={spend > 0 ? `ROAS atribuído ${(revenue / spend).toFixed(2)}x` : "Sem gasto atribuído"} /></div><section className="overflow-hidden rounded-xl border border-border bg-card"><header className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center"><div><h2 className="font-black">Relatório de leads por campanha</h2><p className="text-xs text-muted-foreground">Meta Ads no período selecionado; negócios e vendas vêm do RD Station.</p></div><Button variant="outline" size="sm" onClick={copyReport} className="sm:ml-auto"><Copy className="mr-2 h-4 w-4" />Copiar relatório diário</Button></header><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-4 py-3">Campanha</th><th className="px-4 py-3 text-right">Investimento</th><th className="px-4 py-3 text-right">Leads Meta</th><th className="px-4 py-3 text-right">CPL</th></tr></thead><tbody>{byCampaign.map((row) => <tr key={row.name} className="border-t border-border"><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3 text-right">{brl.format(row.spend)}</td><td className="px-4 py-3 text-right">{integer.format(row.leads)}</td><td className="px-4 py-3 text-right">{brl.format(row.leads ? row.spend / row.leads : 0)}</td></tr>)}</tbody></table></div></section></>}</div>;
}

function TrafficFunnels() {
  const [objective, setObjective] = useState<TrafficObjectiveId>("leads");
  const [expanded, setExpanded] = useState<string | null>(null);
  const current = trafficObjectives.find((item) => item.id === objective)!;
  const templates = getTrafficFunnelTemplates(objective);
  return <div className="space-y-4"><section className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><GitBranch className="h-5 w-5" /></span><div><h2 className="font-black">Biblioteca de Funis de Tráfego</h2><p className="text-xs text-muted-foreground">60 estruturas: 10 modelos para cada objetivo de campanha da Meta.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{trafficObjectives.map((item) => <button key={item.id} onClick={() => { setObjective(item.id); setExpanded(null); }} className={cn("rounded-xl border p-3 text-left transition", objective === item.id ? "border-primary bg-primary/10" : "border-border bg-muted/15 hover:bg-muted/40")}><span className="text-[11px] font-black">{item.label}</span><span className="mt-1 block text-[9px] text-muted-foreground">10 modelos</span></button>)}</div></section><section className="rounded-xl border border-border bg-card p-4"><header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-primary">Objetivo selecionado</span><h3 className="text-xl font-black">{current.label}</h3><p className="text-xs text-muted-foreground">{current.description} KPI principal: {current.primaryKpi}.</p></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-black text-primary sm:ml-auto">10 funis prontos</span></header><div className="grid gap-3 lg:grid-cols-2">{templates.map((template) => <article key={template.id} className="overflow-hidden rounded-xl border border-border bg-muted/10"><button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setExpanded(expanded === template.id ? null : template.id)}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1d1b17] text-[#f2c94c]"><Target className="h-4 w-4" /></span><span className="min-w-0 grow"><strong className="block text-sm">{template.name}</strong><span className="block truncate text-[10px] text-muted-foreground">{template.bestFor}</span></span><ChevronRight className={cn("h-4 w-4 transition", expanded === template.id && "rotate-90")} /></button>{expanded === template.id && <div className="border-t border-border p-4"><p className="text-xs text-muted-foreground">{template.strategy}</p><div className="growdash-scrollbar mt-4 flex items-center gap-1 overflow-x-auto pb-2">{template.stages.map((stage, index) => <div key={`${template.id}-${stage}`} className="flex shrink-0 items-center gap-1"><span className="rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-bold">{stage}</span>{index < template.stages.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-primary" />}</div>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><SmallMetric label="KPI principal" value={template.primaryKpi} /><SmallMetric label="Regra de segurança" value={template.guardrail} /></div></div>}</article>)}</div></section></div>;
}

function Kpi({ label, value, note, emphasis }: { label: string; value: string; note: string; emphasis?: boolean }) { return <article className={cn("rounded-xl border border-border bg-card p-4", emphasis && "border-primary/60 bg-primary/5")}><p className="text-[9px] font-black uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{note}</p></article>; }
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-background p-3"><span className="text-[9px] font-bold text-muted-foreground">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">{text}</div>; }
function Loading() { return <div className="grid min-h-[320px] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>; }
