import { useMemo, useState, useEffect } from "react";
import {
  CircleDollarSign,
  Gauge,
  X,
  Plus,
  Radar,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SalesDialog } from "@/components/dashboard/SalesDialog";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useInsights } from "@/hooks/useInsights";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAlerts } from "@/hooks/useAlerts";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { useSales, type Sale } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardGrid, buildWidgetFromDef } from "@/components/dashboard/grid/DashboardGrid";
import { AddWidgetDialog } from "@/components/dashboard/grid/AddWidgetDialog";
import { useGlobalView, useSaveView } from "@/hooks/useDashboardViews";
import { useIsMaster } from "@/hooks/useIsMaster";
import { readCompanySettings, type CompanySettings } from "@/lib/companySettings";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/realtime";
import { countRDLeadsForCampaign, getRDDealSaleDate, getRDLeadsInRange, getRDWonDealsInRange, sumRDRevenue } from "@/lib/rdMetrics";
import { setSelectedAdAccountFilter, useSelectedAdAccountFilter } from "@/hooks/useSelectedAdAccountFilter";
import { DEFAULT_VIEW } from "@/lib/widgetCatalog";
import { Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const CAMPAIGNS_EVENT_KEY = "growthos:campaign-filter-updated";
const DASHBOARD_EDIT_EVENT_KEY = "growthos:dashboard-edit-mode";
const DASHBOARD_ADD_WIDGET_EVENT_KEY = "growthos:dashboard-add-widget";
const HERO_DISMISSED_SESSION_KEY = "growthos:dashboard-hero-dismissed";

function readSessionValue(key: string, fallback: string) {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function safePercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

const Index = () => {
  const { session } = useAuth();
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const selectedAccount = useSelectedAdAccountFilter();
  const setSelectedAccount = (next: string) => setSelectedAdAccountFilter(next);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("dash:campaigns");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [company, setCompany] = useState<CompanySettings>(() => readCompanySettings());
  const [heroVisible, setHeroVisible] = useState(() => readSessionValue(HERO_DISMISSED_SESSION_KEY, "false") !== "true");

  const { data: adAccounts = [] } = useAdAccounts({ refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const { data: campaigns = [] } = useCampaigns(selectedAccount === "all" ? undefined : selectedAccount, { refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const { data: products = [] } = useProducts();
  const { data: insights = [], isLoading, refetch } = useInsights({
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
    startDate,
    endDate,
    enabled: true,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const { data: sales = [] } = useSales({
    startDate,
    endDate,
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const { data: rdDeals = [] } = useRDDealsForPeriod({
    startDate,
    endDate,
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const { data: alerts = [] } = useAlerts(true);
  const syncMeta = useSyncMeta();

  const { data: activeView } = useGlobalView();
  const { data: isMaster = false } = useIsMaster();
  const saveView = useSaveView();

  useEffect(() => {
    setHeroVisible(readSessionValue(HERO_DISMISSED_SESSION_KEY, "false") !== "true");
  }, [session?.user.id]);

  useEffect(() => {
    const refreshCompany = () => setCompany(readCompanySettings());
    window.addEventListener("storage", refreshCompany);
    window.addEventListener("growthos:company-settings-updated", refreshCompany);
    return () => {
      window.removeEventListener("storage", refreshCompany);
      window.removeEventListener("growthos:company-settings-updated", refreshCompany);
    };
  }, []);

  const revenueOS = useMemo(() => {
    const rdLeads = getRDLeadsInRange(rdDeals, startDate, endDate);
    const rdWon = getRDWonDealsInRange(rdDeals, startDate, endDate);
    const netRevenue = sumRDRevenue(rdWon);
    const grossRevenue = netRevenue;
    const spend = insights.reduce((sum, row) => sum + (row.spend || 0), 0);
    const leads = rdLeads.length;
    const clicks = insights.reduce((sum, row) => sum + (row.clicks || 0), 0);
    const impressions = insights.reduce((sum, row) => sum + (row.impressions || 0), 0);
    const avgHealth =
      insights.length > 0 ? insights.reduce((sum, row) => sum + (row.health_score || 0), 0) / insights.length : 0;
    const roas = spend > 0 ? netRevenue / spend : 0;
    const salesCount = rdWon.length;
    const cac = salesCount > 0 ? spend / salesCount : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const margin = grossRevenue > 0 ? ((netRevenue - spend) / grossRevenue) * 100 : 0;
    const conversionRate = leads > 0 ? (salesCount / leads) * 100 : 0;
    const forecast30 = netRevenue > 0 ? netRevenue * 1.18 : spend > 0 ? spend * Math.max(roas, 1.25) : 0;
    const activeCampaigns = new Set(insights.map((row) => row.campaign_id).filter(Boolean)).size;
    const activeAccounts = selectedAccount === "all" ? adAccounts.length : 1;

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
      .map((row) => ({
        ...row,
        label: format(new Date(`${row.date}T00:00:00`), "dd/MM"),
      }));

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
      netRevenue,
      spend,
      leads,
      clicks,
      impressions,
      avgHealth,
      roas,
      cac,
      cpl,
      margin,
      conversionRate,
      forecast30,
      activeCampaigns,
      activeAccounts,
      trend,
      weakCampaigns,
      salesCount,
    };
  }, [adAccounts.length, endDate, insights, rdDeals, selectedAccount, startDate]);

  // Account selection now flows through useSelectedAdAccountFilter (single source of truth).
  useEffect(() => {
    try { localStorage.setItem("dash:campaigns", JSON.stringify(selectedCampaignIds)); } catch {}
  }, [selectedCampaignIds]);

  useEffect(() => {
    const syncCampaigns = (event?: Event) => {
      const next = event instanceof CustomEvent
        ? event.detail
        : (() => {
            try {
              const raw = localStorage.getItem("dash:campaigns");
              return raw ? JSON.parse(raw) : [];
            } catch { return []; }
          })();
      setSelectedCampaignIds((current) => JSON.stringify(current) === JSON.stringify(next || []) ? current : (next || []));
    };
    const syncEditMode = (event: Event) => {
      if (!isMaster) return;
      setIsEditing(Boolean((event as CustomEvent).detail));
    };
    const openAddWidget = () => {
      if (!isMaster) return;
      setAddOpen(true);
    };
    window.addEventListener("storage", syncCampaigns);
    window.addEventListener(CAMPAIGNS_EVENT_KEY, syncCampaigns);
    window.addEventListener(DASHBOARD_EDIT_EVENT_KEY, syncEditMode);
    window.addEventListener(DASHBOARD_ADD_WIDGET_EVENT_KEY, openAddWidget);
    return () => {
      window.removeEventListener("storage", syncCampaigns);
      window.removeEventListener(CAMPAIGNS_EVENT_KEY, syncCampaigns);
      window.removeEventListener(DASHBOARD_EDIT_EVENT_KEY, syncEditMode);
      window.removeEventListener(DASHBOARD_ADD_WIDGET_EVENT_KEY, openAddWidget);
    };
  }, [isMaster]);

  useEffect(() => {
    if (selectedAccount !== "all" && adAccounts.length > 0 && !adAccounts.some((a) => a.id === selectedAccount)) {
      setSelectedAccount("all");
    }
  }, [adAccounts, selectedAccount]);

  const handleSync = async () => {
    refetch();
    syncMeta
      .mutateAsync({
        adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
      })
      .then(() => refetch());
  };

  const dismissHero = () => {
    setHeroVisible(false);
    writeSessionValue(HERO_DISMISSED_SESSION_KEY, "true");
  };

  function handleAddWidget(def: any) {
    if (!activeView || !isMaster) return;
    const built = buildWidgetFromDef(def.type);
    if (!built) return;
    const nextWidgets = [...(activeView.widgets || []), built.widget];
    const nextLayout = [...(activeView.layout || []), built.layout];
    saveView.mutate({ id: activeView.id, layout: nextLayout, widgets: nextWidgets });
  }

  return (
    <MotionPage className="space-y-7">
      {heroVisible && (
      <MotionItem>
        <section className="growth-hero overflow-hidden rounded-lg border border-white/10 bg-card/70 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl md:p-7">
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={dismissHero} aria-label="Ocultar bloco principal">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="min-w-0 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {company.companyName}
                </Badge>
                <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10">
                  Receita em tempo real
                </Badge>
              </div>
              <div>
                <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-normal text-foreground md:text-5xl">
                  {company.companyDescription || "Sistema operacional de receita com IA para escalar aquisição, vendas e margem."}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  Centralize tráfego, CRM, WhatsApp, pagamentos e funis em um cockpit executivo com recomendações
                  práticas sobre o que pausar, escalar e corrigir.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setEditingSale(null); setSalesDialogOpen(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar venda
                </Button>
                <Button variant="outline" onClick={handleSync} disabled={syncMeta.isPending || isLoading} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Sincronizar dados
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Faturamento líquido", value: formatCurrency(revenueOS.netRevenue), icon: CircleDollarSign, tone: "text-emerald-300" },
                { label: "ROAS combinado", value: `${revenueOS.roas.toFixed(2)}x`, icon: TrendingUp, tone: "text-cyan-300" },
                { label: "Previsão 30d", value: formatCurrency(revenueOS.forecast30), icon: Radar, tone: "text-violet-300" },
                { label: "Saúde da operação", value: safePercent(revenueOS.avgHealth), icon: Gauge, tone: "text-amber-300" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-lg border border-white/10 bg-background/45 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase text-muted-foreground">{metric.label}</span>
                    <metric.icon className={`h-4 w-4 ${metric.tone}`} />
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </MotionItem>
      )}

      {(() => {
        const hasAdAccounts = adAccounts.length > 0;
        const hasRDData = rdDeals.length > 0;
        const noIntegrations = !hasAdAccounts && !hasRDData;
        const viewToRender = activeView ?? ({
          id: "__default_fallback__",
          user_id: "",
          name: DEFAULT_VIEW.name,
          is_default: true,
          is_system: true,
          scope: "global",
          ad_account_id: null,
          layout: DEFAULT_VIEW.layout,
          widgets: DEFAULT_VIEW.widgets,
          created_at: "",
          updated_at: "",
        } as any);

        return (
          <>
            {noIntegrations && (
              <MotionItem>
                <Card className="border-dashed border-primary/30 bg-card/60 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Link2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold">Conecte uma conta para ver seus dados</h2>
                  <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                    Os blocos abaixo serão preenchidos automaticamente assim que você vincular uma conta de anúncios (Meta Ads) ou o RD Station.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button asChild className="gap-2">
                      <Link to="/integrations">
                        <Link2 className="h-4 w-4" /> Ir para Integrações
                      </Link>
                    </Button>
                  </div>
                </Card>
              </MotionItem>
            )}
            <DashboardProvider
              value={{
                startDate,
                endDate,
                adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
                insights,
                sales,
                rdDeals,
                alerts,
                campaigns,
                adAccounts,
                products,
                isLoading,
              }}
            >
              <DashboardGrid
                view={viewToRender}
                isEditing={isEditing && isMaster && !!activeView}
                onChange={(layout, widgets) => {
                  if (!isMaster || !activeView) return;
                  saveView.mutate({ id: activeView.id, layout, widgets });
                }}
                onAddClick={() => setAddOpen(true)}
                onEditSale={(s) => { setEditingSale(s); setSalesDialogOpen(true); }}
              />
            </DashboardProvider>
          </>
        );
      })()}

      <AddWidgetDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAddWidget} />

      <SalesDialog
        open={salesDialogOpen}
        onOpenChange={(o) => { setSalesDialogOpen(o); if (!o) setEditingSale(null); }}
        editingSale={editingSale}
      />
    </MotionPage>
  );
};

export default Index;
