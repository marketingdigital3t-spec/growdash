import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { SalesDialog } from "@/components/dashboard/SalesDialog";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInsights } from "@/hooks/useInsights";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { useAlerts } from "@/hooks/useAlerts";
import { dedupeCanonicalSales, useSales, type Sale } from "@/hooks/useSales";
import { aggregateRevenueSources } from "@/lib/revenueAggregation";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod, useRDWonDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { excludedOperationalRDDealIds, filterOperationalRDDeals } from "@/lib/crmPipelineStages";
import { differenceInCalendarDays, format } from "date-fns";
import { businessDateKey } from "@/lib/businessDate";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Button } from "@/components/ui/button";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardGrid, buildWidgetFromDef } from "@/components/dashboard/grid/DashboardGrid";
import { FALLBACK_DASHBOARD_VIEW_ID, useGlobalView, useSaveView, type DashboardView } from "@/hooks/useDashboardViews";
import { usePermissions } from "@/hooks/usePermissions";
import { DashboardGlassStrip } from "@/components/dashboard/DashboardGlassStrip";
import { WIDGET_CATALOG } from "@/lib/widgetCatalog";
import { useDashboardEditor } from "@/contexts/DashboardEditorContext";
import { saleMatchesCampaign } from "@/lib/saleRevenue";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useMetaTrafficMetrics } from "@/hooks/useMetaTrafficMetrics";
import { NO_LINKED_RD_FUNNEL_SCOPE_ID } from "@/lib/rdAccountScope";
import { useToast } from "@/hooks/use-toast";
import { DashboardReferenceDeck } from "@/components/dashboard/DashboardReferenceDeck";
import { TrafficClassAlerts } from "@/components/dashboard/TrafficClassAlerts";
import { useEventClasses } from "@/hooks/useEventClasses";


const Index = () => {
  const {
    startDate,
    endDate,
    adAccountId: selectedAccount,
    setAdAccountId: setSelectedAccount,
    adAccountIds: selectedAccountIds,
    funnelIds: selectedFunnelIds,
    businessUnitId,
    segment,
  } = useGlobalFilters();
  // O Dashboard usa exclusivamente a barra global do shell para calendário,
  // contas Meta e funis RD. Não mantenha uma segunda cópia de filtros locais.
  const selectedCampaignIds = useMemo<string[]>(() => [], []);
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftView, setDraftView] = useState<DashboardView | null>(null);
  const originalViewRef = useRef<DashboardView | null>(null);
  const { setEditor } = useDashboardEditor();
  const { toast } = useToast();

  const { data: adAccounts = [], isLoading: loadingAdAccounts } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId
    // An explicit account selection is authoritative for Meta facts. Do not
    // discard its rows because the account has no unit yet (or belongs to a
    // different segment); the segment filter only applies to the unselected
    // consolidated view.
    ? adAccounts.filter((account) => selectedAccountIds.length
      ? selectedAccountIds.includes(account.id)
      : account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, selectedAccountIds, segment]);
  const visibleAccountIds = useMemo(() => new Set(visibleAccounts.map((account) => account.id)), [visibleAccounts]);
  const visibleAccountIdList = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);
  // A seleção explícita é uma fronteira de dados. Só usamos todas as contas
  // visíveis quando o usuário realmente deixou o seletor em "Todas".
  const scopedAccountIds = useMemo(
    () => selectedAccountIds.length ? selectedAccountIds : visibleAccountIdList,
    [selectedAccountIds, visibleAccountIdList],
  );
  const { data: campaigns = [] } = useCampaigns(selectedAccount === "all" ? undefined : selectedAccount);
  const { data: products = [] } = useProducts();
  const { data: rdFunnels = [], isLoading: loadingRDFunnels } = useRDFunnels();
  const isRDScopeReady = !loadingRDFunnels;
  const scopedRDfunnelIds = useMemo(() => {
    const active = rdFunnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id);
    return selectedFunnelIds.length
      ? selectedFunnelIds.filter((id) => id === NO_LINKED_RD_FUNNEL_SCOPE_ID || active.some((funnel) => funnel.id === id))
      : active.map((funnel) => funnel.id);
  }, [rdFunnels, selectedFunnelIds]);
  // Universo estável de campanhas com veiculação no período/conta — não muda quando
  // o usuário marca/desmarca campanhas, para que o popover continue listando todas.
  // O filtro por campanha é aplicado em memória porque este universo completo já é
  // obrigatório para o seletor; assim evitamos uma segunda consulta idêntica ao banco.
  const { data: allInsights = [], isLoading } = useInsights({
    adAccountId: selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined,
    adAccountIds: selectedAccountIds.length > 1 ? selectedAccountIds : undefined,
    attributionWindowsByAccount: Object.fromEntries(visibleAccounts.map((account) => [account.id, account.attribution_window || "account_default"])),
    startDate,
    endDate,
    enabled: true,
  });
  const dashboardMeta = useMetaTrafficMetrics({
    adAccountIds: selectedAccountIds.length ? selectedAccountIds : scopedAccountIds,
    campaignIds: selectedCampaignIds.length ? selectedCampaignIds : undefined,
    startDate: businessDateKey(startDate),
    endDate: businessDateKey(endDate),
  }, !loadingAdAccounts);
  const { data: sales = [] } = useSales({
    startDate,
    endDate,
    funnelIds: scopedRDfunnelIds,
    adAccountId: selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined,
    adAccountIds: selectedAccountIds.length > 1 ? selectedAccountIds : undefined,
  });
  // O Dashboard separa duas leituras do RD: pipeline pelo período de criação
  // e vendas pelo momento do fechamento. A leitura de vendas é explícita para
  // não depender do carregamento completo do Kanban e não misturar registros
  // financeiros extras ao total de negócios ganhos.
  const { data: rdDeals = [] } = useRDDealsForPeriod({
    startDate,
    endDate,
    adAccountIds: scopedAccountIds,
    funnelIds: scopedRDfunnelIds,
    enabled: isRDScopeReady,
  });
  const { data: rdWonDeals = [] } = useRDWonDealsForPeriod({
    startDate,
    endDate,
    adAccountIds: scopedAccountIds,
    funnelIds: scopedRDfunnelIds,
    enabled: isRDScopeReady,
  });
  const { data: alerts = [] } = useAlerts();
  const { data: eventClasses = [] } = useEventClasses();
  const syncMeta = useSyncMeta();

  const dashboardScopeKey = useMemo(() => {
    const windows = visibleAccounts
      .filter((account) => !selectedAccountIds.length || selectedAccountIds.includes(account.id))
      .map((account) => `${account.id}:${account.attribution_window || "account_default"}`)
      .sort()
      .join(",");
    return `${(selectedAccountIds.length ? selectedAccountIds : scopedAccountIds).slice().sort().join(",")}|${businessDateKey(startDate)}|${businessDateKey(endDate)}|${windows}`;
  }, [endDate, scopedAccountIds, selectedAccountIds, startDate, visibleAccounts]);

  const { data: activeView } = useGlobalView();
  const { canEdit: canEditWorkspace } = usePermissions();
  const saveView = useSaveView();
  const canEditDashboard = Boolean(
    canEditWorkspace && activeView && activeView.id !== FALLBACK_DASHBOARD_VIEW_ID,
  );

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
  const excludedRDDealIds = useMemo(
    () => excludedOperationalRDDealIds([...rdDeals, ...rdWonDeals], rdFunnels),
    [rdDeals, rdFunnels, rdWonDeals],
  );
  const activeScopedFunnelIds = useMemo(() => new Set(scopedRDfunnelIds), [scopedRDfunnelIds]);
  // `sales` é a fonte canônica de vendas, receita, reembolso e chargeback.
  // Uma venda RD histórica pode não ter `ad_account_id`, mas ainda pertence à
  // conta pelo funil. Incluí-la por esse vínculo evita que Dashboard e Análise
  // de Funis exibam totais diferentes no mesmo período.
  const canonicalUnitSales = useMemo(() => dedupeCanonicalSales(sales.filter((sale) => {
    if (sale.rd_deal_id && excludedRDDealIds.has(sale.rd_deal_id)) return false;
    if (sale.ad_account_id) return visibleAccountIds.has(sale.ad_account_id)
      && (selectedAccountIds.length === 0 || selectedAccountIds.includes(sale.ad_account_id));
    return !!sale.rd_funnel_id && activeScopedFunnelIds.has(sale.rd_funnel_id);
  })), [activeScopedFunnelIds, excludedRDDealIds, sales, selectedAccountIds, visibleAccountIds]);
  const selectedCampaigns = useMemo(
    () => visibleCampaigns.filter((campaign: any) => selectedCampaignIds.includes(campaign.id)),
    [selectedCampaignIds, visibleCampaigns],
  );
  const dashboardSales = useMemo(() => selectedCampaignIds.length
    ? canonicalUnitSales.filter((sale) => selectedCampaigns.some((campaign: any) => saleMatchesCampaign(sale, {
      id: campaign.id,
      name: campaign.name,
      ad_account_id: campaign.ad_account_id,
    })))
    : canonicalUnitSales, [canonicalUnitSales, selectedCampaignIds.length, selectedCampaigns]);
  const dashboardDeals = useMemo(() => operationalRDDeals.filter((deal) => !!deal.rd_funnel_id && activeScopedFunnelIds.has(deal.rd_funnel_id)), [activeScopedFunnelIds, operationalRDDeals]);
  const dashboardRevenueDeals = useMemo(() => operationalRDWonDeals.filter((deal) => !!deal.rd_funnel_id && activeScopedFunnelIds.has(deal.rd_funnel_id)), [activeScopedFunnelIds, operationalRDWonDeals]);
  // O Dashboard e a Análise de Funis usam a mesma fonte canônica. Os ganhos
  // do RD abaixo ficam apenas como reconciliação para registros que ainda não
  // chegaram a `sales`; uma venda de checkout nunca é descartada por o RD
  // ainda não ter atualizado a etapa.
  const glassSales = aggregateRevenueSources(dashboardSales, dashboardRevenueDeals);
  const hasCanonicalMetaRows = dashboardMeta.data.rowCount > 0;
  const hasMetaSnapshot = hasCanonicalMetaRows || dashboardInsights.length > 0;
  const glassSpend = hasCanonicalMetaRows ? dashboardMeta.data.spend : dashboardInsights.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const dashboardActionAdIds = useMemo(() => Array.from(new Set(dashboardInsights.map((row) => row.ad_id).filter(Boolean))), [dashboardInsights]);
  const dashboardActionAccountMap = useMemo(() => Object.fromEntries(dashboardInsights.map((row) => [row.ad_id, row.ad_account_id])), [dashboardInsights]);
  const { data: dashboardActionData } = useActionTotalsByAds(
    dashboardActionAdIds,
    startDate,
    endDate,
    dashboardActionAccountMap,
    { adAccountIds: selectedAccountIds.length ? selectedAccountIds : visibleAccountIdList, campaignIds: selectedCampaignIds.length ? selectedCampaignIds : undefined, attributionWindowsByAccount: Object.fromEntries(visibleAccounts.map((account) => [account.id, account.attribution_window || "account_default"])) },
  );
  const dashboardActions = useMemo(() => dashboardActionData?.metaLeadActions || { forms: 0, site: 0, conversations: 0, total: 0 }, [dashboardActionData?.metaLeadActions]);
  const glassConversations = hasCanonicalMetaRows ? dashboardMeta.data.conversations : dashboardActions.conversations;
  const glassForms = hasCanonicalMetaRows ? dashboardMeta.data.formLeads : dashboardActions.forms;
  const glassSite = hasCanonicalMetaRows ? dashboardMeta.data.siteLeads : dashboardActions.site;
  const leadBreakdown = useMemo(() => ({ forms: glassForms, site: glassSite, conversations: glassConversations, total: glassForms + glassSite + glassConversations }), [glassConversations, glassForms, glassSite]);
  const glassLeads = leadBreakdown.total;
  const glassCpl = glassLeads > 0 ? glassSpend / glassLeads : 0;
  const glassRoas = glassSpend > 0 ? glassSales.totalNet / glassSpend : 0;
  const glassImpressions = hasCanonicalMetaRows ? dashboardMeta.data.impressions : dashboardInsights.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const glassClicks = hasCanonicalMetaRows ? dashboardMeta.data.clicks : dashboardInsights.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const periodDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
  const forecast30 = glassSales.totalNet / periodDays * 30;

  const handleSync = useCallback(() => {
    // A mutation já invalida as consultas de insights ao terminar. Refazer a
    // consulta antes e depois da sincronização só competia por rede e fazia o
    // dashboard trocar desnecessariamente para estado de carregamento.
    const syncStart = businessDateKey(startDate);
    const syncEnd = businessDateKey(endDate);
    syncMeta.mutate({
      adAccountId: selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined,
      adAccountIds: selectedAccountIds.length > 1 || selectedAccountIds.length === 0 ? scopedAccountIds : undefined,
      startDate: syncStart,
      endDate: syncEnd,
      includeBreakdowns: true,
      breakdownStartDate: syncStart,
      breakdownEndDate: syncEnd,
      force: true,
    });
  }, [endDate, scopedAccountIds, selectedAccountIds, startDate, syncMeta]);

  // A newly connected account can legitimately have no local rows until its
  // first reconciliation. Force one scoped sync once per account/period so the
  // dashboard never settles permanently on a misleading all-zero snapshot.
  const autoSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingAdAccounts || isLoading || dashboardMeta.isLoading || syncMeta.isPending || scopedAccountIds.length === 0) return;
    const scopeNeedsSync = !dashboardMeta.data.available || dashboardMeta.data.status === "stale" || dashboardMeta.data.status === "partial";
    if (!scopeNeedsSync || autoSyncKeyRef.current === dashboardScopeKey) return;
    autoSyncKeyRef.current = dashboardScopeKey;
    const timer = window.setTimeout(() => handleSync(), 180);
    return () => window.clearTimeout(timer);
  }, [dashboardMeta.data.available, dashboardMeta.data.status, dashboardMeta.isLoading, dashboardScopeKey, handleSync, isLoading, loadingAdAccounts, scopedAccountIds.length, syncMeta.isPending]);

  const cloneView = useCallback((view: DashboardView): DashboardView => ({
    ...view,
    layout: JSON.parse(JSON.stringify(view.layout || [])),
    widgets: JSON.parse(JSON.stringify(view.widgets || [])),
  }), []);

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

      <div className="mx-3">
        <DashboardGlassStrip revenue={glassSales.totalGross} spend={glassSpend} leads={glassLeads} leadsBreakdown={leadBreakdown} cpl={glassCpl} roas={glassRoas} forecast30={forecast30} sales={glassSales.totalQuantity} loading={isLoading || dashboardMeta.isLoading || syncMeta.isPending} hasSnapshot={hasMetaSnapshot && !dashboardMeta.isLoading} unavailableReason={dashboardMeta.data.unavailableReason} />
      </div>

      <div className="mx-3">
        <DashboardReferenceDeck impressions={glassImpressions} clicks={glassClicks} leads={glassLeads} clients={glassSales.totalQuantity} roas={glassRoas} cpl={glassCpl} loading={isLoading || dashboardMeta.isLoading || syncMeta.isPending} hasSnapshot={hasMetaSnapshot && !dashboardMeta.isLoading} unavailableReason={dashboardMeta.data.unavailableReason} />
      </div>

      <div className="mx-3">
        <TrafficClassAlerts classes={eventClasses} insights={dashboardInsights} />
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
            metaAvailability: {
              spend: hasCanonicalMetaRows || dashboardInsights.length > 0,
              reason: hasCanonicalMetaRows || dashboardInsights.length > 0 ? null : dashboardMeta.data.unavailableReason,
            },
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
