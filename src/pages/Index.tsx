import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { SalesDialog } from "@/components/dashboard/SalesDialog";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInsights } from "@/hooks/useInsights";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { useAlerts } from "@/hooks/useAlerts";
import { useSales, type Sale } from "@/hooks/useSales";
import { aggregateRevenueSources } from "@/lib/revenueAggregation";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod, useRDWonDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { filterOperationalRDDeals } from "@/lib/crmPipelineStages";
import { differenceInCalendarDays, format } from "date-fns";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Button } from "@/components/ui/button";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardGrid, buildWidgetFromDef } from "@/components/dashboard/grid/DashboardGrid";
import { FALLBACK_DASHBOARD_VIEW_ID, useGlobalView, useSaveView, type DashboardView } from "@/hooks/useDashboardViews";
import { usePermissions } from "@/hooks/usePermissions";
import { Pencil } from "lucide-react";
import { DashboardGlassStrip } from "@/components/dashboard/DashboardGlassStrip";
import { WIDGET_CATALOG } from "@/lib/widgetCatalog";
import { useDashboardEditor } from "@/contexts/DashboardEditorContext";
import { saleMatchesCampaign } from "@/lib/saleRevenue";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useToast } from "@/hooks/use-toast";

const MESSAGING_CONVERSATION_EVENT = "onsite_conversion.messaging_conversation_started_7d";
const NATIVE_FORM_LEAD_EVENT = "onsite_conversion.lead_grouped";

const Index = () => {
  const {
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate,
    endDate,
    adAccountId: selectedAccount,
    setAdAccountId: setSelectedAccount,
    businessUnitId,
    segment,
  } = useGlobalFilters();
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("dash:campaigns");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftView, setDraftView] = useState<DashboardView | null>(null);
  const originalViewRef = useRef<DashboardView | null>(null);
  const { setEditor } = useDashboardEditor();
  const { toast } = useToast();

  const { data: adAccounts = [], isLoading: loadingAdAccounts } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, segment]);
  const visibleAccountIds = useMemo(() => new Set(visibleAccounts.map((account) => account.id)), [visibleAccounts]);
  const visibleAccountIdList = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);
  const isRDAccountScopeReady = selectedAccount !== "all" || (!loadingAdAccounts && visibleAccountIdList.length > 0);
  const { data: campaigns = [] } = useCampaigns(selectedAccount === "all" ? undefined : selectedAccount);
  const { data: products = [] } = useProducts();
  // Universo estável de campanhas com veiculação no período/conta — não muda quando
  // o usuário marca/desmarca campanhas, para que o popover continue listando todas.
  // O filtro por campanha é aplicado em memória porque este universo completo já é
  // obrigatório para o seletor; assim evitamos uma segunda consulta idêntica ao banco.
  const { data: allInsights = [], isLoading } = useInsights({
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
  // O Dashboard separa duas leituras do RD: pipeline pelo período de criação
  // e vendas pelo momento do fechamento. A leitura de vendas é explícita para
  // não depender do carregamento completo do Kanban e não misturar registros
  // financeiros extras ao total de negócios ganhos.
  const { data: rdDeals = [] } = useRDDealsForPeriod({
    startDate,
    endDate,
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    adAccountIds: selectedAccount === "all" ? visibleAccountIdList : undefined,
    enabled: isRDAccountScopeReady,
  });
  const { data: rdWonDeals = [] } = useRDWonDealsForPeriod({
    startDate,
    endDate,
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    adAccountIds: selectedAccount === "all" ? visibleAccountIdList : undefined,
    enabled: isRDAccountScopeReady,
  });
  const { data: rdFunnels = [] } = useRDFunnels();
  const { data: alerts = [] } = useAlerts();
  const syncMeta = useSyncMeta();

  const { data: activeView } = useGlobalView();
  const { canEdit: canEditWorkspace } = usePermissions();
  const saveView = useSaveView();
  const canEditDashboard = Boolean(
    canEditWorkspace && activeView && activeView.id !== FALLBACK_DASHBOARD_VIEW_ID,
  );

  useEffect(() => {
    try { localStorage.setItem("dash:campaigns", JSON.stringify(selectedCampaignIds)); } catch {}
  }, [selectedCampaignIds]);

  useEffect(() => {
    // A lista fica vazia antes da primeira resposta. Não transforme essa fase
    // transitória em "Todas as contas", pois isso troca a base de cálculo do
    // dashboard e da previsão sem uma ação do usuário.
    if (loadingAdAccounts || visibleAccounts.length === 0) return;
    if (selectedAccount !== "all" && !visibleAccounts.some((a) => a.id === selectedAccount)) {
      setSelectedAccount("all");
    }
  }, [loadingAdAccounts, visibleAccounts, selectedAccount, setSelectedAccount]);

  const visiblePickerInsights = useMemo(() => allInsights.filter((row) => visibleAccountIds.has(row.ad_account_id)), [allInsights, visibleAccountIds]);
  const dashboardInsights = useMemo(() => selectedCampaignIds.length
    ? visiblePickerInsights.filter((row) => selectedCampaignIds.includes(row.campaign_id))
    : visiblePickerInsights, [selectedCampaignIds, visiblePickerInsights]);
  const visibleCampaigns = useMemo(() => campaigns.filter((campaign: any) => visibleAccountIds.has(campaign.ad_account_id)), [campaigns, visibleAccountIds]);
  const operationalRDDeals = useMemo(() => filterOperationalRDDeals(rdDeals, rdFunnels), [rdDeals, rdFunnels]);
  const operationalRDWonDeals = useMemo(() => filterOperationalRDDeals(rdWonDeals, rdFunnels), [rdFunnels, rdWonDeals]);
  const operationalWonDealIds = useMemo(() => new Set(
    operationalRDWonDeals.map((deal) => deal.rd_deal_id).filter(Boolean),
  ), [operationalRDWonDeals]);
  // useSales preserva a última resposta durante uma troca de conta para evitar
  // um flash de zero. Reaplique o escopo aqui: enquanto a nova resposta não
  // chega, nenhuma venda da conta anterior pode entrar nos KPIs ou previsão.
  const unitSales = useMemo(() => sales.filter((sale) => !!sale.ad_account_id
    && visibleAccountIds.has(sale.ad_account_id)
    && (selectedAccount === "all" || sale.ad_account_id === selectedAccount)), [sales, selectedAccount, visibleAccountIds]);
  // No Dashboard de contas integradas, "venda" é a negociação efetivamente
  // ganha no RD. Registros financeiros sem um negócio ganho correspondente
  // ficam no Financeiro, mas não podem alterar KPIs de CRM, conversão ou ROAS.
  const operationalUnitSales = useMemo(() => unitSales.filter((sale) =>
    sale.status !== "confirmed" || (!!sale.rd_deal_id && operationalWonDealIds.has(sale.rd_deal_id)),
  ), [operationalWonDealIds, unitSales]);
  const selectedCampaigns = useMemo(
    () => visibleCampaigns.filter((campaign: any) => selectedCampaignIds.includes(campaign.id)),
    [selectedCampaignIds, visibleCampaigns],
  );
  const dashboardSales = useMemo(() => selectedCampaignIds.length
    ? operationalUnitSales.filter((sale) => selectedCampaigns.some((campaign: any) => saleMatchesCampaign(sale, {
      id: campaign.id,
      name: campaign.name,
      ad_account_id: campaign.ad_account_id,
    })))
    : operationalUnitSales, [operationalUnitSales, selectedCampaignIds.length, selectedCampaigns]);
  const dashboardDeals = useMemo(() => operationalRDDeals.filter((deal) => !!deal.ad_account_id
    && visibleAccountIds.has(deal.ad_account_id)
    && (selectedAccount === "all" || deal.ad_account_id === selectedAccount)), [operationalRDDeals, selectedAccount, visibleAccountIds]);
  const dashboardRevenueDeals = useMemo(() => operationalRDWonDeals.filter((deal) => !!deal.ad_account_id
    && visibleAccountIds.has(deal.ad_account_id)
    && (selectedAccount === "all" || deal.ad_account_id === selectedAccount)), [operationalRDWonDeals, selectedAccount, visibleAccountIds]);
  // Total de vendas e faturamento do Dashboard são sempre os negócios ganhos
  // do RD dentro do período. Os lançamentos financeiros seguem disponíveis em
  // Financeiro e no detalhamento de pagamento, mas não podem elevar o KPI de
  // vendas acima da quantidade real de negociações ganhas.
  const glassSales = aggregateRevenueSources([], dashboardRevenueDeals);
  const glassSpend = dashboardInsights.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const glassLeadsFromInsights = dashboardInsights.reduce((sum, row) => sum + Number(row.leads || 0), 0);
  const dashboardActionAdIds = useMemo(() => Array.from(new Set(dashboardInsights.map((row) => row.ad_id).filter(Boolean))), [dashboardInsights]);
  const dashboardActionAccountMap = useMemo(() => Object.fromEntries(dashboardInsights.map((row) => [row.ad_id, row.ad_account_id])), [dashboardInsights]);
  const { data: dashboardActionData } = useActionTotalsByAds(dashboardActionAdIds, startDate, endDate, dashboardActionAccountMap);
  const glassConversations = dashboardActionData?.totals?.[MESSAGING_CONVERSATION_EVENT] || 0;
  const glassForms = Math.min(glassLeadsFromInsights, dashboardActionData?.totals?.[NATIVE_FORM_LEAD_EVENT] || 0);
  const leadBreakdown = useMemo(() => ({ forms: glassForms, site: Math.max(0, glassLeadsFromInsights - glassForms), conversations: glassConversations, total: glassLeadsFromInsights + glassConversations }), [glassConversations, glassForms, glassLeadsFromInsights]);
  const glassLeads = leadBreakdown.total;
  const glassCpl = glassLeads > 0 ? glassSpend / glassLeads : 0;
  const glassRoas = glassSpend > 0 ? glassSales.totalNet / glassSpend : 0;
  const periodDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
  const forecast30 = glassSales.totalNet / periodDays * 30;

  const handleSync = () => {
    // A mutation já invalida as consultas de insights ao terminar. Refazer a
    // consulta antes e depois da sincronização só competia por rede e fazia o
    // dashboard trocar desnecessariamente para estado de carregamento.
    syncMeta.mutate({
      adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    });
  };

  const cloneView = useCallback((view: DashboardView): DashboardView => ({
    ...view,
    layout: JSON.parse(JSON.stringify(view.layout || [])),
    widgets: JSON.parse(JSON.stringify(view.widgets || [])),
  }), []);

  const beginDashboardEdit = useCallback(() => {
    if (!activeView || !canEditDashboard) return;
    const original = cloneView(activeView);
    originalViewRef.current = original;
    setDraftView(cloneView(original));
    setIsEditing(true);
  }, [activeView, canEditDashboard, cloneView]);

  const cancelDashboardEdit = useCallback(() => {
    setDraftView(null);
    originalViewRef.current = null;
    setIsEditing(false);
    setEditor(null);
  }, [setEditor]);

  const resetDashboardEdit = useCallback(() => {
    if (originalViewRef.current) setDraftView(cloneView(originalViewRef.current));
  }, [cloneView]);

  const toggleDashboardWidget = useCallback((type: string) => {
    setDraftView((current) => {
      if (!current) return current;
      if (type.startsWith("widget:")) {
        const id = type.slice("widget:".length);
        return {
          ...current,
          widgets: current.widgets.filter((widget) => widget.id !== id),
          layout: current.layout.filter((item) => item.i !== id),
        };
      }
      const catalogType = type.startsWith("add:") ? type.slice("add:".length) : type;
      const matching = current.widgets.filter((widget) => widget.type === catalogType);
      if (matching.length) {
        const ids = new Set(matching.map((widget) => widget.id));
        return { ...current, widgets: current.widgets.filter((widget) => !ids.has(widget.id)), layout: current.layout.filter((item) => !ids.has(item.i)) };
      }
      const built = buildWidgetFromDef(catalogType, current.layout || []);
      if (!built) return current;
      return { ...current, widgets: [...current.widgets, built.widget], layout: [...current.layout, built.layout] };
    });
  }, []);

  const saveDashboardEdit = useCallback(() => {
    if (!draftView || !canEditDashboard) return;
    saveView.mutate({ id: draftView.id, layout: draftView.layout, widgets: draftView.widgets }, {
      onSuccess: () => {
        setDraftView(null);
        originalViewRef.current = null;
        setIsEditing(false);
        setEditor(null);
      },
      onError: (error) => {
        toast({
          title: "Não foi possível salvar o dashboard",
          description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      },
    });
  }, [canEditDashboard, draftView, saveView, setEditor, toast]);

  const editorItems = useMemo(() => {
    const removable = (draftView?.widgets ?? [])
      .filter((widget) => widget.type !== "default_block")
      .map((widget) => {
        const definition = WIDGET_CATALOG.find((item) => item.type === widget.type);
        return {
          type: `widget:${widget.id}`,
          title: widget.title || definition?.title || "Métrica",
          description: definition?.description || "Bloco individual do dashboard.",
          category: definition?.category || "KPI",
          enabled: true,
        };
      });
    const available = WIDGET_CATALOG
      .filter((item) => !item.system)
      .map((item) => ({
        type: `add:${item.type}`,
        title: `Adicionar ${item.title}`,
        description: item.description,
        category: "Adicionar",
        enabled: false,
      }));
    return [...removable, ...available];
  }, [draftView?.widgets]);

  useEffect(() => {
    if (!isEditing || !draftView) {
      setEditor(null);
      return;
    }
    setEditor({
      title: draftView.name || "Dashboard",
      items: editorItems,
      saving: saveView.isPending,
      onToggle: toggleDashboardWidget,
      onReset: resetDashboardEdit,
      onCancel: cancelDashboardEdit,
      onSave: saveDashboardEdit,
    });
    return () => setEditor(null);
  }, [cancelDashboardEdit, draftView, editorItems, isEditing, resetDashboardEdit, saveDashboardEdit, saveView.isPending, setEditor, toggleDashboardWidget]);

  return (
    <MotionPage className="dashboard-page mx-auto w-full min-w-0 max-w-[1680px] space-y-4 px-1 sm:space-y-6 sm:px-2">
      <MotionItem className="mx-3">
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

      <MotionItem className="mx-3">
        <div className="flex flex-col gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <DateFilterBar
              preset={preset}
              onPresetChange={setPreset}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              startDate={startDate}
              endDate={endDate}
              adAccounts={visibleAccounts.map((a) => ({ id: a.id, name: a.name }))}
              selectedAccount={selectedAccount}
              onAccountChange={(id) => { setSelectedAccount(id); setSelectedCampaignIds([]); }}
              campaigns={(() => {
                const spendByCamp = new Map<string, number>();
                const imprByCamp = new Map<string, number>();
                for (const r of visiblePickerInsights as any[]) {
                  if (!r.campaign_id) continue;
                  spendByCamp.set(r.campaign_id, (spendByCamp.get(r.campaign_id) || 0) + (r.spend ?? 0));
                  imprByCamp.set(r.campaign_id, (imprByCamp.get(r.campaign_id) || 0) + (r.impressions ?? 0));
                }
                return visibleCampaigns
                  .filter((c: any) => (spendByCamp.get(c.id) || 0) > 0 || (imprByCamp.get(c.id) || 0) > 0)
                  .map((c: any) => ({ id: c.id, name: c.name, spend: spendByCamp.get(c.id) || 0 }))
                  .sort((a, b) => b.spend - a.spend)
                  .map(({ id, name }) => ({ id, name }));
              })()}
              selectedCampaignIds={selectedCampaignIds}
              onCampaignIdsChange={setSelectedCampaignIds}
              onRefresh={handleSync}
              isRefreshing={syncMeta.isPending || isLoading}
              showSummary={false}
            />
          </div>

          {canEditDashboard && activeView && !isEditing && (
            <Button
              size="sm"
              variant="outline"
              onClick={beginDashboardEdit}
              className="w-full shrink-0 gap-1.5 lg:w-auto"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar dashboard
            </Button>
          )}
        </div>
      </MotionItem>

      <div className="mx-3">
        <DashboardGlassStrip revenue={glassSales.totalNet} spend={glassSpend} leads={glassLeads} leadsBreakdown={leadBreakdown} cpl={glassCpl} roas={glassRoas} forecast30={forecast30} sales={glassSales.totalQuantity} />
      </div>

      {(isEditing ? draftView : activeView) && (
        <DashboardProvider
          value={{
            startDate,
            endDate,
            adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
            insights: dashboardInsights,
            sales: dashboardSales,
            rdDeals: dashboardDeals,
            revenueDeals: dashboardRevenueDeals,
            alerts,
            campaigns: visibleCampaigns,
            adAccounts: visibleAccounts,
            products,
            isLoading,
            leadBreakdown,
          }}
        >
          <DashboardGrid
            view={(isEditing ? draftView : activeView)!}
            isEditing={isEditing && canEditDashboard}
            onChange={(layout, widgets) => {
              if (!canEditDashboard || !isEditing) return;
              setDraftView((current) => current ? { ...current, layout, widgets } : current);
            }}
            onEditSale={(s) => { setEditingSale(s); setSalesDialogOpen(true); }}
          />
        </DashboardProvider>
      )}

      {salesDialogOpen && <SalesDialog
          open
          onOpenChange={(o) => { setSalesDialogOpen(o); if (!o) setEditingSale(null); }}
          editingSale={editingSale}
        />}
    </MotionPage>
  );
};

export default Index;
