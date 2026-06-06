import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CircleDollarSign, Gauge, Goal, MousePointerClick, PencilRuler, RefreshCw, Settings, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { CampaignMultiSelect } from "@/components/dashboard/CampaignMultiSelect";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useControlledRealtimeSync } from "@/hooks/useControlledRealtimeSync";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getMonthlyGoalForScope, readAccountMonthlyGoals, readCompanySettings, type CompanySettings } from "@/lib/companySettings";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/realtime";
import { getRDLeadsInRange, getRDWonDealsInRange, sumRDRevenue } from "@/lib/rdMetrics";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ACCOUNT_STORAGE_KEY = "dash:account";
const ACCOUNT_EVENT_KEY = "growthos:account-filter-updated";
const CAMPAIGNS_STORAGE_KEY = "dash:campaigns";
const CAMPAIGNS_EVENT_KEY = "growthos:campaign-filter-updated";
const DASHBOARD_EDIT_EVENT_KEY = "growthos:dashboard-edit-mode";
const DASHBOARD_ADD_WIDGET_EVENT_KEY = "growthos:dashboard-add-widget";

function money(value: number) {
  return brl.format(Number.isFinite(value) ? value : 0);
}

function metricClass(progress: number) {
  if (progress >= 100) return "text-emerald-300";
  if (progress >= 80) return "text-cyan-300";
  if (progress >= 50) return "text-amber-300";
  return "text-rose-300";
}

export function RevenueTopBar() {
  const [settings, setSettings] = useState<CompanySettings>(() => readCompanySettings());
  const [accountGoals, setAccountGoals] = useState<Record<string, number>>(() => readAccountMonthlyGoals());
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const [selectedAccount, setSelectedAccount] = useState(() => {
    try { return localStorage.getItem(ACCOUNT_STORAGE_KEY) || "all"; } catch { return "all"; }
  });
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [dashboardEditing, setDashboardEditing] = useState(false);
  const { data: adAccounts = [] } = useAdAccounts({ refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const activeAccountId = selectedAccount === "all" ? undefined : selectedAccount;
  const { data: campaigns = [] } = useCampaigns(activeAccountId, { refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const syncMeta = useSyncMeta();
  const sync = useControlledRealtimeSync({
    adAccountId: activeAccountId,
    startDate,
    endDate,
    enabled: true,
    intervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const { data: insights = [] } = useInsights({
    startDate,
    endDate,
    adAccountId: activeAccountId,
    campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
    enabled: true,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const { data: rdDeals = [] } = useRDDealsForPeriod({ startDate, endDate, adAccountId: activeAccountId, refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });

  useEffect(() => {
    const refresh = () => setSettings(readCompanySettings());
    const refreshGoals = () => setAccountGoals(readAccountMonthlyGoals());
    window.addEventListener("storage", refresh);
    window.addEventListener("growthos:company-settings-updated", refresh);
    window.addEventListener("trackvio:account-monthly-goals-updated", refreshGoals);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("growthos:company-settings-updated", refresh);
      window.removeEventListener("trackvio:account-monthly-goals-updated", refreshGoals);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, selectedAccount);
      window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT_KEY, { detail: selectedAccount }));
    } catch { /* ignore */ }
  }, [selectedAccount]);

  useEffect(() => {
    try {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(selectedCampaignIds));
      window.dispatchEvent(new CustomEvent(CAMPAIGNS_EVENT_KEY, { detail: selectedCampaignIds }));
    } catch { /* ignore */ }
  }, [selectedCampaignIds]);

  useEffect(() => {
    const syncAccount = (event?: Event) => {
      const next = event instanceof CustomEvent
        ? String(event.detail || "all")
        : (() => {
            try { return localStorage.getItem(ACCOUNT_STORAGE_KEY) || "all"; } catch { return "all"; }
          })();
      setSelectedAccount((current) => (current === next ? current : next));
    };
    window.addEventListener("storage", syncAccount);
    window.addEventListener(ACCOUNT_EVENT_KEY, syncAccount);
    return () => {
      window.removeEventListener("storage", syncAccount);
      window.removeEventListener(ACCOUNT_EVENT_KEY, syncAccount);
    };
  }, []);

  useEffect(() => {
    if (selectedAccount !== "all" && adAccounts.length > 0 && !adAccounts.some((account) => account.id === selectedAccount)) {
      setSelectedAccount("all");
    }
  }, [adAccounts, selectedAccount]);

  useEffect(() => {
    const syncCampaigns = (event?: Event) => {
      const next = event instanceof CustomEvent
        ? event.detail
        : (() => {
            try {
              const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
              return raw ? JSON.parse(raw) : [];
            } catch { return []; }
          })();
      setSelectedCampaignIds((current) => JSON.stringify(current) === JSON.stringify(next || []) ? current : (next || []));
    };
    window.addEventListener("storage", syncCampaigns);
    window.addEventListener(CAMPAIGNS_EVENT_KEY, syncCampaigns);
    return () => {
      window.removeEventListener("storage", syncCampaigns);
      window.removeEventListener(CAMPAIGNS_EVENT_KEY, syncCampaigns);
    };
  }, []);

  useEffect(() => {
    const syncEditMode = (event: Event) => {
      setDashboardEditing(Boolean((event as CustomEvent).detail));
    };
    window.addEventListener(DASHBOARD_EDIT_EVENT_KEY, syncEditMode);
    return () => window.removeEventListener(DASHBOARD_EDIT_EVENT_KEY, syncEditMode);
  }, []);

  useEffect(() => {
    if (selectedCampaignIds.length === 0 || campaigns.length === 0) return;
    const available = new Set(campaigns.map((campaign) => campaign.id));
    const next = selectedCampaignIds.filter((id) => available.has(id));
    if (next.length !== selectedCampaignIds.length) setSelectedCampaignIds(next);
  }, [campaigns, selectedCampaignIds]);

  const metrics = useMemo(() => {
    const rdLeads = getRDLeadsInRange(rdDeals, startDate, endDate);
    const rdWon = getRDWonDealsInRange(rdDeals, startDate, endDate);
    const revenue = sumRDRevenue(rdWon);
    const spend = insights.reduce((sum, row) => sum + (row.spend || 0), 0);
    const leads = rdLeads.length;
    const salesCount = rdWon.length;
    const health = insights.length > 0 ? insights.reduce((sum, row) => sum + (row.health_score || 0), 0) / insights.length : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const forecast = revenue > 0 ? revenue * 1.18 : spend * Math.max(roas, 1.25);
    const goal = getMonthlyGoalForScope(selectedAccount, adAccounts, settings.monthlyGoal, accountGoals);
    const progress = Math.min((revenue / goal) * 100, 140);

    return {
      revenue,
      spend,
      leads,
      cpl,
      roas,
      forecast,
      health,
      sales: salesCount,
      goal,
      progress,
    };
  }, [accountGoals, adAccounts, endDate, insights, rdDeals, selectedAccount, settings.monthlyGoal, startDate]);

  const items = [
    { label: "Faturamento líquido", value: money(metrics.revenue), icon: CircleDollarSign },
    { label: "Investimento em Anúncio", value: money(metrics.spend), icon: MousePointerClick },
    { label: "Leads", value: String(metrics.leads), icon: Users },
    { label: "CPL", value: money(metrics.cpl), icon: TrendingUp },
    { label: "ROAS", value: `${metrics.roas.toFixed(2)}x`, icon: TrendingUp },
    { label: "Previsão 30d", value: money(metrics.forecast), icon: BarChart3 },
    { label: "Saúde", value: `${metrics.health.toFixed(1)}%`, icon: Gauge },
    { label: "Vendas", value: String(metrics.sales), icon: ShoppingCart },
  ];

  const handleAccountChange = (id: string) => {
    setSelectedAccount(id);
    setSelectedCampaignIds([]);
  };

  const handleManualSync = async () => {
    await syncMeta.mutateAsync({
      adAccountId: activeAccountId,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    });
  };

  const toggleDashboardEditing = () => {
    const next = !dashboardEditing;
    setDashboardEditing(next);
    window.dispatchEvent(new CustomEvent(DASHBOARD_EDIT_EVENT_KEY, { detail: next }));
  };

  return (
    <div className="revenue-glass-sticky sticky top-14 z-40 space-y-2 px-3 py-2 md:px-5">
      <div className="flex justify-end">
        <div className="flex w-full max-w-full flex-wrap items-center justify-end gap-2">
          <div className={cn(
            "revenue-glass-control hidden min-h-10 items-center gap-2 px-3 text-xs lg:flex",
            sync.status === "error" ? "text-rose-300" : sync.status === "syncing" ? "text-cyan-300" : "text-emerald-300",
          )}>
            <Activity className={cn("h-4 w-4", sync.status === "syncing" && "animate-pulse")} />
            <span>{sync.status === "syncing" ? "Sincronizando APIs..." : sync.lastMessage}</span>
          </div>
          <div className="revenue-glass-control min-w-0">
            <Select value={selectedAccount} onValueChange={handleAccountChange}>
              <SelectTrigger className="h-9 w-[min(46vw,220px)] min-w-[150px] border-border/60 bg-background/70 text-xs backdrop-blur">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas vinculadas</SelectItem>
                {adAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="revenue-glass-control min-w-0">
            <CampaignMultiSelect
              campaigns={campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }))}
              selectedIds={selectedCampaignIds}
              onChange={setSelectedCampaignIds}
              className="h-9 w-[min(46vw,220px)] min-w-[150px] bg-background/70 text-xs backdrop-blur"
            />
          </div>
          <div className="revenue-glass-control">
            <MetaDateRangePicker
              preset={preset}
              onPresetChange={setPreset}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              startDate={startDate}
              endDate={endDate}
              autoApplyPresets
              compact
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleManualSync}
            disabled={syncMeta.isPending}
            className="revenue-glass-control h-9 w-9 bg-background/70"
            aria-label="Recarregar dados"
          >
            <RefreshCw className={cn("h-4 w-4", syncMeta.isPending && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleDashboardEditing}
            className={cn(
              "revenue-glass-control h-9 w-9 bg-background/70",
              dashboardEditing && "border-primary/60 bg-primary/15 text-primary shadow-[0_0_26px_hsl(var(--primary)/0.2)]",
            )}
            aria-label={dashboardEditing ? "Concluir edição do dashboard" : "Editar dashboard"}
            title={dashboardEditing ? "Concluir edição" : "Editar dashboard"}
          >
            {dashboardEditing ? <PencilRuler className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="revenue-glass-bar grid min-h-14 grid-cols-2 items-stretch gap-2 px-2 py-1.5 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-[minmax(168px,1.35fr)_repeat(8,minmax(78px,1fr))] md:px-3">
        <div className="revenue-glass-card flex min-w-0 items-center gap-1.5 px-2 py-1.5">
          <Goal className={cn("h-3.5 w-3.5 shrink-0", metricClass(metrics.progress))} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">Meta mensal</span>
              <span className="shrink-0">{Math.min(metrics.progress, 999).toFixed(0)}%</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Progress value={Math.min(metrics.progress, 100)} className="h-1.5 min-w-0 flex-1 bg-muted" />
              <span className="shrink-0 text-[11px] font-semibold">{money(metrics.goal)}</span>
            </div>
          </div>
        </div>

        {items.map((item) => (
          <div key={item.label} className="revenue-glass-card flex min-w-0 items-center gap-1.5 px-2 py-1.5">
            <item.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium uppercase text-muted-foreground">{item.label}</p>
              <p className="truncate text-[13px] font-semibold leading-tight">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
