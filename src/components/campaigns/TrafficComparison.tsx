import { useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, CircleAlert, Database, GitCompareArrows, RefreshCw, ShoppingBag, Sparkles, TrendingUp, UsersRound } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useSales } from "@/hooks/useSales";
import { cn } from "@/lib/utils";
import { aggregateTrafficComparison, percentDelta, resolveComparisonPeriod, type TrafficComparisonSnapshot } from "@/lib/trafficComparison";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

type SourceState = "loading" | "ready" | "partial" | "empty" | "error";

function formatPeriod(start: Date, end: Date) {
  return `${start.toLocaleDateString("pt-BR")} – ${end.toLocaleDateString("pt-BR")}`;
}

function metricValue(snapshot: TrafficComparisonSnapshot, id: string) {
  if (id === "cpl") return snapshot.leads > 0 ? snapshot.spend / snapshot.leads : null;
  if (id === "cac") return snapshot.sales > 0 ? snapshot.spend / snapshot.sales : null;
  if (id === "roas") return snapshot.spend > 0 ? snapshot.revenue / snapshot.spend : null;
  return Number(snapshot[id as keyof TrafficComparisonSnapshot] || 0);
}

function formatDelta(delta: number | null) {
  return delta == null ? null : `${Math.abs(delta).toFixed(1).replace(".", ",")}%`;
}

type ExecutiveAction = {
  title: string;
  detail: string;
  tone: "critical" | "focus" | "growth";
};

function buildExecutiveActions(current: TrafficComparisonSnapshot, previous: TrafficComparisonSnapshot): ExecutiveAction[] {
  const actions: ExecutiveAction[] = [];
  const spendDelta = percentDelta(current.spend, previous.spend);
  const leadsDelta = percentDelta(current.leads, previous.leads);
  const currentCpl = current.leads > 0 ? current.spend / current.leads : null;
  const previousCpl = previous.leads > 0 ? previous.spend / previous.leads : null;
  const profit = current.revenue - current.spend;

  if (profit < 0) {
    actions.push({
      title: "Reduzir campanhas com prejuízo",
      detail: `O período gastou ${currency.format(Math.abs(profit))} a mais do que gerou em receita. Corte verba sem venda e preserve o caixa.`,
      tone: "critical",
    });
  }

  if (spendDelta != null && spendDelta > 0 && leadsDelta != null && leadsDelta < 0) {
    actions.push({
      title: "Redistribuir verba para campanhas eficientes",
      detail: `O investimento subiu ${formatDelta(spendDelta)} enquanto os leads caíram ${formatDelta(leadsDelta)}. Mova orçamento para campanhas com resultado comprovado.`,
      tone: "critical",
    });
  }

  if (currentCpl != null && previousCpl != null && currentCpl > previousCpl) {
    actions.push({
      title: "Corrigir o CPL alto",
      detail: `O custo por lead chegou a ${currency.format(currentCpl)}. Revise criativo, público e posicionamento antes de ampliar investimento.`,
      tone: "focus",
    });
  }

  if (current.leads > current.sales && current.leads > 0) {
    actions.push({
      title: "Recuperar leads sem venda",
      detail: `${number.format(current.leads - current.sales)} oportunidades ainda não viraram venda confirmada. Priorize follow-up comercial para gerar caixa.`,
      tone: "focus",
    });
  }

  if (profit >= 0 && current.revenue > 0 && current.sales > 0) {
    actions.push({
      title: "Aumentar investimento no que já vende",
      detail: `Há ${currency.format(current.revenue)} em receita confirmada. Escale gradualmente as campanhas com ROAS positivo e acompanhe o custo por venda.`,
      tone: "growth",
    });
  }

  if (actions.length === 0) {
    actions.push({
      title: "Conectar mídia a vendas confirmadas",
      detail: "Priorize campanhas que geram leads e acompanhe o fechamento no RD para decidir onde colocar o próximo real.",
      tone: "focus",
    });
  }

  return actions.slice(0, 4);
}

function MetricCard({ label, id, current, previous, formatValue, source, icon: Icon }: { label: string; id: string; current: TrafficComparisonSnapshot; previous: TrafficComparisonSnapshot; formatValue: (value: number | null) => string; source: string; icon: typeof BarChart3 }) {
  const currentValue = metricValue(current, id);
  const previousValue = metricValue(previous, id);
  const delta = currentValue != null && previousValue != null ? percentDelta(currentValue, previousValue) : null;
  const improved = delta != null && ["leads", "deals", "opportunities", "sales", "revenue", "roas"].includes(id) ? delta >= 0 : delta != null && delta <= 0;
  const currentValueTone = currentValue != null && currentValue < 0 ? "text-red-600 dark:text-red-400" : "text-foreground";
  const previousValueTone = previousValue != null && previousValue < 0 ? "text-red-600 dark:text-red-400" : "text-foreground/75";
  return <article className="traffic-comparison-metric group relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/80 via-primary/25 to-transparent" />
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0 text-[10px] font-black uppercase leading-tight tracking-[.13em] text-muted-foreground">{label}</span></div>{delta != null ? <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black", improved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-rose-500/10 text-rose-600 dark:text-rose-300")} title={`${improved ? "Melhora" : "Piora"} de ${formatDelta(delta)} contra o período anterior`}>{improved ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{formatDelta(delta)} <span className="hidden font-semibold opacity-70 sm:inline">vs. anterior</span></span> : <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">Sem base</span>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2"><div className="min-w-0 rounded-xl border border-primary/20 bg-primary/[.06] p-2.5"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-primary">Atual</span><strong className={cn("mt-1 block whitespace-nowrap text-base font-black leading-tight tabular-nums tracking-tight sm:text-lg", currentValueTone)}>{formatValue(currentValue)}</strong></div><div className="min-w-0 rounded-xl border border-sky-400/20 bg-sky-400/[.06] p-2.5"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-sky-600 dark:text-sky-300">Anterior</span><strong className={cn("mt-1 block whitespace-nowrap text-base font-black leading-tight tabular-nums tracking-tight sm:text-lg", previousValueTone)}>{formatValue(previousValue)}</strong></div></div>
    <p className="mt-3 truncate text-[10px] text-muted-foreground">Fonte: {source}</p>
  </article>;
}

function stateLabel(state: SourceState) {
  return ({ loading: "Carregando", ready: "Dados completos", partial: "Dados parciais", empty: "Sem dados", error: "Erro de consulta" })[state];
}

function sourceState(isLoading: boolean, isError: boolean, length: number, hasPrevious: boolean): SourceState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (length === 0) return "empty";
  return hasPrevious ? "ready" : "partial";
}

function SourceBadge({ label, state, detail }: { label: string; state: SourceState; detail: string }) {
  const tone = state === "ready" ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : state === "error" ? "border-rose-500/25 bg-rose-500/5 text-rose-700 dark:text-rose-300" : "border-border bg-muted/25 text-muted-foreground";
  return <div className={cn("rounded-xl border px-3 py-2.5", tone)}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-[.12em]">{label}</span><span className="inline-flex items-center gap-1 text-[10px] font-bold">{state === "ready" && <CheckCircle2 className="h-3.5 w-3.5" />}{stateLabel(state)}</span></div><p className="mt-1 text-[10px] opacity-80">{detail}</p></div>;
}

export default function TrafficComparison() {
  const { startDate, endDate, adAccountId, adAccountIds, funnelIds, businessUnitId, segment } = useGlobalFilters();
  const { data: accounts = [], isLoading: accountsLoading } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId ? accounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id)) : accounts, [accounts, businessUnitId, segment]);
  const accountIds = useMemo(() => {
    if (adAccountId && adAccountId !== "all") return [adAccountId];
    const selected = adAccountIds.length ? adAccountIds : visibleAccounts.map((account) => account.id);
    return Array.from(new Set(selected.filter(Boolean)));
  }, [adAccountId, adAccountIds, visibleAccounts]);
  const attributionWindowsByAccount = useMemo(() => Object.fromEntries(visibleAccounts.map((account) => [account.id, account.attribution_window || "account_default"])), [visibleAccounts]);
  const period = useMemo(() => resolveComparisonPeriod(startDate, endDate), [endDate, startDate]);
  const enabled = !accountsLoading && accountIds.length > 0;
  const currentInsights = useInsights({ adAccountIds: accountIds, attributionWindowsByAccount, startDate: period.currentStart, endDate: period.currentEnd, enabled });
  const previousInsights = useInsights({ adAccountIds: accountIds, attributionWindowsByAccount, startDate: period.previousStart, endDate: period.previousEnd, enabled });
  const currentDeals = useRDDealsForPeriod({ startDate: period.currentStart, endDate: period.currentEnd, adAccountIds: accountIds, funnelIds, enabled });
  const previousDeals = useRDDealsForPeriod({ startDate: period.previousStart, endDate: period.previousEnd, adAccountIds: accountIds, funnelIds, enabled });
  const currentSales = useSales({ startDate: period.currentStart, endDate: period.currentEnd, adAccountIds: accountIds, funnelIds, enabled });
  const previousSales = useSales({ startDate: period.previousStart, endDate: period.previousEnd, adAccountIds: accountIds, funnelIds, enabled });
  const current = useMemo(() => aggregateTrafficComparison({ insights: currentInsights.data, deals: currentDeals.data, sales: currentSales.data }), [currentDeals.data, currentInsights.data, currentSales.data]);
  const previous = useMemo(() => aggregateTrafficComparison({ insights: previousInsights.data, deals: previousDeals.data, sales: previousSales.data }), [previousDeals.data, previousInsights.data, previousSales.data]);
  const mediaState = sourceState(accountsLoading || currentInsights.isLoading || previousInsights.isLoading, currentInsights.isError || previousInsights.isError, (currentInsights.data?.length || 0) + (previousInsights.data?.length || 0), Boolean(previousInsights.data?.length));
  const rdState = sourceState(accountsLoading || currentDeals.isLoading || previousDeals.isLoading, currentDeals.isError || previousDeals.isError, (currentDeals.data?.length || 0) + (previousDeals.data?.length || 0), Boolean(previousDeals.data?.length));
  const salesState = sourceState(accountsLoading || currentSales.isLoading || previousSales.isLoading, currentSales.isError || previousSales.isError, (currentSales.data?.length || 0) + (previousSales.data?.length || 0), Boolean(previousSales.data?.length));
  const loading = [mediaState, rdState, salesState].includes("loading");
  const hasAny = currentInsights.data?.length || currentDeals.data?.length || currentSales.data?.length;
  const metrics = [
    { id: "spend", label: "Investimento", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Meta Insights", icon: BarChart3 },
    { id: "leads", label: "Leads", formatValue: (value: number | null) => value == null ? "—" : number.format(value), source: "Meta Insights", icon: UsersRound },
    { id: "cpl", label: "CPL", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Meta Insights", icon: TrendingUp },
    { id: "deals", label: "Negócios RD", formatValue: (value: number | null) => value == null ? "—" : number.format(value), source: "RD Station", icon: Database },
    { id: "sales", label: "Vendas confirmadas", formatValue: (value: number | null) => value == null ? "—" : number.format(value), source: "Vendas consolidadas", icon: ShoppingBag },
    { id: "revenue", label: "Receita confirmada", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Vendas consolidadas", icon: GitCompareArrows },
    { id: "cac", label: "CAC", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Meta + vendas", icon: TrendingUp },
    { id: "roas", label: "ROAS", formatValue: (value: number | null) => value == null ? "—" : `${value.toFixed(2).replace(".", ",")}x`, source: "Meta + vendas", icon: BarChart3 },
  ];
  const executiveActions = useMemo(() => buildExecutiveActions(current, previous), [current, previous]);
  const refresh = () => { void currentInsights.refetch(); void previousInsights.refetch(); void currentDeals.refetch(); void previousDeals.refetch(); void currentSales.refetch(); void previousSales.refetch(); };
  return <section className="traffic-comparison-shell overflow-hidden rounded-2xl border border-border bg-background/80 shadow-sm" aria-labelledby="traffic-comparison-title">
    <header className="relative overflow-hidden border-b border-border bg-card px-5 py-6 sm:px-7"><div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.15em] text-primary"><GitCompareArrows className="h-3.5 w-3.5" />Comparação de períodos</div><h1 id="traffic-comparison-title" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">O que mudou de um período para o outro?</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Compare eficiência de mídia, negócios do RD e vendas confirmadas usando exatamente os filtros globais da conta.</p></div><div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-stretch"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-wider text-primary">Atual</span><span className="mt-1 block text-[11px] font-bold">{formatPeriod(period.currentStart, period.currentEnd)}</span></div><div className="rounded-xl border border-sky-400/25 bg-sky-400/5 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-300">Anterior</span><span className="mt-1 block text-[11px] font-bold text-muted-foreground">{formatPeriod(period.previousStart, period.previousEnd)}</span></div></div><button type="button" onClick={refresh} className="inline-flex h-auto min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-[11px] font-black hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Atualizar dados da comparação"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Atualizar</button></div></div></header>
    <div className="grid gap-3 border-b border-border bg-muted/15 p-4 sm:grid-cols-3"><SourceBadge label="Meta" state={mediaState} detail={`${currentInsights.data?.length || 0} linhas atuais · ${previousInsights.data?.length || 0} anteriores`} /><SourceBadge label="RD Station" state={rdState} detail={`${currentDeals.data?.length || 0} negócios atuais · ${previousDeals.data?.length || 0} anteriores`} /><SourceBadge label="Vendas" state={salesState} detail={`${currentSales.data?.length || 0} registros atuais · ${previousSales.data?.length || 0} anteriores`} /></div>
    {loading && <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin text-primary" />Carregando os dois períodos sem bloquear os filtros da plataforma…</div>}
    {!loading && !hasAny && <div className="m-5 flex items-start gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><b className="text-foreground">Não há dados para comparar neste escopo.</b><p className="mt-1 text-xs">Selecione outra conta ou período, ou sincronize Meta e RD antes de tentar novamente.</p></div></div>}
    {(loading || hasAny) && <>
      <div className="traffic-comparison-metrics-grid grid gap-4 p-4">{metrics.map((metric) => <MetricCard key={metric.id} {...metric} current={current} previous={previous} />)}</div>
      <div className="border-t border-border p-4">
        <article className="rounded-2xl border border-primary/20 bg-primary/[.06] p-5" aria-labelledby="traffic-executive-actions-title">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Plano de ação</p>
              <h2 id="traffic-executive-actions-title" className="mt-1 text-lg font-black">O que fazer para gerar mais caixa</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {executiveActions.map((action) => {
                  const tone = action.tone === "critical"
                    ? "border-red-500/25 bg-red-500/[.06]"
                    : action.tone === "growth"
                      ? "border-emerald-500/25 bg-emerald-500/[.06]"
                      : "border-border/70 bg-background/35";
                  const iconTone = action.tone === "critical" ? "text-red-500" : action.tone === "growth" ? "text-emerald-500" : "text-primary";
                  return <div key={action.title} className={cn("rounded-xl border p-3", tone)}><div className="flex items-start gap-2"><ArrowRight className={cn("mt-0.5 h-4 w-4 shrink-0", iconTone)} /><div className="min-w-0"><h3 className="text-xs font-black">{action.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{action.detail}</p></div></div></div>;
                })}
              </div>
            </div>
          </div>
        </article>
      </div>
    </>}
  </section>;
}
