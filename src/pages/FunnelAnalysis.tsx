import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, subDays } from "date-fns";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDDeals, useRDClosedDeals, useFunnelStagesForIds, computeFunnelAnalytics } from "@/hooks/useRDDeals";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { FunnelKPIs } from "@/components/funnel-analysis/FunnelKPIs";
import { FunnelStageDistribution } from "@/components/funnel-analysis/FunnelStageDistribution";
import { FunnelStageConversion } from "@/components/funnel-analysis/FunnelStageConversion";
import { FunnelLeadsEvolution } from "@/components/funnel-analysis/FunnelLeadsEvolution";
import { FunnelBottlenecks } from "@/components/funnel-analysis/FunnelBottlenecks";
import { FunnelSourceTable } from "@/components/funnel-analysis/FunnelSourceTable";
import { FunnelLostReasons } from "@/components/funnel-analysis/FunnelLostReasons";
import { FunnelStateMap } from "@/components/funnel-analysis/FunnelStateMap";
import { FunnelAutoInsights } from "@/components/funnel-analysis/FunnelAutoInsights";
import { FunnelConversionHeatmap } from "@/components/funnel-analysis/FunnelConversionHeatmap";
import { FunnelSuggestedActions } from "@/components/funnel-analysis/FunnelSuggestedActions";
import { FunnelMediaOverview } from "@/components/funnel-analysis/FunnelMediaOverview";
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
import { useQueryClient } from "@tanstack/react-query";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";
import { useSales } from "@/hooks/useSales";
import { filterCanonicalFunnelSales, reconcileFunnelRevenue } from "@/lib/funnelRevenue";
import { filterOperationalRDDeals } from "@/lib/crmPipelineStages";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { getMetaSyncRange } from "@/lib/metaSyncRange";

const MESSAGING_CONVERSATION_EVENT = "onsite_conversion.messaging_conversation_started_7d";

const blockHelp = {
  media: ["Meta Ads × RD Station", "Compara investimento e resultados da Meta com os leads e vendas encontrados no RD Station para a mesma seleção.", "Use a cobertura para identificar diferenças de atribuição, UTMs ou sincronização entre as fontes."],
  distribution: ["Distribuição por etapa do funil", "Mostra quantos leads estão em cada etapa do RD, sua participação, tempo médio e valor em negociação."],
  conversion: ["Taxa de avanço entre etapas", "Calcula a passagem entre etapas consecutivas e destaca onde o funil perde mais leads."],
  evolution: ["Evolução do funil", "Exibe a variação diária de leads, oportunidades e vendas no período selecionado."],
  bottlenecks: ["Gargalos do funil", "Aponta a maior queda de conversão e quantos leads estão parados há mais de 3, 7 e 15 dias."],
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
  const { adAccountId, setAdAccountId, businessUnitId, segment, preset, setPreset, customRange, setCustomRange, startDate, endDate } = useGlobalFilters();
  const { data: adAccounts = [] } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, segment]);
  const integratedAccountIds = useMemo(
    () => new Set(visibleAccounts.map((account) => account.id)),
    [visibleAccounts],
  );
  const { data: funnels = [], isLoading: loadingFunnels } = useRDFunnels(adAccountId === "all" ? undefined : adAccountId);
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const syncMeta = useSyncMeta();

  // A tabela do RD pode preservar vínculos antigos. A análise nunca pode
  // somar esses registros: somente funis ligados a contas Meta que ainda
  // existem na Growdash entram no escopo de “Todas as contas”.
  const activeFunnels = useMemo(
    () => funnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id && integratedAccountIds.has(funnel.ad_account_id)),
    [funnels, integratedAccountIds],
  );
  // Uma conta selecionada só pode consultar os funis vinculados ao seu UUID.
  // Fallback por nome/"primeiro funil" misturava a análise quando o vínculo de
  // uma conta estava ausente ou tinha nome parecido com outro.
  const selectedFunnelRecord = adAccountId === "all"
    ? undefined
    : activeFunnels.find((funnel) => funnel.ad_account_id === adAccountId);
  const funnelId = selectedFunnelRecord?.id || "";
  const funnelScopeIds = useMemo(
    () => adAccountId === "all" ? activeFunnels.map((funnel) => funnel.id) : funnelId ? [funnelId] : [],
    [activeFunnels, adAccountId, funnelId],
  );
  const effectiveAdAccountId = adAccountId === "all" ? undefined : adAccountId;

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
    campaign: selectedCampaign,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    includeHistory: true,
    enabled: funnelScopeIds.length > 0,
  });
  // Este recorte é usado somente para comparação temporal com Meta Ads. O
  // pipeline e os KPIs abaixo usam `deals`, que contém o histórico completo.
  const { data: periodDeals = [], isLoading: loadingPeriodDeals } = useRDDeals({
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    source: selectedSource,
    campaign: selectedCampaign,
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
    campaign: selectedCampaign,
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
    campaign: selectedCampaign,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    enabled: funnelScopeIds.length > 0,
  });
  const { data: historicalSales = [], isLoading: loadingHistoricalSales } = useSales({
    adAccountId: effectiveAdAccountId,
  });
  const { data: periodSales = [], isLoading: loadingPeriodSales } = useSales({
    startDate,
    endDate,
    adAccountId: effectiveAdAccountId,
  });

  // A mesma regra operacional do CRM vale para relatórios: o lote legado de
  // "Leads Antigos do Junior" do funil Aluna não pode reaparecer ao escolher
  // todas as contas e inflar distribuição, KPIs ou conversão.
  const operationalDeals = useMemo(() => filterOperationalRDDeals(deals, activeFunnels), [activeFunnels, deals]);
  const operationalPeriodDeals = useMemo(() => filterOperationalRDDeals(periodDeals, activeFunnels), [activeFunnels, periodDeals]);
  const operationalFilterDeals = useMemo(() => filterOperationalRDDeals(filterDeals, activeFunnels), [activeFunnels, filterDeals]);
  const operationalClosedDeals = useMemo(() => filterOperationalRDDeals(closedDeals, activeFunnels), [activeFunnels, closedDeals]);
  const operationalPeriodClosedDeals = useMemo(() => filterOperationalRDDeals(periodClosedDeals, activeFunnels), [activeFunnels, periodClosedDeals]);

  const sources = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.utm_source).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const campaigns = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.utm_campaign).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const states = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.lead_state).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const owners = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.deal_owner_name).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);
  const products = useMemo(() => Array.from(new Set(operationalFilterDeals.map((d) => d.rd_product_name).filter(Boolean) as string[])).sort(), [operationalFilterDeals]);

  useEffect(() => {
    if (loadingFilterDeals) return;
    if (selectedSource !== "all" && !sources.includes(selectedSource)) setSelectedSource("all");
    if (selectedCampaign !== "all" && !campaigns.includes(selectedCampaign)) setSelectedCampaign("all");
    if (selectedState !== "all" && !states.includes(selectedState)) setSelectedState("all");
    if (selectedOwner !== "all" && !owners.includes(selectedOwner)) setSelectedOwner("all");
    if (selectedProduct !== "all" && !products.includes(selectedProduct)) setSelectedProduct("all");
  }, [campaigns, loadingFilterDeals, owners, products, selectedCampaign, selectedOwner, selectedProduct, selectedSource, selectedState, sources, states]);

  const baseAnalytics = useMemo(() => computeFunnelAnalytics(operationalDeals, stages, operationalClosedDeals), [operationalClosedDeals, operationalDeals, stages]);
  const periodBaseAnalytics = useMemo(
    () => computeFunnelAnalytics(operationalPeriodDeals, stages, operationalPeriodClosedDeals),
    [operationalPeriodClosedDeals, operationalPeriodDeals, stages],
  );
  const allowedDealIds = useMemo(
    () => selectedOwner === "all" ? undefined : new Set(operationalDeals.map((deal) => deal.rd_deal_id)),
    [operationalDeals, selectedOwner],
  );
  const funnelSales = useMemo(() => filterCanonicalFunnelSales(historicalSales, {
    funnelIds: funnelScopeIds,
    source: selectedSource,
    campaign: selectedCampaign,
    state: selectedState,
    product: selectedProduct,
    allowedDealIds,
  }), [allowedDealIds, funnelScopeIds, historicalSales, selectedCampaign, selectedProduct, selectedSource, selectedState]);
  const analytics = useMemo(
    () => reconcileFunnelRevenue(baseAnalytics, funnelSales),
    [baseAnalytics, funnelSales],
  );
  const periodAllowedDealIds = useMemo(
    () => selectedOwner === "all" ? undefined : new Set(operationalPeriodDeals.map((deal) => deal.rd_deal_id)),
    [operationalPeriodDeals, selectedOwner],
  );
  const periodFunnelSales = useMemo(() => filterCanonicalFunnelSales(periodSales, {
    funnelIds: funnelScopeIds,
    source: selectedSource,
    campaign: selectedCampaign,
    state: selectedState,
    product: selectedProduct,
    allowedDealIds: periodAllowedDealIds,
  }), [funnelScopeIds, periodAllowedDealIds, periodSales, selectedCampaign, selectedProduct, selectedSource, selectedState]);
  const periodAnalytics = useMemo(
    () => reconcileFunnelRevenue(periodBaseAnalytics, periodFunnelSales),
    [periodBaseAnalytics, periodFunnelSales],
  );
  const previousAvgDaysToConvert = useMemo(() => {
    const span = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
    const previousStart = subDays(startDate, span);
    const previousEnd = subDays(startDate, 1);
    const values = operationalClosedDeals.filter((deal) => {
      if (!deal.closed_at || !deal.lead_created_at) return false;
      const closed = new Date(deal.closed_at);
      return closed >= previousStart && closed <= new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate(), 23, 59, 59, 999);
    }).map((deal) => Math.max(0, (new Date(deal.closed_at!).getTime() - new Date(deal.lead_created_at!).getTime()) / 86400000));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [endDate, operationalClosedDeals, startDate]);

  const { data: insightRows = [], isLoading: loadingInsights } = useInsights({
    // In "Todas as contas", undefined intentionally aggregates all accounts
    // authorized by RLS instead of silently selecting the first funnel.
    adAccountId: effectiveAdAccountId,
    startDate,
    endDate,
    enabled: visibleAccounts.length > 0,
  });

  const { scopedInsights, campaignWithoutMediaMatch } = useMemo(() => {
    const allowedAccountIds = adAccountId === "all" ? integratedAccountIds : new Set([adAccountId]);
    // Mesmo que a política do banco permita consultar histórico legado, a
    // mídia exibida aqui deve pertencer exclusivamente às contas integradas.
    const accountScopedInsights = insightRows.filter((row) => !!row.ad_account_id && allowedAccountIds.has(row.ad_account_id));
    if (selectedCampaign === "all") return { scopedInsights: accountScopedInsights, campaignWithoutMediaMatch: false };
    const campaign = selectedCampaign.trim().toLocaleLowerCase("pt-BR");
    const matches = accountScopedInsights.filter((row) => {
      const metaName = row.campaign_name.trim().toLocaleLowerCase("pt-BR");
      return metaName === campaign || metaName.includes(campaign) || campaign.includes(metaName);
    });
    // UTMs e campanhas Meta podem ter nomes diferentes. Exibir todas as
    // campanhas neste caso distorce investimento, CPL e ROAS do funil.
    return { scopedInsights: matches, campaignWithoutMediaMatch: matches.length === 0 };
  }, [adAccountId, integratedAccountIds, insightRows, selectedCampaign]);

  // O total de aquisição da Análise de Funis é uma métrica da Meta: cada
  // conversa iniciada por anúncio é um lead a ser trabalhado. Buscamos os
  // eventos apenas dos anúncios já delimitados pela conta, campanha e período.
  const actionAdIds = useMemo(
    () => Array.from(new Set(scopedInsights.map((insight) => insight.ad_id).filter(Boolean))),
    [scopedInsights],
  );
  const actionAccountMap = useMemo(
    () => Object.fromEntries(scopedInsights.map((insight) => [insight.ad_id, insight.ad_account_id])),
    [scopedInsights],
  );
  const { data: actionData, isLoading: loadingMetaActions } = useActionTotalsByAds(actionAdIds, startDate, endDate, actionAccountMap);

  const mediaMetrics = useMemo(
    () => computeFunnelMediaMetrics(
      scopedInsights,
      actionData?.totals?.[MESSAGING_CONVERSATION_EVENT] ?? 0,
      periodAnalytics.totalLeads,
      periodAnalytics.conversions,
      periodAnalytics.revenue,
    ),
    [actionData?.totals, periodAnalytics.conversions, periodAnalytics.revenue, periodAnalytics.totalLeads, scopedInsights],
  );

  async function handleSync() {
    if (!funnelId && visibleAccounts.length === 0) return;
    setSyncing(true);
    try {
      // A Meta aceita no máximo 37 meses. A reconciliação é independente do
      // filtro visual, mas fica nos 36 meses completos mais recentes para não
      // ser recusada pela API nem inverter o intervalo em filtros antigos.
      const metaSyncRange = getMetaSyncRange();
      const funnelsToSync = effectiveAdAccountId
        ? activeFunnels.filter((funnel) => funnel.ad_account_id === effectiveAdAccountId)
        : activeFunnels;

      let metaResult: PromiseSettledResult<unknown>;
      try {
        metaResult = {
          status: "fulfilled",
          value: await syncMeta.mutateAsync({
          adAccountId: effectiveAdAccountId,
          startDate: metaSyncRange.startDate,
          endDate: metaSyncRange.endDate,
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
              // Sem intervalo, a Edge Function percorre os segmentos aberto,
              // ganho, perdido e pausado até o histórico completo. Passar o
              // período do calendário aqui era a causa de negócios antigos
              // desaparecerem da análise.
              max_deals: 10000,
              max_pages: 50,
            },
          });
          if (error) {
            const details = await edgeFunctionErrorDetails(error);
            throw new Error(formatEdgeFunctionError(details));
          }
          if (data?.error) throw new Error(data.error);
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
      await queryClient.invalidateQueries({ queryKey: ["rd_deals"] });
      await queryClient.invalidateQueries({ queryKey: ["rd_closed_deals"] });
      await queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] });
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await refetch();

      if (metaResult.status === "rejected" || rdFailures.length > 0) {
        const metaMessage = metaResult.status === "rejected"
          ? (metaResult.reason instanceof Error ? metaResult.reason.message : String(metaResult.reason))
          : "";
        const rdMessage = rdFailures
          .map((result) => result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : "")
          .filter(Boolean)
          .join(" · ");
        toast.warning("Sincronização parcial", {
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

  const noStages = !loadingStages && stages.length === 0;

  return (
    <MotionPage className="gd-module-shell mx-auto max-w-[1700px] space-y-5">
      <MotionItem>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Análise de Funis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe a performance completa dos seus leads e funis de conversão com base nos estágios reais do RD.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HealthBadge />
            <Button onClick={handleSync} disabled={syncing || syncMeta.isPending || (!funnelId && visibleAccounts.length === 0)} variant="default" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing || syncMeta.isPending ? "animate-spin" : ""}`} />
              Sincronizar Meta + RD
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        {loadingInsights ? (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Carregando métricas da Meta…</div>
        ) : (
          <>
            <HelpBlock help={blockHelp.media}><FunnelMediaOverview metrics={mediaMetrics} /></HelpBlock>
            {campaignWithoutMediaMatch && <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground"><b className="text-amber-600 dark:text-amber-400">Campanha sem correspondência segura na Meta.</b><p className="mt-1">A mídia foi mantida em zero para não misturar campanhas. Ajuste o nome/UTM da campanha ou selecione “Todas as campanhas” para ver o total da conta.</p></div>}
          </>
        )}
      </MotionItem>

      <MotionItem>
        <div className="gd-filter-strip gd-funnel-filter-strip rounded-xl border border-border bg-card p-3 shadow-sm">
          <Select value={adAccountId} onValueChange={setAdAccountId}>
            <SelectTrigger className="gd-filter-control gd-filter-account w-full bg-background/60 sm:w-[230px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Conta de anúncio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {visibleAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <MetaDateRangePicker
            preset={preset}
            onPresetChange={setPreset}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            startDate={startDate}
            endDate={endDate}
            className="gd-filter-control gd-filter-date"
          />

          <FilterSelect label="Origem" value={selectedSource} onChange={setSelectedSource} options={sources} />
          <FilterSelect label="Campanha" value={selectedCampaign} onChange={setSelectedCampaign} options={campaigns} />
          <FilterSelect label="Estado" value={selectedState} onChange={setSelectedState} options={states} />
          <FilterSelect label="Responsável" value={selectedOwner} onChange={setSelectedOwner} options={owners} />
          <FilterSelect label="Produto" value={selectedProduct} onChange={setSelectedProduct} options={products} />
        </div>
      </MotionItem>

      {loadingFunnels || isLoading || loadingMetaActions || loadingPeriodDeals || loadingClosedDeals || loadingPeriodClosedDeals || loadingStages || loadingHistoricalSales || loadingPeriodSales ? (
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
                      ? "Nenhum funil RD vinculado para esta conta."
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
              <span className="font-semibold text-foreground">Histórico completo do RD:</span> {analytics.totalLeads.toLocaleString("pt-BR")} negociação(ões) carregada(s) {adAccountId === "all" ? `em ${funnelScopeIds.length} funil(is) conectado(s)` : "neste funil"}. Os KPIs e gráficos abaixo usam somente o período selecionado.
            </div>
            <FunnelKPIs
              a={periodAnalytics}
              metaLeads={mediaMetrics.metaLeads}
              trafficSpend={mediaMetrics.spend}
              cpl={mediaMetrics.metaCpl}
              cac={mediaMetrics.cac}
              salesConversionRate={mediaMetrics.salesConversionRate}
              previousAvgDaysToConvert={previousAvgDaysToConvert}
            />
          </MotionItem>

          <MotionItem><HelpBlock help={blockHelp.bottlenecks}><FunnelBottlenecks a={periodAnalytics} /></HelpBlock></MotionItem>

          <MotionItem><FunnelSuggestedActions a={periodAnalytics} /></MotionItem>

          <MotionItem>
            <div className="gd-aligned-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HelpBlock help={blockHelp.distribution}><FunnelStageDistribution a={periodAnalytics} /></HelpBlock>
              <HelpBlock help={blockHelp.conversion}><FunnelStageConversion a={periodAnalytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem><HelpBlock help={blockHelp.evolution}><FunnelLeadsEvolution a={periodAnalytics} /></HelpBlock></MotionItem>

          <MotionItem>
            <div className="gd-aligned-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
              <HelpBlock help={blockHelp.sources}><FunnelSourceTable a={periodAnalytics} /></HelpBlock>
              <HelpBlock help={blockHelp.losses}><FunnelLostReasons a={periodAnalytics} /></HelpBlock>
              <HelpBlock help={blockHelp.insights}><FunnelAutoInsights a={periodAnalytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem>
            <HelpBlock help={blockHelp.states}><FunnelStateMap a={periodAnalytics} /></HelpBlock>
          </MotionItem>

          <MotionItem>
            <div className="gd-aligned-grid grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <HelpBlock help={["Mapa de calor de conversão", "Cruza o dia da semana e a faixa de horário do fechamento para revelar o melhor momento de conversão."]}><FunnelConversionHeatmap closedDeals={operationalPeriodClosedDeals} /></HelpBlock>
              <HelpBlock help={blockHelp.attribution}><FunnelSalesAttribution sales={periodFunnelSales} /></HelpBlock>
            </div>
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

function HealthBadge() {
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
