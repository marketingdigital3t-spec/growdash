import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CircleAlert, Database, GitCompareArrows, RefreshCw, ShoppingBag, TrendingUp, UsersRound } from "lucide-react";
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

function MetricCard({ label, id, current, previous, formatValue, source, icon: Icon }: { label: string; id: string; current: TrafficComparisonSnapshot; previous: TrafficComparisonSnapshot; formatValue: (value: number | null) => string; source: string; icon: typeof BarChart3 }) {
  const currentValue = metricValue(current, id);
  const previousValue = metricValue(previous, id);
  const delta = currentValue != null && previousValue != null ? percentDelta(currentValue, previousValue) : null;
  const improved = delta != null && ["leads", "deals", "opportunities", "sales", "revenue", "roas"].includes(id) ? delta >= 0 : delta != null && delta <= 0;
  return <article className="traffic-comparison-metric min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="truncate text-[10px] font-black uppercase tracking-[.13em] text-muted-foreground">{label}</span></div>{delta != null && <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black", improved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-rose-500/10 text-rose-600 dark:text-rose-300")}>{improved ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(delta).toFixed(1).replace(".", ",")}%</span>}</div>
    <div className="mt-4 flex items-end justify-between gap-3"><strong className="truncate text-xl font-black tabular-nums">{formatValue(currentValue)}</strong><span className="shrink-0 text-right text-[10px] text-muted-foreground">anterior<br /><b className="font-bold text-foreground/75">{formatValue(previousValue)}</b></span></div>
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
  return <div className={cn("rounded-xl border px-3 py-2", tone)}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-[.12em]">{label}</span><span className="text-[10px] font-bold">{stateLabel(state)}</span></div><p className="mt-1 text-[10px] opacity-80">{detail}</p></div>;
}

export default function TrafficComparison() {
  const { startDate, endDate, adAccountId, adAccountIds, funnelIds, businessUnitId, segment } = useGlobalFilters();
  const { data: accounts = [], isLoading: accountsLoading } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId ? accounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id)) : accounts, [accounts, businessUnitId, segment]);
  const accountIds = useMemo(() => {
    if (adAccountId !== "all") return [adAccountId];
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
    { id: "leads", label: "Resultados Meta", formatValue: (value: number | null) => value == null ? "—" : number.format(value), source: "Meta Insights", icon: UsersRound },
    { id: "cpl", label: "CPL", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Meta Insights", icon: TrendingUp },
    { id: "deals", label: "Negócios RD", formatValue: (value: number | null) => value == null ? "—" : number.format(value), source: "RD Station", icon: Database },
    { id: "sales", label: "Vendas confirmadas", formatValue: (value: number | null) => value == null ? "—" : number.format(value), source: "Vendas consolidadas", icon: ShoppingBag },
    { id: "revenue", label: "Receita confirmada", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Vendas consolidadas", icon: GitCompareArrows },
    { id: "cac", label: "CAC", formatValue: (value: number | null) => value == null ? "—" : currency.format(value), source: "Meta + vendas", icon: TrendingUp },
    { id: "roas", label: "ROAS", formatValue: (value: number | null) => value == null ? "—" : `${value.toFixed(2).replace(".", ",")}x`, source: "Meta + vendas", icon: BarChart3 },
  ];
  const maxBar = Math.max(current.spend, previous.spend, current.revenue, previous.revenue, 1);
  const refresh = () => { void currentInsights.refetch(); void previousInsights.refetch(); void currentDeals.refetch(); void previousDeals.refetch(); void currentSales.refetch(); void previousSales.refetch(); };
  return <section className="traffic-comparison-shell overflow-hidden rounded-2xl border border-border bg-background/80 shadow-sm" aria-labelledby="traffic-comparison-title">
    <header className="relative overflow-hidden border-b border-border bg-card px-5 py-6 sm:px-7"><div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Tráfego Pago · Comparação</p><h1 id="traffic-comparison-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">O que mudou de um período para o outro?</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Compare eficiência de mídia, negócios do RD e vendas confirmadas usando exatamente os filtros globais da conta.</p></div><div className="flex shrink-0 flex-wrap items-center gap-2"><span className="rounded-full border border-border bg-background px-3 py-2 text-[11px] font-bold">Atual · {formatPeriod(period.currentStart, period.currentEnd)}</span><span className="rounded-full border border-border bg-background px-3 py-2 text-[11px] font-bold text-muted-foreground">Anterior · {formatPeriod(period.previousStart, period.previousEnd)}</span><button type="button" onClick={refresh} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-[11px] font-black hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Atualizar dados da comparação"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Atualizar</button></div></div></header>
    <div className="grid gap-3 border-b border-border bg-muted/15 p-4 sm:grid-cols-3"><SourceBadge label="Meta" state={mediaState} detail={`${currentInsights.data?.length || 0} linhas atuais · ${previousInsights.data?.length || 0} anteriores`} /><SourceBadge label="RD Station" state={rdState} detail={`${currentDeals.data?.length || 0} negócios atuais · ${previousDeals.data?.length || 0} anteriores`} /><SourceBadge label="Vendas" state={salesState} detail={`${currentSales.data?.length || 0} registros atuais · ${previousSales.data?.length || 0} anteriores`} /></div>
    {loading && <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin text-primary" />Carregando os dois períodos sem bloquear os filtros da plataforma…</div>}
    {!loading && !hasAny && <div className="m-5 flex items-start gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><b className="text-foreground">Não há dados para comparar neste escopo.</b><p className="mt-1 text-xs">Selecione outra conta ou período, ou sincronize Meta e RD antes de tentar novamente.</p></div></div>}
    {(loading || hasAny) && <><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.id} {...metric} current={current} previous={previous} />)}</div><div className="grid gap-4 border-t border-border p-4 lg:grid-cols-[1.15fr_.85fr]"><article className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Leitura rápida</p><h2 className="mt-1 text-lg font-black">Mídia × resultado comercial</h2><p className="mt-1 text-xs text-muted-foreground">As barras mostram a escala absoluta dos dois períodos. O delta nos cards mostra a variação.</p></div><GitCompareArrows className="h-5 w-5 text-primary" /></div><div className="mt-6 grid gap-5">{[{ label: "Investimento", current: current.spend, previous: previous.spend, format: currency.format }, { label: "Receita confirmada", current: current.revenue, previous: previous.revenue, format: currency.format }, { label: "Vendas confirmadas", current: current.sales, previous: previous.sales, format: number.format }].map((row) => <div key={row.label}><div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold"><span>{row.label}</span><span className="text-muted-foreground">{row.format(row.current)} · {row.format(row.previous)}</span></div><div className="grid gap-2"><div className="flex items-center gap-2"><span className="w-14 text-[10px] text-muted-foreground">Atual</span><div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(2, row.current / maxBar * 100)}%` }} /></div></div><div className="flex items-center gap-2"><span className="w-14 text-[10px] text-muted-foreground">Anterior</span><div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${Math.max(2, row.previous / maxBar * 100)}%` }} /></div></div></div></div>)}</div></article><aside className="rounded-2xl border border-border bg-card p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Escopo aplicado</p><h2 className="mt-1 text-lg font-black">Dados comparáveis</h2><dl className="mt-5 grid gap-3 text-xs"><div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3"><dt className="text-muted-foreground">Contas Meta</dt><dd className="max-w-[60%] truncate text-right font-bold">{accountIds.length || "Nenhuma"}</dd></div><div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3"><dt className="text-muted-foreground">Funis RD</dt><dd className="max-w-[60%] truncate text-right font-bold">{funnelIds.length || "Vínculo da conta"}</dd></div><div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3"><dt className="text-muted-foreground">Janela</dt><dd className="text-right font-bold">Mesmo número de dias</dd></div><div className="flex items-start gap-2 pt-1 text-muted-foreground"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Meta, RD e vendas podem ter coberturas diferentes. O estado de cada fonte aparece acima e nenhum valor é atribuído a outra fonte.</span></div></dl></aside></div></>}
  </section>;
}
