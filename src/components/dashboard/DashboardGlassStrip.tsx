import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, Coins, DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { metricDescription } from "@/lib/metricPresentation";
import { isMetricAvailable, type MetricAvailability } from "@/lib/metricAvailability";
import { MetricLoadingIndicator } from "@/components/dashboard/MetricLoadingIndicator";

interface GlassMetric { label: string; value: ReactNode; icon: ReactNode; tone?: "good" | "negative"; unavailable?: boolean; reason?: string | null; }
interface Props {
  revenue: number;
  spend: number;
  leads: number;
  cpl: number;
  roas: number;
  forecast30: number;
  sales: number;
  leadsBreakdown?: { forms: number; site: number; conversations: number; total: number };
  loading?: boolean;
  hasSnapshot?: boolean;
  unavailableReason?: string | null;
  /** Availability is tracked per provider block so a slow lead/action
   * reconciliation cannot hide a confirmed spend snapshot (or turn an
   * unconfirmed lead count into zero). */
  metricAvailability?: Partial<Record<"revenue" | "spend" | "leads" | "conversations" | "cpl" | "roas" | "forecast" | "sales", MetricAvailability>>;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function DashboardGlassStrip({ revenue, spend, leads, cpl, roas, forecast30, sales, leadsBreakdown, loading = false, hasSnapshot = true, unavailableReason, metricAvailability = {} }: Props) {
  const isMobile = useIsMobile();
  const [showLeadBreakdown, setShowLeadBreakdown] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("growdash:glass-strip-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("growdash:glass-strip-collapsed", collapsed ? "1" : "0"); } catch {} }, [collapsed]);
  const compact = isMobile && collapsed;
  const availabilityMap = metricAvailability;
  const getMetricState = (requiresMeta = true, metric?: keyof typeof availabilityMap) => {
    if (!requiresMeta) return { unavailable: false, loading: false, reason: null as string | null };
    const availability = metric ? availabilityMap[metric] : undefined;
    if (availability?.state === "loading") return { unavailable: false, loading: true, reason: availability.reason || unavailableReason || null };
    if (availability) return { unavailable: !isMetricAvailable(availability), loading: false, reason: availability.reason || unavailableReason || null };
    return { unavailable: !hasSnapshot && !loading, loading: !hasSnapshot && loading, reason: unavailableReason || null };
  };
  const display = (value: string, requiresMeta = true, metric?: keyof typeof availabilityMap): ReactNode => {
    const state = getMetricState(requiresMeta, metric);
    if (state.loading) return <MetricLoadingIndicator />;
    return state.unavailable ? "Indisponível" : value;
  };
  const metrics: GlassMetric[] = [
    { label: "Faturamento bruto", value: display(brl.format(revenue), true, "revenue"), icon: <DollarSign />, ...getMetricState(true, "revenue") },
    { label: "Investimento em anúncio", value: display(brl.format(spend), true, "spend"), icon: <Coins />, ...getMetricState(true, "spend") },
    { label: "Leads", value: display(integer.format(leads), true, "leads"), icon: <Users />, ...getMetricState(true, "leads") },
    { label: "CPL", value: display(brl.format(cpl), true, "cpl"), icon: <BarChart3 />, ...getMetricState(true, "cpl") },
    { label: "ROAS", value: display(`${roas.toFixed(2)}x`, true, "roas"), icon: <TrendingUp />, tone: roas >= 1 ? "good" : "negative", ...getMetricState(true, "roas") },
    { label: "Previsão 30d", value: display(brl.format(forecast30), true, "forecast"), icon: <TrendingUp />, tone: forecast30 < 0 ? "negative" : undefined, ...getMetricState(true, "forecast") },
    { label: "Vendas", value: display(integer.format(sales), true, "sales"), icon: <ShoppingCart />, ...getMetricState(true, "sales") },
  ];
  const pendingReasons = Array.from(new Set(metrics.map((metric) => metric.unavailable && metric.reason).filter((reason): reason is string => Boolean(reason))));
  const hasUnavailableMetrics = metrics.some((metric) => metric.unavailable);

  return <section className="dashboard-summary-strip sticky top-[calc(88px+env(safe-area-inset-top))] z-20 mx-1 min-w-0 sm:mx-2 lg:top-[49px]" aria-label="Resumo fixo do Dashboard">
      <div className="dashboard-summary-strip-surface overflow-visible">
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left md:hidden" aria-expanded={!compact}><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"><BarChart3 className="h-4 w-4" /></span><span className="min-w-0 grow truncate text-xs font-black">Resumo da operação</span><span className="text-[10px] text-muted-foreground">{display(brl.format(revenue), true, "revenue")} · {display(`${roas.toFixed(2)}x`, true, "roas")}</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition", !compact && "rotate-180")} /></button>
      {!compact && <>
        <div className="dashboard-glass-metrics grid min-w-0 grid-cols-2 gap-3 border-t border-border/40 bg-transparent p-3 md:grid-cols-4 md:border-t-0 xl:grid-cols-7">
          {metrics.map((metric) => {
            const isLeads = metric.label === "Leads" && leadsBreakdown;
            const fullReason = metric.reason || metricDescription(metric.label);
            const content = <><span className={cn("gd-glass-metric-icon grid h-8 w-8 shrink-0 place-items-center rounded-[var(--gd-radius-control)] [&_svg]:h-4 [&_svg]:w-4", metric.tone === "good" && "is-good", metric.tone === "negative" && "is-negative")}>{metric.icon}</span><div className="min-w-0 flex-1"><p className="gd-label break-words text-muted-foreground" title={metric.label}>{metric.label}</p><p className={cn("gd-glass-metric-value mt-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[22px] font-bold leading-tight tabular-nums", metric.unavailable && "text-muted-foreground", metric.tone === "good" && "text-emerald-600 dark:text-emerald-400", metric.tone === "negative" && "text-red-600 dark:text-red-400")} title={fullReason} aria-label={metric.unavailable ? `${metric.label}: Indisponível. ${fullReason}` : `${metric.label}: ${typeof metric.value === "string" ? metric.value : "valor disponível"}`}>{metric.value}</p></div></>;
            const className = cn(
              "gd-glass-metric group flex min-h-[72px] min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left",
              isLeads && "gd-glass-metric-leads",
            );
            return isLeads ? <button key={metric.label} type="button" className={className} title={metric.unavailable ? fullReason : "Forms/site e conversas iniciadas. Clique para detalhar."} aria-expanded={showLeadBreakdown} onClick={() => setShowLeadBreakdown((value) => !value)}>{content}</button> : <article key={metric.label} className={className} title={fullReason}>{content}</article>;
          })}
        </div>
        {hasUnavailableMetrics && <div className="flex min-w-0 items-center gap-2 border-t border-border/50 bg-amber-500/[.045] px-3 py-2 text-[10px] text-muted-foreground" role="status" title={pendingReasons.join(" ") || unavailableReason || "A cobertura das métricas Meta ainda não foi confirmada."}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /><span className="truncate"><b className="text-foreground">Cobertura Meta pendente.</b> Alguns indicadores aguardam confirmação da sincronização.</span></div>}
        {showLeadBreakdown && leadsBreakdown && <div className="border-t border-border/50 bg-primary/[.035] px-3 py-2.5 text-[10px]" role="status"><div className="flex flex-wrap items-center gap-x-5 gap-y-1"><span><b>Forms:</b> {integer.format(leadsBreakdown.forms)}</span><span><b>Site:</b> {integer.format(leadsBreakdown.site)}</span><span><b>Conversas iniciadas:</b> {integer.format(leadsBreakdown.conversations)}</span><span className="font-black text-primary"><b>Total:</b> {integer.format(leadsBreakdown.total)}</span></div><p className="mt-1 text-[9px] text-muted-foreground">Forms usam o evento oficial `lead_grouped`; site usa o evento configurado da conta; conversas usam o evento oficial de conversa iniciada da Meta.</p></div>}
      </>}
    </div>
  </section>;
}
