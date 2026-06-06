import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Flame,
  Megaphone,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { countRDLeadsForCampaign, getRDDealSaleDate, getRDLeadsInRange, getRDWonDealsInRange, sumRDRevenue } from "@/lib/rdMetrics";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/realtime";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatCompact(value: number) {
  return numberFormatter.format(Math.round(Number.isFinite(value) ? value : 0));
}

function safePercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

interface Props {
  startDate: Date;
  endDate: Date;
  adAccountId?: string;
}

export function RevenueDiagnosticsSection({ startDate, endDate, adAccountId }: Props) {
  const [chartType, setChartType] = useState<"line" | "bar">(() => {
    try {
      return localStorage.getItem("growdash:funnel-revenue-chart-type") === "bar" ? "bar" : "line";
    } catch {
      return "line";
    }
  });
  const { data: adAccounts = [] } = useAdAccounts({ refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const { data: campaigns = [] } = useCampaigns(adAccountId, { refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const { data: insights = [] } = useInsights({
    startDate,
    endDate,
    adAccountId,
    enabled: true,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const { data: rdDeals = [] } = useRDDealsForPeriod({ startDate, endDate, adAccountId, refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });

  const revenueOS = useMemo(() => {
    const rdLeads = getRDLeadsInRange(rdDeals, startDate, endDate);
    const rdWon = getRDWonDealsInRange(rdDeals, startDate, endDate);
    const netRevenue = sumRDRevenue(rdWon);
    const grossRevenue = netRevenue;
    const spend = insights.reduce((sum, row) => sum + (row.spend || 0), 0);
    const leads = rdLeads.length;
    const clicks = insights.reduce((sum, row) => sum + (row.clicks || 0), 0);
    const avgHealth = insights.length > 0 ? insights.reduce((sum, row) => sum + (row.health_score || 0), 0) / insights.length : 0;
    const roas = spend > 0 ? netRevenue / spend : 0;
    const salesCount = rdWon.length;
    const cac = salesCount > 0 ? spend / salesCount : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const margin = grossRevenue > 0 ? ((netRevenue - spend) / grossRevenue) * 100 : 0;
    const conversionRate = leads > 0 ? (salesCount / leads) * 100 : 0;
    const activeCampaigns = new Set(insights.map((row) => row.campaign_id).filter(Boolean)).size || campaigns.length;
    const activeAccounts = adAccountId ? 1 : adAccounts.length;

    const dailyMap = new Map<string, { date: string; revenue: number; spend: number; leads: number }>();
    insights.forEach((row) => {
      const current = dailyMap.get(row.date) || { date: row.date, revenue: 0, spend: 0, leads: 0 };
      current.spend += row.spend || 0;
      dailyMap.set(row.date, current);
    });
    rdLeads.forEach((deal) => {
      const date = (deal.lead_created_at || "").slice(0, 10);
      if (!date) return;
      const current = dailyMap.get(date) || { date, revenue: 0, spend: 0, leads: 0 };
      current.leads += 1;
      dailyMap.set(date, current);
    });
    rdWon.forEach((deal) => {
      const date = (getRDDealSaleDate(deal) || "").slice(0, 10);
      if (!date) return;
      const current = dailyMap.get(date) || { date, revenue: 0, spend: 0, leads: 0 };
      current.revenue += deal.amount_total || 0;
      dailyMap.set(date, current);
    });

    const trend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((row) => ({ ...row, label: format(new Date(`${row.date}T00:00:00`), "dd/MM") }));

    const weakCampaigns = Object.values(
      insights.reduce<Record<string, { id: string | null; name: string; spend: number; health: number; rows: number }>>((acc, row) => {
        const key = row.campaign_id || row.campaign_name || "unknown";
        acc[key] ||= { id: row.campaign_id || null, name: row.campaign_name || "Campanha sem nome", spend: 0, health: 0, rows: 0 };
        acc[key].spend += row.spend || 0;
        acc[key].health += row.health_score || 0;
        acc[key].rows += 1;
        return acc;
      }, {}),
    )
      .map((campaign) => ({
        ...campaign,
        leads: countRDLeadsForCampaign(rdLeads, campaign.id, campaign.name),
        cpl: countRDLeadsForCampaign(rdLeads, campaign.id, campaign.name) > 0
          ? campaign.spend / countRDLeadsForCampaign(rdLeads, campaign.id, campaign.name)
          : campaign.spend,
        health: campaign.rows > 0 ? campaign.health / campaign.rows : 0,
      }))
      .sort((a, b) => b.cpl - a.cpl)
      .slice(0, 3);

    return {
      spend,
      leads,
      clicks,
      avgHealth,
      roas,
      cac,
      cpl,
      margin,
      conversionRate,
      activeCampaigns,
      activeAccounts,
      trend,
      weakCampaigns,
      salesCount,
    };
  }, [adAccountId, adAccounts.length, campaigns.length, endDate, insights, rdDeals, startDate]);

  const updateChartType = (next: "line" | "bar") => {
    setChartType(next);
    try {
      localStorage.setItem("growdash:funnel-revenue-chart-type", next);
    } catch {
      /* ignore */
    }
  };

  const actions = [
    {
      label: revenueOS.roas >= 2 ? "Escalar" : "Corrigir",
      title: revenueOS.roas >= 2 ? "Duplicar orçamento dos conjuntos saudáveis" : "Reduzir verba até recuperar ROAS",
      detail: `ROAS atual em ${revenueOS.roas.toFixed(2)}x com CAC de ${formatCurrency(revenueOS.cac)}.`,
      why: revenueOS.roas >= 2
        ? "A operação mostra retorno suficiente para testar aumento controlado de orçamento sem perder leitura estatística."
        : "O retorno atual ainda não sustenta escala. A prioridade é proteger margem antes de aumentar investimento.",
      metrics: [`ROAS: ${revenueOS.roas.toFixed(2)}x`, `CAC: ${formatCurrency(revenueOS.cac)}`, `Investimento: ${formatCurrency(revenueOS.spend)}`],
      risk: revenueOS.roas >= 2 ? "Escalar rápido demais pode saturar público e aumentar CAC." : "Manter verba alta pode consumir caixa sem previsibilidade de retorno.",
      next: revenueOS.roas >= 2 ? "Suba orçamento em 15% a 25% e reavalie em 24h." : "Corte verba dos piores conjuntos e revise criativos/oferta.",
      icon: ArrowUpRight,
      tone: "text-emerald-300",
    },
    {
      label: "Pausar",
      title: revenueOS.weakCampaigns[0]?.name || "Campanhas sem conversão suficiente",
      detail: `Maior CPL detectado: ${formatCurrency(revenueOS.weakCampaigns[0]?.cpl || revenueOS.cpl)}.`,
      why: "A IA encontrou sinal de custo acima do saudável. Isso normalmente indica criativo cansado, público errado ou promessa desalinhada.",
      metrics: [`CPL crítico: ${formatCurrency(revenueOS.weakCampaigns[0]?.cpl || revenueOS.cpl)}`, `Leads no período: ${formatCompact(revenueOS.leads)}`, `Health médio: ${safePercent(revenueOS.avgHealth)}`],
      risk: "Se continuar rodando sem ajuste, essa campanha pode destruir margem e contaminar a leitura do dashboard.",
      next: "Pause por 24h ou reduza orçamento para validar novo criativo, segmentação ou página.",
      icon: Flame,
      tone: "text-rose-300",
    },
    {
      label: "Corrigir",
      title: "Funil e atendimento precisam de auditoria",
      detail: `Conversão lead-venda em ${safePercent(revenueOS.conversionRate)} no período filtrado.`,
      why: "Há diferença entre geração de demanda e fechamento. O problema pode estar em qualificação, velocidade de atendimento ou etapa do CRM.",
      metrics: [`Conversão lead-venda: ${safePercent(revenueOS.conversionRate)}`, `Vendas: ${formatCompact(revenueOS.salesCount)}`, `Leads: ${formatCompact(revenueOS.leads)}`],
      risk: "Comprar mais leads sem corrigir atendimento aumenta CAC e reduz previsibilidade comercial.",
      next: "Audite leads sem contato, tempo de resposta no WhatsApp e perdas por etapa do RD/CRM.",
      icon: Target,
      tone: "text-amber-300",
    },
  ];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Diagnóstico executivo do funil</p>
        <h2 className="mt-1 text-xl font-semibold">Receita, ações prioritárias e prontidão operacional</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        <Card className="overflow-hidden border-white/10 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pulso de receita</p>
                <h2 className="mt-1 text-xl font-semibold">Receita x mídia</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-md border border-white/10 bg-background/60 p-1">
                  <Button size="sm" variant={chartType === "line" ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => updateChartType("line")}>Linha</Button>
                  <Button size="sm" variant={chartType === "bar" ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => updateChartType("bar")}>Barras</Button>
                </div>
                <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">
                  Margem {safePercent(revenueOS.margin)}
                </Badge>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <AreaChart data={revenueOS.trend}>
                    <defs>
                      <linearGradient id="funnelRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(value: number, name) => [formatCurrency(value), name === "revenue" ? "Receita" : "Investimento"]} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#funnelRevenueFill)" />
                    <Area type="monotone" dataKey="spend" stroke="hsl(var(--growth-accent))" strokeWidth={2} fill="transparent" />
                  </AreaChart>
                ) : (
                  <BarChart data={revenueOS.trend}>
                    <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(value: number, name) => [formatCurrency(value), name === "revenue" ? "Receita" : "Investimento"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spend" fill="hsl(var(--growth-accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Motor de decisão com IA</p>
                <h2 className="mt-1 text-xl font-semibold">Ações prioritárias</h2>
                <p className="mt-1 text-xs text-muted-foreground">Passe o mouse ou toque para ver o diagnóstico.</p>
              </div>
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-3">
              {actions.map((action) => (
                <Popover key={action.label}>
                  <PopoverTrigger asChild>
                    <button type="button" className="group flex w-full gap-3 rounded-lg border border-white/10 bg-background/45 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 transition-colors group-hover:border-primary/30">
                        <action.icon className={`h-4 w-4 ${action.tone}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="px-2 py-0 text-[10px] uppercase">{action.label}</Badge>
                          <p className="font-medium">{action.title}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="top" sideOffset={10} className="w-[min(360px,calc(100vw-2rem))] border-white/10 bg-popover/95 p-0 shadow-2xl shadow-primary/20 backdrop-blur-xl">
                    <div className="border-b border-white/10 p-4">
                      <h3 className="font-semibold leading-tight">{action.title}</h3>
                    </div>
                    <div className="space-y-4 p-4 text-sm">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Por que a IA sugeriu isso</p>
                        <p className="leading-6">{action.why}</p>
                      </div>
                      <div className="grid gap-2">
                        {action.metrics.map((metric) => (
                          <div key={metric} className="rounded-md border border-white/10 bg-background/55 px-3 py-2 text-xs font-medium">{metric}</div>
                        ))}
                      </div>
                      <div className="rounded-md border border-amber-400/20 bg-amber-400/10 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase text-amber-300">Risco</p>
                        <p className="leading-5 text-muted-foreground">{action.risk}</p>
                      </div>
                      <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase text-emerald-300">Próximo passo</p>
                        <p className="leading-5">{action.next}</p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Prontidão operacional</p>
                <h2 className="mt-1 text-xl font-semibold">Operação conectada</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="grid gap-3">
              {[
                { label: "Contas monitoradas", value: formatCompact(revenueOS.activeAccounts), icon: Activity },
                { label: "Campanhas ativas", value: formatCompact(revenueOS.activeCampaigns), icon: Megaphone },
                { label: "Leads rastreados", value: formatCompact(revenueOS.leads), icon: Bot },
                { label: "Cliques analisados", value: formatCompact(revenueOS.clicks), icon: Zap },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-background/45 p-3">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <strong className="text-sm">{item.value}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
