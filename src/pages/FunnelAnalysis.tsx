import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, subDays } from "date-fns";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDDeals, useRDClosedDeals, useFunnelStagesForIds, useRDDealStageHistory, computeFunnelAnalytics, rdDealWonDate } from "@/hooks/useRDDeals";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FunnelKPIs } from "@/components/funnel-analysis/FunnelKPIs";
import { FunnelStageDistribution } from "@/components/funnel-analysis/FunnelStageDistribution";
import { FunnelStageConversion } from "@/components/funnel-analysis/FunnelStageConversion";
import { FunnelLeadsEvolution } from "@/components/funnel-analysis/FunnelLeadsEvolution";
import { FunnelBottlenecks } from "@/components/funnel-analysis/FunnelBottlenecks";
import { FunnelSourceTable } from "@/components/funnel-analysis/FunnelSourceTable";
import { FunnelLostReasons } from "@/components/funnel-analysis/FunnelLostReasons";
import { FunnelStateMap } from "@/components/funnel-analysis/FunnelStateMap";
import { FunnelConversionHeatmap } from "@/components/funnel-analysis/FunnelConversionHeatmap";
import { FunnelSalesAttribution } from "@/components/funnel-analysis/FunnelSalesAttribution";
import { RefreshCw, Filter, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRDHealthCheck } from "@/hooks/useRDHealthCheck";
import { useInsights } from "@/hooks/useInsights";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { computeFunnelMediaMetrics } from "@/lib/funnelMediaMetrics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";
import { useSales } from "@/hooks/useSales";
import { filterCanonicalFunnelSales } from "@/lib/funnelRevenue";
import { excludedOperationalRDDealIds, filterOperationalRDDeals, filterOperationalRDFunnelStages } from "@/lib/crmPipelineStages";
import { useMetaTrafficMetrics } from "@/hooks/useMetaTrafficMetrics";
import { getMetaSyncRange } from "@/lib/metaSyncRange";
import { businessDateKey } from "@/lib/businessDate";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { buildAttributionWindowsByAccount } from "@/lib/metaAttributionScope";
import { CampaignResultsTable } from "@/components/dashboard/CampaignResultsTable";
import { CampaignMultiSelect } from "@/components/dashboard/CampaignMultiSelect";
import { AskAICard } from "@/components/dashboard/AskAICard";
import { FunnelAudienceProfile } from "@/components/funnel-analysis/FunnelAudienceProfile";
import { FunnelOpportunityProfile } from "@/components/funnel-analysis/FunnelOpportunityProfile";

const blockHelp = {
  media: ["Meta Ads × RD Station", "Compara investimento e resultados da Meta com os leads e vendas encontrados no RD Station para a mesma seleção.", "Use a cobertura para identificar diferenças de atribuição, UTMs ou sincronização entre as fontes."],
  distribution: ["Distribuição por etapa do funil", "Mostra quantos leads estão em cada etapa do RD, sua participação, tempo médio e valor em negociação."],
  conversion: ["Taxa de avanço entre etapas", "Exige histórico de movimentações do RD. Enquanto a integração fornecer apenas a etapa atual, este bloco não estima conversões ou perdas."],
  evolution: ["Evolução do funil", "Exibe a variação diária de leads, oportunidades e vendas no período selecionado."],
  bottlenecks: ["Gargalos do funil", "Mostra somente negócios atualmente parados por faixa de tempo. Não infere perdas entre etapas sem o histórico de movimentações do RD."],
  sources: ["Origem dos leads", "Compara volume, vendas, conversão e receita por origem para revelar os canais de maior qualidade."],
  losses: ["Motivos de perda", "Agrupa os motivos registrados no RD para mostrar por que as negociações não avançaram."],
  insights: ["Insights automáticos", "Transforma padrões do funil em observações acionáveis sobre origem, gargalos, região e tempo parado."],
  states: ["Mapa por estado", "Distribui leads e conversões geograficamente para identificar regiões com maior volume e eficiência."],
  weekdays: ["Dias que mais convertem", "Compara conversões e receita por dia da semana usando a data dos eventos do RD."],
  hours: ["Melhor período do dia", "Compara manhã, tarde, noite e madrugada; clique em um período para detalhar as vendas por hora."],
  attribution: ["Vendas por campanha e criativo", "Mostra exatamente quais UTMs de campanha e criativo chegaram até uma venda confirmada no RD.", "Use apenas linhas com atribuição identificada para decidir escala; corrija UTMs antes de concluir que uma peça não vende."],
} as const;

function HelpBlock({ help, children, className }: { help: readonly string[]; children: React.ReactNode; className?: string }) {
  return (
    <MetricHelpTooltip title={help[0]} description={help[1]} detail={help[2]} className={className ?? "h-full"} showHint>
      {children}
    </MetricHelpTooltip>
  );
}

export default function FunnelAnalysis() {
  const { adAccountIds, funnelIds: selectedFunnelIds, setFunnelIds: setSelectedFunnelIds, businessUnitId, segment, preset, setPreset, customRange, setCustomRange, startDate, endDate } = useGlobalFilters();
  const { data: adAccounts = [] } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => adAccountIds.length
      ? adAccountIds.includes(account.id)
      : account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccountIds, adAccounts, businessUnitId, segment]);
  const integratedAccountIds = useMemo(
    () => new Set(visibleAccounts.map((account) => account.id)),
    [visibleAccounts],
  );
  const selectedAccountIds = useMemo(
    () => adAccountIds.filter((accountId) => integratedAccountIds.has(accountId)),
    [adAccountIds, integratedAccountIds],
  );
  const selectedAccountIdSet = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);
  const allAccountsSelected = selectedAccountIds.length === 0;
  const selectedMetaScope = useMemo(() => {
    const scoped = selectedAccountIds.length
      ? visibleAccounts.filter((account) => selectedAccountIdSet.has(account.id))
      : visibleAccounts;
    const windows = Array.from(new Set(scoped.map((account) => account.attribution_window || "account_default")));
    const timezones = Array.from(new Set(scoped.map((account) => account.timezone_name || "America/Sao_Paulo")));
    return {
      attributionWindow: windows.length === 1 ? windows[0] : "account_default",
      timezone: timezones.length === 1 ? timezones[0] : "account",
    };
  }, [selectedAccountIdSet, selectedAccountIds.length, visibleAccounts]);
  const { data: funnels = [], isLoading: loadingFunnels } = useRDFunnels();
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const selectedCampaign = selectedCampaigns.length === 1 ? selectedCampaigns[0] : "all";
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const syncMeta = useSyncMeta();

  // RD é uma fonte independente de Meta. Funis ativos continuam disponíveis
  // mesmo quando ainda não possuem uma conta de anúncios vinculada.
  const activeFunnels = useMemo(
    () => funnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id),
    [funnels],
  );
  const selectedFunnelIdSet = useMemo(() => new Set(selectedFunnelIds), [selectedFunnelIds]);
  const allFunnelsSelected = selectedFunnelIds.length === 0;
  // Meta e RD têm escopos independentes: a conta de anúncios nunca escolhe
  // ou limita automaticamente o funil CRM.
  const scopedActiveFunnels = useMemo(
    () => allFunnelsSelected ? activeFunnels : activeFunnels.filter((funnel) => selectedFunnelIdSet.has(funnel.id)),
    [activeFunnels, allFunnelsSelected, selectedFunnelIdSet],
  );
  useEffect(() => {
    // Remove selections for funnels that were deactivated or deleted.
    if (!loadingFunnels && selectedFunnelIds.length) {
      const valid = selectedFunnelIds.filter((id) => activeFunnels.some((funnel) => funnel.id === id));
      if (valid.length !== selectedFunnelIds.length) setSelectedFunnelIds(valid);
    }
  }, [activeFunnels, loadingFunnels, selectedFunnelIds, setSelectedFunnelIds]);
  const funnelId = selectedFunnelIds.length === 1 ? selectedFunnelIds[0] : "";
  const funnelScopeIds = useMemo(
    () => scopedActiveFunnels.map((funnel) => funnel.id),
    [scopedActiveFunnels],
  );
  const effectiveAdAccountId = selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined;
  const effectiveAdAccountIds = selectedAccountIds.length > 1 ? selectedAccountIds : undefined;
  const insightScopeAccountIds = useMemo(
    () => selectedAccountIds.length ? selectedAccountIds : Array.from(integratedAccountIds),
    [integratedAccountIds, selectedAccountIds],
  );
  const insightAttributionWindowsByAccount = useMemo(
    () => buildAttributionWindowsByAccount(visibleAccounts, insightScopeAccountIds),
    [insightScopeAccountIds, visibleAccounts],
  );

  // "Todas as contas" é uma escolha válida e não pode ser regravada pelo
  // carregamento de funis. Alterar o filtro global aqui fazia o Select alternar
  // entre "Todas" e a primeira conta retornada, reiniciando as consultas e
  // causando o piscar relatado. A conta efetiva é usada apenas para reconciliar
  // a análise detalhada com o funil encontrado, sem mudar a escolha do usuário.

  const { data: stages = [], isLoading: loadingStages } = useFunnelStagesForIds(funnelScopeIds);
  const { data: deals = [], isLoading, refetch } = useRDDeals({
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    source: selectedSource,
    campaigns: selectedCampaigns,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    includeHistory: true,
    enabled: funnelScopeIds.length > 0,
  });
  // Funis RD são independentes da Meta: o recorte usa somente os funis ativos
  // selecionados e o período/filtros do CRM.
  const { data: periodDeals = [], isLoading: loadingPeriodDeals, error: periodDealsError } = useRDDeals({
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    source: selectedSource,
    campaigns: selectedCampaigns,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    enabled: funnelScopeIds.length > 0,
  });
  // Os filtros precisam vir do conjunto completo do período. Usar `deals`
  // aqui fazia uma opção desaparecer depois que outro filtro era aplicado.
  // Quando todos os filtros estão em "all", o React Query reutiliza esta
  // mesma consulta e não há uma segunda requisição.
  const { data: filterDeals = [], isLoading: loadingFilterDeals } = useRDDeals({
    funnelIds: funnelScopeIds,
    // Filtros devem listar todos os valores que existem no pipeline, não só
    // os valores de leads recém-criados.
    includeHistory: true,
    enabled: funnelScopeIds.length > 0,
  });
  const { data: closedDeals = [], isLoading: loadingClosedDeals } = useRDClosedDeals({
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    source: selectedSource,
    campaigns: selectedCampaigns,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    includeHistory: true,
    enabled: funnelScopeIds.length > 0,
  });
  const { data: periodClosedDeals = [], isLoading: loadingPeriodClosedDeals } = useRDClosedDeals({
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    source: selectedSource,
    campaigns: selectedCampaigns,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    enabled: funnelScopeIds.length > 0,
  });
  const { data: stageHistory = [], isLoading: loadingStageHistory } = useRDDealStageHistory({
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    enabled: funnelScopeIds.length > 0,
  });
  const { data: periodSales = [], isLoading: loadingPeriodSales } = useSales({
    startDate,
    endDate,
    funnelIds: funnelScopeIds,
  });

  // A mesma regra operacional do CRM vale para relatórios: o lote legado de
  // "Leads Antigos do Junior" do funil Aluna não pode reaparecer ao escolher
  // todas as contas e inflar distribuição, KPIs ou conversão.
  const operationalDeals = useMemo(() => filterOperationalRDDeals(deals, activeFunnels), [activeFunnels, deals]);
  const operationalPeriodDeals = useMemo(() => filterOperationalRDDeals(periodDeals, activeFunnels), [activeFunnels, periodDeals]);
  const operationalFilterDeals = useMemo(() => filterOperationalRDDeals(filterDeals, activeFunnels), [activeFunnels, filterDeals]);
  const operationalClosedDeals = useMemo(() => filterOperationalRDDeals(closedDeals, activeFunnels), [activeFunnels, closedDeals]);
  const operationalPeriodClosedDeals = useMemo(() => filterOperationalRDDeals(periodClosedDeals, activeFunnels), [activeFunnels, periodClosedDeals]);
  const operationalStages = useMemo(() => filterOperationalRDFunnelStages(stages, activeFunnels), [activeFunnels, stages]);
  const excludedDealIds = useMemo(() => excludedOperationalRDDealIds(deals, activeFunnels), [activeFunnels, deals]);

  const sources = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.utm_source).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const rdCampaigns = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.utm_campaign).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const states = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.lead_state).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const owners = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.deal_owner_name).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const products = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.rd_product_name).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);

  useEffect(() => {
    if (loadingFilterDeals) return;
    if (selectedCampaigns.some((campaign) => !rdCampaigns.includes(campaign))) setSelectedCampaigns([]);
    if (selectedSource !== "all" && !sources.includes(selectedSource)) setSelectedSource("all");
    if (selectedState !== "all" && !states.includes(selectedState)) setSelectedState("all");
    if (selectedOwner !== "all" && !owners.includes(selectedOwner)) setSelectedOwner("all");
    if (selectedProduct !== "all" && !products.includes(selectedProduct)) setSelectedProduct("all");
  }, [loadingFilterDeals, owners, products, rdCampaigns, selectedCampaigns, selectedOwner, selectedProduct, selectedSource, selectedState, sources, states]);

  const baseAnalytics = useMemo(() => computeFunnelAnalytics(operationalDeals, operationalStages, operationalClosedDeals), [operationalClosedDeals, operationalDeals, operationalStages]);
  const periodBaseAnalytics = useMemo(
    () => computeFunnelAnalytics(operationalPeriodDeals, operationalStages, operationalPeriodClosedDeals, { startDate, endDate }, stageHistory),
    [endDate, operationalPeriodClosedDeals, operationalPeriodDeals, operationalStages, stageHistory, startDate],
  );
  // RD é a fonte canônica do funil: vendas, receita, etapas e evolução usam
  // o mesmo snapshot de negócios ganhos. A tabela `sales` fica restrita à
  // atribuição de campanha/criativo, para não atrasar ou alterar os KPIs RD.
  const analytics = baseAnalytics;
  const periodAllowedDealIds = useMemo(
    () => selectedOwner === "all" ? undefined : new Set([...operationalPeriodDeals, ...operationalPeriodClosedDeals].map((deal) => deal.rd_deal_id)),
    [operationalPeriodClosedDeals, operationalPeriodDeals, selectedOwner],
  );
  const periodScopedDealIds = useMemo(
    () => new Set([...operationalPeriodDeals, ...operationalPeriodClosedDeals].map((deal) => deal.rd_deal_id)),
    [operationalPeriodClosedDeals, operationalPeriodDeals],
  );
  const periodStateByDealId = useMemo(
    () => new Map([...operationalPeriodDeals, ...operationalPeriodClosedDeals].map((deal) => [deal.rd_deal_id, deal.lead_state])),
    [operationalPeriodClosedDeals, operationalPeriodDeals],
  );
  const periodFunnelSales = useMemo(() => filterCanonicalFunnelSales(periodSales, {
    funnelIds: funnelScopeIds,
    scopedDealIds: periodScopedDealIds,
    source: selectedSource,
    campaigns: selectedCampaigns,
    state: selectedState,
    product: selectedProduct,
    allowedDealIds: periodAllowedDealIds,
    stateByDealId: periodStateByDealId,
    excludedDealIds,
  }), [excludedDealIds, funnelScopeIds, periodAllowedDealIds, periodSales, periodScopedDealIds, periodStateByDealId, selectedCampaigns, selectedProduct, selectedSource, selectedState]);
  const periodAnalytics = periodBaseAnalytics;
  const previousAvgDaysToConvert = useMemo(() => {
    const span = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
    const previousStart = subDays(startDate, span);
    const previousEnd = subDays(startDate, 1);
    const values = operationalClosedDeals.filter((deal) => {
      const wonDate = rdDealWonDate(deal);
      if (!wonDate || !deal.lead_created_at) return false;
      const closed = new Date(wonDate);
      return closed >= previousStart && closed <= new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate(), 23, 59, 59, 999);
    }).map((deal) => Math.max(0, (new Date(rdDealWonDate(deal)!).getTime() - new Date(deal.lead_created_at!).getTime()) / 86400000));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [endDate, operationalClosedDeals, startDate]);

  const { data: insightRows = [], isLoading: loadingInsights } = useInsights({
    // Always scope facts to internal account UUIDs; the same per-account
    // attribution windows are used by the canonical Meta KPI hook below.
    adAccountId: effectiveAdAccountId,
    adAccountIds: effectiveAdAccountIds || (selectedAccountIds.length === 0 ? insightScopeAccountIds : undefined),
    attributionWindow: selectedMetaScope.attributionWindow,
    attributionWindowsByAccount: insightAttributionWindowsByAccount,
    startDate,
    endDate,
    enabled: visibleAccounts.length > 0,
  });
  const { data: campaignRows = [] } = useCampaigns(effectiveAdAccountId, effectiveAdAccountIds);
  const { data: hierarchyRows = [] } = useQuery({
    queryKey: ["funnel-attribution-hierarchy", effectiveAdAccountId, effectiveAdAccountIds?.slice().sort().join(",")],
    enabled: visibleAccounts.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let query = (supabase as any)
        .from("ads")
        .select("id,name,adset_id,adsets!inner(id,name,campaign_id,campaigns!inner(id,name,ad_account_id))")
        .limit(10000);
      if (effectiveAdAccountIds?.length) query = query.in("adsets.campaigns.ad_account_id", effectiveAdAccountIds);
      else if (effectiveAdAccountId) query = query.eq("adsets.campaigns.ad_account_id", effectiveAdAccountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ad_id: String(row.id),
        ad_name: row.name || "",
        adset_name: row.adsets?.name || "",
        campaign_name: row.adsets?.campaigns?.name || "",
        campaign_id: row.adsets?.campaigns?.id || null,
        ad_account_id: row.adsets?.campaigns?.ad_account_id || null,
        adset_id: row.adset_id || row.adsets?.id || null,
        date: "",
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        ctr: 0,
        cpm: 0,
        frequency: 0,
        leads: 0,
        cpl: 0,
        conversion_rate: 0,
        efficiency_rate: 0,
        health_score: 0,
      }));
    },
  });
  const visibleCampaignRows = useMemo(
    () => campaignRows.filter((campaign) => integratedAccountIds.has(campaign.ad_account_id)),
    [campaignRows, integratedAccountIds],
  );
  const scopedInsights = useMemo(() => {
    const allowedAccountIds = allAccountsSelected ? integratedAccountIds : selectedAccountIdSet;
    // Mesmo que a política do banco permita consultar histórico legado, a
    // mídia exibida aqui deve pertencer exclusivamente às contas integradas.
    // O filtro `selectedCampaigns` é uma UTM do RD, não um ID de campanha Meta.
    // Comparar os nomes aproximados fazia a mídia sumir ou selecionar campanhas
    // erradas. Sem vínculo canônico salvo, mídia fica no escopo conta + período.
    return insightRows.filter((row) => !!row.ad_account_id && allowedAccountIds.has(row.ad_account_id));
  }, [allAccountsSelected, integratedAccountIds, insightRows, selectedAccountIdSet]);
  const breakdownAttributionByCampaign = useMemo(() => {
    const accountIds = allAccountsSelected ? integratedAccountIds : selectedAccountIdSet;
    const result: Record<string, string> = {};
    for (const campaign of visibleCampaignRows) {
      if (accountIds.has(campaign.ad_account_id)) {
        const account = visibleAccounts.find((item) => item.id === campaign.ad_account_id);
        result[String(campaign.id)] = account?.attribution_window || "account_default";
      }
    }
    for (const row of scopedInsights) {
      if (row.campaign_id && row.ad_account_id) {
        result[String(row.campaign_id)] = insightAttributionWindowsByAccount[row.ad_account_id] || "account_default";
      }
    }
    return result;
  }, [allAccountsSelected, insightAttributionWindowsByAccount, scopedInsights, selectedAccountIdSet, visibleAccounts, visibleCampaignRows, integratedAccountIds]);

  // O filtro de campanha do RD usa UTM e nem sempre tem o mesmo nome da
  // campanha na Meta. Use os IDs reais das campanhas visíveis e, como
  // Os filtros de campanha nesta tela são UTMs do RD. Não há vínculo canônico
  // UTM→Meta para inferir IDs comparando nomes; o perfil Meta respeita conta e
  // período e permanece independente do filtro CRM.
  const audienceCampaignIds = useMemo(() => {
    const accountIds = allAccountsSelected ? integratedAccountIds : selectedAccountIdSet;
    const candidates = visibleCampaignRows.filter((campaign: any) => accountIds.has(campaign.ad_account_id));
    const insightIds = scopedInsights
      .filter((row) => !!row.campaign_id && !!row.ad_account_id && accountIds.has(row.ad_account_id))
      .map((row) => String(row.campaign_id));
    const ids = candidates.map((campaign: any) => String(campaign.id)).concat(insightIds).filter(Boolean);
    return Array.from(new Set(ids));
  }, [allAccountsSelected, integratedAccountIds, scopedInsights, selectedAccountIdSet, visibleCampaignRows]);

  const actionScopeAccountIds = allAccountsSelected ? Array.from(integratedAccountIds) : selectedAccountIds;
  const funnelMeta = useMetaTrafficMetrics({
    adAccountIds: actionScopeAccountIds,
    startDate: businessDateKey(startDate),
    endDate: businessDateKey(endDate),
    attributionWindow: selectedMetaScope.attributionWindow,
    timezone: selectedMetaScope.timezone,
  }, visibleAccounts.length > 0);

  const mediaMetrics = useMemo(
    () => {
      // Use somente o adaptador canônico Meta. `insights.leads` é legado e não
      // pode substituir nem completar ações quando o snapshot estiver ausente.
      const mediaRows = funnelMeta.data.available ? [{
        spend: funnelMeta.data.spend,
        impressions: funnelMeta.data.impressions,
        reach: funnelMeta.data.reach,
        clicks: funnelMeta.data.clicks,
      }] : [];
      const computed = computeFunnelMediaMetrics(
      mediaRows as any,
      funnelMeta.data.conversations,
      periodAnalytics.totalLeads,
      periodAnalytics.conversions,
      periodAnalytics.revenue,
      funnelMeta.data.formLeads,
      funnelMeta.data.siteLeads,
      );
      return {
        ...computed,
        spend: funnelMeta.data.available ? funnelMeta.data.spend : 0,
        metaLeads: funnelMeta.data.available && funnelMeta.data.metricAvailability.leads?.available ? funnelMeta.data.leads : 0,
        rdCpl: funnelMeta.data.available && periodAnalytics.totalLeads > 0
          ? funnelMeta.data.spend / periodAnalytics.totalLeads
          : null,
        metaCpl: funnelMeta.data.available && funnelMeta.data.metricAvailability.leads?.available
          ? funnelMeta.data.cpl
          : null,
        cac: funnelMeta.data.available && periodAnalytics.conversions > 0
          ? funnelMeta.data.spend / periodAnalytics.conversions
          : null,
        // ROAS Meta is purchase value attributed by Meta / Meta spend. RD
        // revenue is shown separately and must not be relabeled as Meta ROAS.
        roas: funnelMeta.data.available && funnelMeta.data.metricAvailability.leads?.available
          ? funnelMeta.data.roas
          : null,
        salesConversionRate: funnelMeta.data.available && funnelMeta.data.metricAvailability.leads?.available
          ? computed.salesConversionRate
          : null,
      };
    },
    [funnelMeta.data, periodAnalytics.conversions, periodAnalytics.revenue, periodAnalytics.totalLeads],
  );
  const funnelTableInsights = useMemo(() => {
    const countedAds = new Set<string>();
    return scopedInsights.map((row) => {
      const adId = String(row.ad_id || "");
      const canonicalLeads = funnelMeta.data.leadBreakdownByAd[adId]?.totalLeads ?? 0;
      // CampaignResultsTable expects daily facts and sums them by ad. Put the
      // period-level canonical action total on one row only; never re-sum the
      // legacy `insights.leads` column or multiply an ad's actions by days.
      const leads = countedAds.has(adId) ? 0 : canonicalLeads;
      countedAds.add(adId);
      return { ...row, leads, form_leads: 0, site_leads: 0, conversations: 0 };
    });
  }, [funnelMeta.data.leadBreakdownByAd, scopedInsights]);

  async function handleSync() {
    if (!funnelId && visibleAccounts.length === 0) return;
    setSyncing(true);
    try {
      // A atualização manual deve ser rápida e previsível: reconcilia apenas
      // o período atualmente selecionado. O backfill histórico é executado
      // pelo job próprio e não deve bloquear o botão por dezenas de minutos.
      // A função ainda limita o início a 36 meses, que é o máximo aceito pela
      // Graph API da Meta.
      const metaSyncRange = getMetaSyncRange(new Date(), startDate, endDate);
      const funnelsToSync = scopedActiveFunnels;

      let metaResult: PromiseSettledResult<unknown>;
      try {
        metaResult = {
          status: "fulfilled",
          value: await syncMeta.mutateAsync({
            adAccountId: effectiveAdAccountId,
            adAccountIds: effectiveAdAccountIds,
            startDate: metaSyncRange.startDate,
            endDate: metaSyncRange.endDate,
            includeBreakdowns: true,
            breakdownStartDate: businessDateKey(startDate),
            breakdownEndDate: businessDateKey(endDate),
            force: true,
            attributionWindow: selectedMetaScope.attributionWindow,
            timezone: selectedMetaScope.timezone,
          }),
        };
      } catch (reason) {
        metaResult = { status: "rejected", reason };
      }

      const rdResults: PromiseSettledResult<unknown>[] = [];
      for (const funnel of funnelsToSync) {
        try {
          const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
            body: {
              funnel_id: funnel.id,
              analytics_mode: true,
              // A atualização manual precisa respeitar exatamente o período
              // visível no calendário. Enviar full_history sem as datas fazia
              // a Edge Function varrer o arquivo inteiro e misturar negócios
              // fora do escopo atual nos KPIs.
              full_history: false,
              start_date: businessDateKey(startDate),
              end_date: businessDateKey(endDate),
              // Manual refresh follows the same bounded recent-sync budget;
              // complete history is handled by the dedicated backfill path.
              max_pages: 10,
            },
          });
          if (error) {
            // O lock do RD é por funil. Um ciclo automático pode já estar
            // reconciliando o mesmo funil; isso não é falha nem motivo para
            // zerar o último snapshot visível.
            const httpStatus = Number((error as any)?.context?.status || (error as any)?.status || 0);
            const errorText = `${(error as any)?.message || ""} ${(error as any)?.context?.body || ""}`;
            if (httpStatus === 409 || /409|already.?running|sincroniza[cç][aã]o.*andamento/i.test(errorText)) {
              rdResults.push({ status: "fulfilled", value: { status: "running", message: "Este funil já está sendo sincronizado." } });
              continue;
            }
            const details = await edgeFunctionErrorDetails(error);
            throw new Error(formatEdgeFunctionError(details));
          }
          if (data?.status === "already_running") {
            rdResults.push({ status: "fulfilled", value: { status: "running", message: data.message } });
            continue;
          }
          if (data?.error || data?.success === false || data?.partial === true || (data?.status && data.status !== "success")) {
            const details = Array.isArray(data?.errors) && data.errors.length ? `: ${data.errors.join(" · ")}` : "";
            throw new Error(`${data?.error || data?.message || "Snapshot RD incompleto."}${details}`);
          }
          rdResults.push({ status: "fulfilled", value: data });
        } catch (reason) {
          rdResults.push({ status: "rejected", reason });
        }
      }

      const rdFailures = rdResults.filter((result) => result.status === "rejected");
      if (metaResult.status === "rejected" && rdFailures.length === rdResults.length) {
        throw metaResult.reason;
      }

      await queryClient.invalidateQueries({ queryKey: ["insights"] });
      await queryClient.invalidateQueries({ queryKey: ["funnel-audience-breakdowns"] });
      await queryClient.invalidateQueries({ queryKey: ["rd_deals"] });
      await queryClient.invalidateQueries({ queryKey: ["rd_closed_deals"] });
      await queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] });
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await refetch();
      // Quando o lock pertence ao ciclo automático, a função manual retorna
      // antes da escrita. Reconsulta o snapshot após a janela normal de uma
      // página RD, sem bloquear o usuário no botão.
      if (rdResults.some((result) => result.status === "fulfilled" && (result.value as any)?.status === "running")) {
        window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["rd_deals"] });
          void queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] });
          void queryClient.invalidateQueries({ queryKey: ["rd_closed_deals"] });
        }, 5_000);
      }

      const metaPartial = metaResult.status === "fulfilled" && Boolean((metaResult.value as any)?.status && (metaResult.value as any).status !== "success");
      const rdRunning = rdResults.some((result) => result.status === "fulfilled" && (result.value as any)?.status === "running");
      if (metaResult.status === "rejected" || metaPartial || rdFailures.length > 0 || rdRunning) {
        const metaMessage = metaResult.status === "rejected"
          ? (metaResult.reason instanceof Error ? metaResult.reason.message : String(metaResult.reason))
          : metaPartial
            ? ((metaResult.value as any)?.errors?.join(" · ") || "A Meta concluiu apenas parte da sincronização.")
            : "";
        const rdMessage = rdRunning
          ? "Um ciclo do RD já está em andamento; o snapshot anterior foi preservado e será atualizado automaticamente."
          : rdFailures
          .map((result) => result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : "")
          .filter(Boolean)
          .join(" · ");
        toast.warning(rdRunning && !rdFailures.length && metaResult.status === "fulfilled" && !metaPartial ? "RD em sincronização" : "Sincronização parcial", {
          description: [metaMessage && `Meta: ${metaMessage}`, rdMessage && `RD: ${rdMessage}`].filter(Boolean).join(" · "),
        });
      } else {
        toast.success(`Meta Ads e ${funnelsToSync.length} funil(is) do RD atualizados.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const noStages = !loadingStages && operationalStages.length === 0;

  return (
    <MotionPage className="gd-module-shell gd-funnel-analysis mx-auto max-w-[1700px] space-y-5">
      <MotionItem>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Análise de Funis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe a performance completa dos seus leads e funis de conversão com base nos estágios reais do RD.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MetaHealthBadge accounts={visibleAccounts} selectedIds={selectedAccountIds} />
            <RDHealthBadge />
            <Button onClick={handleSync} disabled={syncing || syncMeta.isPending || (!funnelId && visibleAccounts.length === 0)} variant="default" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing || syncMeta.isPending ? "animate-spin" : ""}`} />
              Sincronizar Meta + RD
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <div className="gd-filter-strip gd-funnel-filter-strip rounded-xl border border-border bg-card p-3 shadow-sm">
          <FilterSelect label="Origem" value={selectedSource} onChange={setSelectedSource} options={sources} />
          <CampaignMultiSelect campaigns={rdCampaigns.map((name) => ({ id: name, name }))} selectedIds={selectedCampaigns} onChange={setSelectedCampaigns} placeholder="Campanhas / UTM RD" className="gd-filter-control w-full bg-background/60 sm:w-[180px]" />
          <FilterSelect label="Estado" value={selectedState} onChange={setSelectedState} options={states} />
          <FilterSelect label="Responsável" value={selectedOwner} onChange={setSelectedOwner} options={owners} />
          <FilterSelect label="Produto" value={selectedProduct} onChange={setSelectedProduct} options={products} />
        </div>
      </MotionItem>

      {loadingFunnels || isLoading || loadingStages ? (
        <MotionItem>
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        </MotionItem>
      ) : (
        <>
          {(activeFunnels.length === 0 || noStages || operationalPeriodDeals.length === 0) && (
            <MotionItem>
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {activeFunnels.length === 0
                      ? "Nenhum funil RD ativo disponível."
                      : noStages
                        ? "Os estágios reais do funil ainda não foram sincronizados."
                        : "Nenhuma negociação encontrada no histórico sincronizado."}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    O histórico completo do RD será exibido assim que a sincronização for concluída. O período acima continua sendo usado para comparar a mídia Meta.
                  </p>
                </div>
                <Button onClick={handleSync} disabled={syncing || (!funnelId && visibleAccounts.length === 0)} size="sm" variant="outline" className="shrink-0">
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                    {activeFunnels.length === 0 ? "Configurar ou sincronizar" : "Sincronizar agora"}
                </Button>
              </div>
            </MotionItem>
          )}

          <MotionItem>
            <div className="mb-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Escopos separados:</span> a conta e o período selecionados definem a mídia Meta; o filtro Campanhas / UTM RD afeta somente os negócios do CRM e não tenta adivinhar correspondência por nome. {analytics.totalLeads.toLocaleString("pt-BR")} negociação(ões) carregada(s) no histórico RD.
            </div>
            <FunnelKPIs
              a={periodAnalytics}
              rdLeads={periodAnalytics.totalLeads}
              rdLeadsLoading={loadingPeriodDeals}
              rdLeadsError={!!periodDealsError}
              trafficSpend={mediaMetrics.spend}
              metaLeads={mediaMetrics.metaLeads}
              metaLeadsAvailable={funnelMeta.data.available && (funnelMeta.data.metricAvailability.leads?.available ?? false)}
              metaLeadsLoading={funnelMeta.actionsLoading}
              trafficLoading={funnelMeta.insightsLoading}
              trafficUnavailable={!funnelMeta.data.available}
              trafficReason={funnelMeta.data.unavailableReason}
              cpl={mediaMetrics.metaCpl}
              rdCpl={mediaMetrics.rdCpl}
              metaCplLoading={funnelMeta.actionsLoading}
              cac={mediaMetrics.cac}
              roas={mediaMetrics.roas}
              salesConversionRate={funnelMeta.data.available && funnelMeta.data.metricAvailability.leads?.available ? mediaMetrics.salesConversionRate : null}
              previousAvgDaysToConvert={previousAvgDaysToConvert}
            />
          </MotionItem>

          <MotionItem>
            <div className="gd-aligned-grid grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <HelpBlock help={blockHelp.bottlenecks}><FunnelBottlenecks a={periodAnalytics} /></HelpBlock>
              <HelpBlock help={blockHelp.distribution}><FunnelStageDistribution a={periodAnalytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem><HelpBlock help={blockHelp.conversion}><FunnelStageConversion a={periodAnalytics} /></HelpBlock></MotionItem>

          <MotionItem><HelpBlock help={blockHelp.evolution}><FunnelLeadsEvolution a={periodAnalytics} /></HelpBlock></MotionItem>

          <MotionItem>
            <div className="gd-aligned-grid grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <HelpBlock help={blockHelp.sources} className="h-auto"><FunnelSourceTable a={periodAnalytics} /></HelpBlock>
              <HelpBlock help={blockHelp.losses} className="h-auto"><FunnelLostReasons a={periodAnalytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem>
            <HelpBlock help={blockHelp.states}><FunnelStateMap a={periodAnalytics} /></HelpBlock>
          </MotionItem>

          <MotionItem>
              <FunnelAudienceProfile deals={operationalDeals} periodDeals={operationalPeriodDeals} campaignIds={audienceCampaignIds} accountIds={allAccountsSelected ? Array.from(integratedAccountIds) : selectedAccountIds} startDate={startDate} endDate={endDate} metaLeads={funnelMeta.data.metricAvailability.leads?.available ? funnelMeta.data.leads : undefined} attributionWindowByCampaign={breakdownAttributionByCampaign} />
            </MotionItem>

          <MotionItem>
            <div className="gd-aligned-grid grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <HelpBlock help={["Mapa de calor de conversão", "Cruza o dia da semana e a faixa de horário do fechamento para revelar o melhor momento de conversão."]} className="h-auto min-w-0"><FunnelConversionHeatmap closedDeals={operationalPeriodClosedDeals} /></HelpBlock>
              <HelpBlock help={blockHelp.attribution} className="h-auto min-w-0"><FunnelSalesAttribution sales={periodFunnelSales} deals={operationalPeriodDeals} insights={[...scopedInsights, ...hierarchyRows]} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem>
            <FunnelOpportunityProfile deals={operationalPeriodDeals} insights={[...scopedInsights, ...hierarchyRows]} campaignIds={audienceCampaignIds} startDate={startDate} endDate={endDate} attributionWindowByCampaign={breakdownAttributionByCampaign} />
          </MotionItem>

          <MotionItem>
            <section aria-label="Performance de campanhas e funil de mídia">
              <DashboardProvider value={{
                startDate,
                endDate,
                adAccountId: effectiveAdAccountId,
                insights: funnelTableInsights,
                sales: periodFunnelSales,
                rdDeals: operationalPeriodDeals,
                revenueDeals: operationalPeriodDeals,
                alerts: [],
                campaigns: visibleCampaignRows,
                adAccounts: visibleAccounts,
                isLoading: loadingInsights || funnelMeta.isLoading,
              }}>
                <div className="space-y-6">
                  {funnelMeta.actionsLoading
                    ? <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground" role="status">Aguardando confirmação das ações Meta para mostrar leads por campanha.</div>
                    : !funnelMeta.data.metricAvailability.leads?.available
                      ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300" role="status">Leads Meta indisponíveis neste recorte; não exibiremos o total legado de `insights.leads`. {funnelMeta.data.metricAvailability.leads?.reason || "Ações Meta ainda não confirmadas."}</div>
                      : <CampaignResultsTable />}
                  <AskAICard accountIds={actionScopeAccountIds} startDate={businessDateKey(startDate)} endDate={businessDateKey(endDate)} />
                </div>
              </DashboardProvider>
            </section>
          </MotionItem>
        </>
      )}
    </MotionPage>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="gd-filter-control w-full bg-background/60 sm:w-[160px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos · {label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RDHealthBadge() {
  const navigate = useNavigate();
  const { data, isLoading } = useRDHealthCheck();
  if (isLoading || !data) return null;
  const map = {
    ok: { Icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "Integração OK" },
    warning: { Icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Atenção" },
    error: { Icon: XCircle, cls: "bg-red-500/10 text-red-600 border-red-500/30", label: "Reconectar" },
  } as const;
  const { Icon, cls, label } = map[data.overall];
  return (
    <Badge
      variant="outline"
      className={`${cls} cursor-pointer gap-1.5 px-2.5 py-1`}
      onClick={() => navigate("/configuracoes#rd-health")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

type MetaHealthAccount = { id: string; name?: string | null; connection_status?: string | null; last_sync_error?: string | null; last_sync_success_at?: string | null };

function MetaHealthBadge({ accounts, selectedIds }: { accounts: MetaHealthAccount[]; selectedIds: string[] }) {
  const navigate = useNavigate();
  const scoped = selectedIds.length ? accounts.filter((account) => selectedIds.includes(account.id)) : accounts;
  if (!scoped.length) return null;
  const hasBlocked = scoped.some((account) => ["disconnected", "blocked", "expired", "invalid"].includes(String(account.connection_status)));
  const hasError = scoped.some((account) => ["error", "unknown"].includes(String(account.connection_status)) || Boolean(account.last_sync_error));
  const allConnected = scoped.every((account) => account.connection_status === "connected" && !account.last_sync_error);
  const state = allConnected ? "ok" : hasBlocked && !hasError ? "error" : "warning";
  const map = {
    ok: { Icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "Meta OK" },
    warning: { Icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Meta parcial" },
    error: { Icon: XCircle, cls: "bg-red-500/10 text-red-600 border-red-500/30", label: "Meta bloqueada" },
  } as const;
  const { Icon, cls, label } = map[state];
  return (
    <Badge variant="outline" className={`${cls} cursor-pointer gap-1.5 px-2.5 py-1`} onClick={() => navigate("/integracoes")}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
