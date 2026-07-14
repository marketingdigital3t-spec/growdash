import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
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
import { format } from "date-fns";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Button } from "@/components/ui/button";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardGrid, buildWidgetFromDef } from "@/components/dashboard/grid/DashboardGrid";
import { AddWidgetDialog } from "@/components/dashboard/grid/AddWidgetDialog";
import { FALLBACK_DASHBOARD_VIEW_ID, useGlobalView, useSaveView } from "@/hooks/useDashboardViews";
import { useIsMaster } from "@/hooks/useIsMaster";
import { Pencil, Check } from "lucide-react";

const Index = () => {
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    try { return localStorage.getItem("dash:account") || "all"; } catch { return "all"; }
  });
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

  const { data: adAccounts = [] } = useAdAccounts();
  const { data: campaigns = [] } = useCampaigns(selectedAccount === "all" ? undefined : selectedAccount);
  const { data: products = [] } = useProducts();
  const { data: insights = [], isLoading, refetch } = useInsights({
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
    startDate,
    endDate,
    enabled: true,
  });
  // Universo estável de campanhas com veiculação no período/conta — não muda quando
  // o usuário marca/desmarca campanhas, para que o popover continue listando todas.
  const { data: campaignPickerInsights = [] } = useInsights({
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    startDate,
    endDate,
    enabled: true,
  });
  const { data: sales = [] } = useSales({
    startDate,
    endDate,
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
  });
  const { data: rdDeals = [] } = useRDDealsForPeriod({
    startDate,
    endDate,
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
  });
  const { data: alerts = [] } = useAlerts(true);
  const syncMeta = useSyncMeta();

  const { data: activeView } = useGlobalView();
  const { data: isMaster = false } = useIsMaster();
  const saveView = useSaveView();
  const canEditDashboard = Boolean(
    isMaster && activeView && activeView.id !== FALLBACK_DASHBOARD_VIEW_ID,
  );

  useEffect(() => {
    try { localStorage.setItem("dash:account", selectedAccount); } catch {}
  }, [selectedAccount]);
  useEffect(() => {
    try { localStorage.setItem("dash:campaigns", JSON.stringify(selectedCampaignIds)); } catch {}
  }, [selectedCampaignIds]);

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

  function handleAddWidget(def: any) {
    if (!activeView || !canEditDashboard) return;
    const built = buildWidgetFromDef(def.type, activeView.layout || []);
    if (!built) return;
    const nextWidgets = [...(activeView.widgets || []), built.widget];
    const nextLayout = [...(activeView.layout || []), built.layout];
    saveView.mutate({ id: activeView.id, layout: nextLayout, widgets: nextWidgets });
  }

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral financeira e de performance</p>
          </div>
          <Button onClick={() => { setEditingSale(null); setSalesDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Registrar Venda
          </Button>
        </div>
      </MotionItem>

      <MotionItem>
        <div className="flex flex-wrap items-center gap-3">
          <DateFilterBar
            preset={preset}
            onPresetChange={setPreset}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            startDate={startDate}
            endDate={endDate}
            adAccounts={adAccounts.map((a) => ({ id: a.id, name: a.name }))}
            selectedAccount={selectedAccount}
            onAccountChange={(id) => { setSelectedAccount(id); setSelectedCampaignIds([]); }}
            campaigns={(() => {
              const spendByCamp = new Map<string, number>();
              const imprByCamp = new Map<string, number>();
              for (const r of campaignPickerInsights as any[]) {
                if (!r.campaign_id) continue;
                spendByCamp.set(r.campaign_id, (spendByCamp.get(r.campaign_id) || 0) + (r.spend ?? 0));
                imprByCamp.set(r.campaign_id, (imprByCamp.get(r.campaign_id) || 0) + (r.impressions ?? 0));
              }
              return (campaigns || [])
                .filter((c: any) => (spendByCamp.get(c.id) || 0) > 0 || (imprByCamp.get(c.id) || 0) > 0)
                .map((c: any) => ({ id: c.id, name: c.name, spend: spendByCamp.get(c.id) || 0 }))
                .sort((a, b) => b.spend - a.spend)
                .map(({ id, name }) => ({ id, name }));
            })()}
            selectedCampaignIds={selectedCampaignIds}
            onCampaignIdsChange={setSelectedCampaignIds}
            onRefresh={handleSync}
            isRefreshing={syncMeta.isPending || isLoading}
          />
        </div>
      </MotionItem>

      {canEditDashboard && activeView && (
        <MotionItem>
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant={isEditing ? "default" : "outline"}
              onClick={() => setIsEditing((b) => !b)}
              className="gap-1.5"
            >
              {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {isEditing ? "Concluir edição" : "Editar dashboard"}
            </Button>
          </div>
        </MotionItem>
      )}

      {activeView && (
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
            view={activeView}
            isEditing={isEditing && canEditDashboard}
            onChange={(layout, widgets) => {
              if (!canEditDashboard) return;
              saveView.mutate({ id: activeView.id, layout, widgets });
            }}
            onAddClick={() => setAddOpen(true)}
            onEditSale={(s) => { setEditingSale(s); setSalesDialogOpen(true); }}
          />
        </DashboardProvider>
      )}

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
