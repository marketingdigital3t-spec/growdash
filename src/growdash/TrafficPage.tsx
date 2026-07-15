/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Bot, CalendarRange, Check, ChevronRight, CircleAlert, Copy, GitBranch, Megaphone,
  MessageCircle, MousePointerClick, RefreshCw, Smartphone, Sparkles, Target,
  TrendingUp, UsersRound, Video, WalletCards, X, Zap,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useBudgetAnalysis, type BudgetAnalysisItem } from "@/hooks/useBudgetAnalysis";
import { useLastTopUp, useNextTopUpEstimate } from "@/hooks/useCampaignTargets";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { TrafficAIAnalysis } from "@/components/campaigns/TrafficAIAnalysis";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTrafficFunnelTemplates, trafficObjectives, type TrafficObjectiveId } from "@/lib/trafficFunnelTemplates";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const all = useBudgetAnalysis();
  const rows = all.filter((item) => visibleAccountIds.includes(item.id) && (accountId === "all" || item.id === accountId));
  const totals = rows.reduce((sum, item) => ({ budget: sum.budget + item.dailyBudgetActive, spend: sum.spend + item.avgDailySpend, balance: sum.balance + Number(item.balance || 0) }), { budget: 0, spend: 0, balance: 0 });
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["ad_accounts"] }), queryClient.invalidateQueries({ queryKey: ["daily_spend_by_account"] }), queryClient.invalidateQueries({ queryKey: ["daily_budget_active_by_account"] }), queryClient.invalidateQueries({ queryKey: ["last_top_up"] }), queryClient.invalidateQueries({ queryKey: ["next_top_up_estimate"] })]); toast({ title: "Orçamentos atualizados", description: "Os valores locais foram reconsultados; a data depende da última sincronização Meta." }); };
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Orçamento diário ativo" value={brl.format(totals.budget)} note="Soma dos conjuntos ativos" /><Kpi label="Gasto médio por dia" value={brl.format(totals.spend)} note="Média móvel dos últimos 7 dias" emphasis /><Kpi label="Saldo informado" value={brl.format(totals.balance)} note="Saldo consolidado das contas" /><Kpi label="Autonomia estimada" value={totals.spend > 0 ? `${Math.floor(totals.balance / totals.spend)} dias` : "Sem histórico"} note="Saldo ÷ gasto médio" /></div><section className="overflow-hidden rounded-xl border border-border bg-card"><header className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center"><div><h2 className="font-black">Análise de Orçamento por BM</h2><p className="text-xs text-muted-foreground">Ritmo, saldo, aportes, autonomia e risco de interrupção.</p></div><Button variant="outline" size="sm" className="sm:ml-auto" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Atualizar saldos</Button></header><div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-3">{rows.map((item) => <BudgetAccountCard key={item.id} item={item} />)}{rows.length === 0 && <Empty text="Nenhuma conta com orçamento ou saldo disponível." />}</div></section></div>;
}

function BudgetAccountCard({ item }: { item: BudgetAnalysisItem }) {
  const { data: lastTopUp } = useLastTopUp(item.id);
  const { data: nextTopUp } = useNextTopUpEstimate(item.id);
  const use = item.dailyBudgetActive > 0 ? Math.min(100, item.avgDailySpend / item.dailyBudgetActive * 100) : 0;
  const urgent = item.severity === "critical" && ((item.balance != null && item.balance <= 0) || (item.daysBalanceLasts != null && item.daysBalanceLasts <= 2));
  return <article className={cn("rounded-xl border bg-muted/15 p-4", item.severity === "critical" ? "border-red-500/35" : item.severity === "warning" ? "border-amber-500/35" : "border-emerald-500/25", urgent && "shadow-[0_0_26px_-12px_rgba(239,68,68,.8)]")}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{item.name}</h3><p className="mt-1 text-[10px] text-muted-foreground">{item.summary}</p></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-black uppercase", item.severity === "critical" ? "bg-red-500/10 text-red-500" : item.severity === "warning" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>{item.severity === "critical" ? "Crítico" : item.severity === "warning" ? "Atenção" : "Saudável"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><SmallMetric label="Orçamento diário (ativos)" value={brl.format(item.dailyBudgetActive)} /><SmallMetric label="Gasto médio/dia" value={brl.format(item.avgDailySpend)} /><SmallMetric label="Saldo restante" value={item.balance == null ? "Não informado" : brl.format(item.balance)} /><SmallMetric label="Saldo dura" value={item.daysBalanceLasts == null ? "Sem estimativa" : `${item.daysBalanceLasts} dia(s)`} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", use > 100 ? "bg-red-500" : use > 85 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(use, 100)}%` }} /></div><div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-[10px] text-muted-foreground"><p>⏱ Próxima recarga: {nextTopUp?.hasEnoughHistory && nextTopUp.estimatedDate ? <b className="text-foreground">~ {format(nextTopUp.estimatedDate, "dd/MM/yyyy")} · {brl.format(nextTopUp.avgAmount)}</b> : <i>histórico insuficiente</i>}</p><p>⊕ Último aporte: {lastTopUp ? <b className="text-foreground">{brl.format(Number(lastTopUp.delta))} em {format(new Date(lastTopUp.event_at), "dd/MM/yyyy")}</b> : <i>nenhum aporte registrado</i>}</p>{item.reasons.length > 0 && <p><CircleAlert className="mr-1 inline h-3.5 w-3.5" />{item.reasons[0]}</p>}</div></article>;
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
  const [saving, setSaving] = useState<string | null>(null);
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const { businessUnitId } = useGlobalFilters();
  const { toast } = useToast();
  const current = trafficObjectives.find((item) => item.id === objective)!;
  const templates = getTrafficFunnelTemplates(objective);

  const prefix: Record<TrafficObjectiveId, string> = {
    awareness: "AW", traffic: "TR", engagement: "EN", leads: "LD", app: "AP", sales: "SL",
  };

  async function selectTemplate(template: (typeof templates)[number]) {
    if (!workspace?.id || workspace.id.startsWith("legacy-") || !user?.id) {
      toast({ title: "Estrutura pronta para configurar", description: "Aplique as migrações do banco para salvar este playbook como rascunho." });
      return;
    }
    setSaving(template.id);
    try {
      const payload = {
        workspace_id: workspace.id,
        business_unit_id: businessUnitId?.startsWith("legacy-") ? null : businessUnitId || null,
        created_by: user.id,
        name: template.name.replace(/^\d+\.\s*/, ""),
        objective,
        template_key: template.id,
        status: "draft",
        config: {
          stages: template.stages,
          strategy: template.strategy,
          best_for: template.bestFor,
          primary_kpi: template.primaryKpi,
          guardrail: template.guardrail,
        },
      };
      const { data: existing, error: findError } = await (supabase as any)
        .from("traffic_playbooks")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("template_key", template.id)
        .in("status", ["draft", "active", "paused"])
        .maybeSingle();
      if (findError) throw findError;
      const request = existing?.id
        ? (supabase as any).from("traffic_playbooks").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", existing.id)
        : (supabase as any).from("traffic_playbooks").insert(payload);
      const { error } = await request;
      if (error) throw error;
      toast({ title: "Funil salvo como rascunho", description: "Revise público, orçamento, criativos e eventos antes de executar o playbook." });
    } catch (error: any) {
      const pending = /does not exist|schema cache|traffic_playbooks/i.test(error?.message || "");
      toast({ variant: "destructive", title: pending ? "Migração pendente" : "Não foi possível salvar", description: pending ? "Aplique a migração da biblioteca de playbooks no Supabase." : error?.message || "Tente novamente." });
    } finally {
      setSaving(null);
    }
  }

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><GitBranch className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Funis de tráfego</h2><p className="text-xs text-muted-foreground">10 funis prontos para cada objetivo do gerenciador de anúncios. Escolha o playbook de cada campanha.</p></div></div>
        <div className="growdash-scrollbar mt-5 flex gap-1 overflow-x-auto rounded-xl bg-muted/55 p-1" role="tablist" aria-label="Objetivos de campanha">
          {trafficObjectives.map((item) => <button key={item.id} role="tab" aria-selected={objective === item.id} onClick={() => setObjective(item.id)} className={cn("flex min-w-max items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition", objective === item.id ? "border border-primary/50 bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground")}><span>{item.label}</span><span className="grid h-5 min-w-5 place-items-center rounded-full border border-border bg-muted px-1 text-[9px]">10</span></button>)}
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="rounded-xl border border-primary/25 bg-primary/[0.035] px-4 py-3"><h3 className="font-black">{current.label}</h3><p className="mt-1 text-xs text-muted-foreground">{current.description} Otimização: <b className="text-foreground">{current.optimization}</b> · KPI: <b className="text-foreground">{current.primaryKpi}</b>.</p></div>
        {templates.map((template, templateIndex) => <article key={template.id} className="grid overflow-hidden rounded-2xl border border-border bg-muted/[0.08] xl:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="flex flex-col border-b border-border p-5 xl:border-b-0 xl:border-r">
            <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">{prefix[objective]}-{templateIndex + 1}</span>
            <h4 className="mt-3 text-lg font-black leading-tight">{template.name.replace(/^\d+\.\s*/, "")}</h4>
            <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground"><li>→ {template.bestFor}</li><li>→ {template.primaryKpi}</li><li>→ Rascunho seguro</li></ul>
            <Button variant="outline" size="sm" className="mt-5 w-full" disabled={saving === template.id} onClick={() => selectTemplate(template)}>{saving === template.id ? "Salvando…" : "Selecionar este funil"}</Button>
          </aside>
          <div className="growdash-scrollbar flex items-stretch gap-2 overflow-x-auto p-5">
            {template.stages.map((stage, index) => {
              const icons = [Video, UsersRound, Smartphone, Zap, Target, MessageCircle, MousePointerClick];
              const StageIcon = icons[index % icons.length];
              return <div key={`${template.id}-${stage}`} className="flex min-w-0 shrink-0 items-center gap-2">
                <div className="flex min-h-[145px] w-[205px] flex-col rounded-xl border border-border bg-background p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><StageIcon className="h-4 w-4" /></span>
                  <strong className="mt-3 text-sm leading-tight">{index + 1}. {stage}</strong>
                  <span className="mt-1 text-[9px] font-black uppercase tracking-[.08em] text-primary">{index === 0 ? "Aquisição" : index === template.stages.length - 1 ? current.outcome : "Progressão"}</span>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{index === 0 ? template.strategy : index === template.stages.length - 1 ? `Conclusão orientada a ${current.primaryKpi}.` : "Avance somente quem cumpriu o sinal de intenção desta etapa."}</p>
                </div>
                {index < template.stages.length - 1 && <ChevronRight className="h-5 w-5 shrink-0 text-primary" />}
              </div>;
            })}
          </div>
          <footer className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground xl:col-span-2"><CircleAlert className="mr-1 inline h-3.5 w-3.5 text-amber-500" /><b className="text-foreground">Regra de segurança:</b> {template.guardrail}</footer>
        </article>)}
      </div>
    </section>
  </div>;
}

function Kpi({ label, value, note, emphasis }: { label: string; value: string; note: string; emphasis?: boolean }) { return <article className={cn("rounded-xl border border-border bg-card p-4", emphasis && "border-primary/60 bg-primary/5")}><p className="text-[9px] font-black uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{note}</p></article>; }
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-background p-3"><span className="text-[9px] font-bold text-muted-foreground">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">{text}</div>; }
function Loading() { return <div className="grid min-h-[320px] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>; }
