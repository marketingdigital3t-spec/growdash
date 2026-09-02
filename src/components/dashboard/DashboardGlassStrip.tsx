import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, Coins, DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { metricDescription } from "@/lib/metricPresentation";

interface GlassMetric { label: string; value: string; icon: ReactNode; tone?: "good"; }
interface Props {
  revenue: number;
  spend: number;
  leads: number;
  cpl: number;
  roas: number;
  forecast30: number;
  sales: number;
  leadsBreakdown?: { forms: number; site: number; conversations: number; total: number };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function DashboardGlassStrip({ revenue, spend, leads, cpl, roas, forecast30, sales, leadsBreakdown }: Props) {
  const isMobile = useIsMobile();
  const [showLeadBreakdown, setShowLeadBreakdown] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("growdash:glass-strip-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("growdash:glass-strip-collapsed", collapsed ? "1" : "0"); } catch {} }, [collapsed]);
  const compact = isMobile && collapsed;
  const metrics: GlassMetric[] = [
    { label: "Faturamento bruto", value: brl.format(revenue), icon: <DollarSign /> },
    { label: "Investimento", value: brl.format(spend), icon: <Coins /> },
    { label: "Leads", value: integer.format(leads), icon: <Users /> },
    { label: "CPL", value: brl.format(cpl), icon: <BarChart3 /> },
    { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: <TrendingUp />, tone: roas >= 1 ? "good" : undefined },
    { label: "Previsão 30d", value: brl.format(forecast30), icon: <TrendingUp /> },
    { label: "Vendas", value: integer.format(sales), icon: <ShoppingCart /> },
  ];

  return <section className="dashboard-summary-strip sticky top-[calc(88px+env(safe-area-inset-top))] z-20 min-w-0 lg:top-[49px]" aria-label="Resumo fixo do Dashboard">
    <div className="dashboard-summary-strip-surface overflow-visible">
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left md:hidden" aria-expanded={!compact}><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"><BarChart3 className="h-4 w-4" /></span><span className="min-w-0 grow truncate text-xs font-black">Resumo da operação</span><span className="text-[10px] text-muted-foreground">{brl.format(revenue)} · {roas.toFixed(2)}x</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition", !compact && "rotate-180")} /></button>
      {!compact && <>
        <div className="dashboard-glass-metrics grid min-w-0 grid-cols-2 gap-1.5 border-t border-border/40 bg-transparent p-1.5 md:grid-cols-7 md:gap-1.5 md:border-t-0 md:p-2">
          {metrics.map((metric) => {
            const isLeads = metric.label === "Leads" && leadsBreakdown;
            const content = <><span className={cn("gd-glass-metric-icon grid h-8 w-8 shrink-0 place-items-center rounded-[10px] [&_svg]:h-3.5 [&_svg]:w-3.5", metric.tone === "good" && "is-good")}>{metric.icon}</span><div className="min-w-0 flex-1"><p className="whitespace-nowrap text-[6.5px] font-black uppercase leading-tight tracking-[.035em] text-muted-foreground" title={metric.label}>{metric.label}</p><p className="mt-1 whitespace-nowrap text-[12px] font-black leading-none tabular-nums" title={metric.value}>{metric.value}</p></div></>;
            const className = "gd-glass-metric group flex min-h-[66px] min-w-0 items-center gap-1.5 rounded-xl px-2 py-2.5 text-left";
            return isLeads ? <button key={metric.label} type="button" className={className} title="Forms/site e conversas iniciadas. Clique para detalhar." aria-expanded={showLeadBreakdown} onClick={() => setShowLeadBreakdown((value) => !value)}>{content}</button> : <article key={metric.label} className={className} title={metricDescription(metric.label)}>{content}</article>;
          })}
        </div>
        {showLeadBreakdown && leadsBreakdown && <div className="border-t border-border/50 bg-primary/[.035] px-3 py-2.5 text-[10px]" role="status"><div className="flex flex-wrap items-center gap-x-5 gap-y-1"><span><b>Forms:</b> {integer.format(leadsBreakdown.forms)}</span><span><b>Site:</b> {integer.format(leadsBreakdown.site)}</span><span><b>Conversas iniciadas:</b> {integer.format(leadsBreakdown.conversations)}</span><span className="font-black text-primary"><b>Total:</b> {integer.format(leadsBreakdown.total)}</span></div><p className="mt-1 text-[9px] text-muted-foreground">Forms usam o evento oficial `lead_grouped`; site usa o evento configurado da conta; conversas usam o evento oficial de conversa iniciada da Meta.</p></div>}
      </>}
    </div>
  </section>;
}
