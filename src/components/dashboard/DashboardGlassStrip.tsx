import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, Coins, DollarSign, HeartPulse, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface GlassMetric { label: string; value: string; icon: ReactNode; tone?: "good" | "warn"; }
interface Props {
  revenue: number;
  spend: number;
  leads: number;
  cpl: number;
  roas: number;
  forecast30: number;
  openAlerts: number;
  sales: number;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function DashboardGlassStrip({ revenue, spend, leads, cpl, roas, forecast30, openAlerts, sales }: Props) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("growdash:glass-strip-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("growdash:glass-strip-collapsed", collapsed ? "1" : "0"); } catch {} }, [collapsed]);
  const compact = isMobile && collapsed;
  const metrics: GlassMetric[] = [
    { label: "Faturamento líquido", value: brl.format(revenue), icon: <DollarSign /> },
    { label: "Investimento", value: brl.format(spend), icon: <Coins /> },
    { label: "Leads", value: integer.format(leads), icon: <Users /> },
    { label: "CPL", value: brl.format(cpl), icon: <BarChart3 /> },
    { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: <TrendingUp />, tone: roas >= 1 ? "good" : undefined },
    { label: "Previsão 30d", value: brl.format(forecast30), icon: <TrendingUp /> },
    { label: "Saúde", value: openAlerts ? `${openAlerts} alerta${openAlerts === 1 ? "" : "s"}` : "Sem alertas", icon: <HeartPulse />, tone: openAlerts ? "warn" : "good" },
    { label: "Vendas", value: integer.format(sales), icon: <ShoppingCart /> },
  ];

  return <section className="sticky top-[calc(88px+env(safe-area-inset-top))] z-20 min-w-0 lg:top-[49px]" aria-label="Resumo fixo do Dashboard">
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-background/72 shadow-[0_10px_36px_rgba(0,0,0,.18)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/58 dark:border-white/[.11] dark:bg-[#070707]/88 dark:shadow-[0_10px_38px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.035)]">
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left md:hidden" aria-expanded={!compact}><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"><BarChart3 className="h-4 w-4" /></span><span className="min-w-0 grow truncate text-xs font-black">Resumo da operação</span><span className="text-[10px] text-muted-foreground">{brl.format(revenue)} · {roas.toFixed(2)}x</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition", !compact && "rotate-180")} /></button>
      {!compact && <div className="grid min-w-0 grid-cols-2 gap-px border-t border-border/50 bg-border/45 md:grid-cols-4 md:border-t-0 xl:grid-cols-8">{metrics.map((metric) => <article key={metric.label} className="flex min-w-0 items-center gap-2 bg-background/75 px-3 py-3 dark:bg-[#060606]/88"><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4", metric.tone === "good" && "bg-emerald-500/10 text-emerald-500", metric.tone === "warn" && "bg-amber-500/10 text-amber-500")}>{metric.icon}</span><div className="min-w-0"><p className="truncate text-[8px] font-black uppercase tracking-[.08em] text-muted-foreground" title={metric.label}>{metric.label}</p><p className="truncate text-xs font-black tabular-nums sm:text-sm" title={metric.value}>{metric.value}</p></div></article>)}</div>}
    </div>
  </section>;
}
