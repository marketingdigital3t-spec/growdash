import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Columns3,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Send,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useProducts } from "@/hooks/useProducts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useRDIntegration } from "@/hooks/useRDIntegration";
import { useFunnelStagesForIds } from "@/hooks/useRDDeals";
import { classifyLead, dedupeRDDeals, type RDDealLite, useRDCRMDeals } from "@/hooks/useRDDealsForPeriod";
import { useCreateRDDealNote, useRDDealNotes } from "@/hooks/useRDDealNotes";
import { useSales } from "@/hooks/useSales";
import { AccountMultiSelect } from "@/components/dashboard/AccountMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getRDDealAmount } from "@/lib/rdDealAmount";
import { accountOpportunityFallback } from "@/lib/opportunityValueFallback";
import { crmEmptyState, crmPipelineEnabled } from "@/lib/crmAccess";
import { connectedRDFunnelIds } from "@/lib/crmFunnelScope";
import { excludedOperationalRDDealIds, isExcludedLegacyRannielyStage } from "@/lib/crmPipelineStages";
import { isRDDealInCrmPeriod } from "@/lib/crmDateScope";
import { aggregateRevenueSources } from "@/lib/revenueAggregation";
import { PageHeading } from "./shared";
import CrmAIWorkspace from "./CrmAIWorkspace";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");
const PAGE_SIZE = 50;
const BOARD_STEP = 50;
const MESSAGING_CONVERSATION_EVENT = "onsite_conversion.messaging_conversation_started_7d";

type CRMView = "board" | "list" | "ai";
type StatusFilter = "all" | "open" | "won" | "lost";

type PipelineStage = {
  id: string;
  name: string;
  order: number;
  won: boolean;
  lost: boolean;
  rdFunnelId?: string | null;
  rdStageId?: string | null;
};

// RD stage IDs are only unique within a pipeline. Keeping the funnel ID in
// the board key prevents stages from separate funnels being merged or moved
// by a local name-based heuristic when the user views more than one account.
function rdPipelineStageKey(rdFunnelId: string | null | undefined, rdStageId: string | null | undefined) {
  return `${rdFunnelId || "unassigned-funnel"}:${rdStageId || "no-stage"}`;
}

type CrmMetricCardProps = {
  source: string;
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone: "meta" | "rd" | "revenue" | "success";
};

function CrmMetricCard({ source, label, value, description, icon, tone: _tone }: CrmMetricCardProps) {
  return (
    <article className="gd-panel gd-metric-card gd-crm-metric-card min-w-0 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            {source}
          </span>
          <h3 className="mt-2 text-xs font-black uppercase tracking-[.08em] text-muted-foreground">{label}</h3>
        </div>
        <span className="gd-metric-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl">{icon}</span>
      </div>
      <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.35rem,2.25vw,1.9rem)] font-black tracking-tight text-foreground" title={value}>{value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-muted-foreground">{description}</p>
    </article>
  );
}

export default function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    adAccountId,
    setAdAccountId,
    adAccountIds,
    setAdAccountIds,
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate,
    endDate,
    businessUnitId,
    segment,
  } = useGlobalFilters();
  const accountFilter = adAccountIds.length === 1 ? adAccountIds[0] : undefined;
  const isConsolidatedView = adAccountIds.length !== 1;
  const { data: adAccounts = [] } = useAdAccounts();
  const availableAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, segment]);
  const availableAccountIds = useMemo(() => new Set(availableAccounts.map((account) => account.id)), [availableAccounts]);
  const availableAccountIdList = useMemo(() => availableAccounts.map((account) => account.id), [availableAccounts]);
  const { data: rdIntegration, isLoading: loadingRDIntegration } = useRDIntegration();
  const rdEnabled = rdIntegration?.is_active === true;
  // A conexão do RD pertence ao dono da conta/funil. Um gestor ou membro com
  // permissão de leitura não deve perder o pipeline apenas por não possuir
  // uma cópia pessoal do token. A consulta usa RLS e continua retornando
  // somente os funis atribuídos ao usuário atual.
  const canReadCrm = crmPipelineEnabled(!!user);
  const { data: funnelData = [], isLoading: loadingFunnels, isPlaceholderData: isPreviousFunnelScope } = useRDFunnels(accountFilter, canReadCrm);
  const {
    data: dealData = [],
    isLoading: loadingDeals,
    isFetching,
    isPlaceholderData: isPreviousDealScope,
    isError: dealsError,
    error: dealsQueryError,
    refetch: refetchDeals,
  } = useRDCRMDeals(
    accountFilter,
    canReadCrm && (!isConsolidatedView || availableAccountIdList.length > 0),
    isConsolidatedView ? availableAccountIdList : undefined,
  );
  const { data: salesData = [], isLoading: loadingSales, isPlaceholderData: isPreviousSalesScope } = useSales({ adAccountId: accountFilter, adAccountIds });
  const { data: insightData = [], isLoading: loadingMetaInsights, isPlaceholderData: isPreviousInsightScope } = useInsights({ adAccountId: accountFilter, adAccountIds, startDate, endDate });
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const [view, setView] = useState<CRMView>(() => {
    if (searchParams.get("tab") === "ai") return "ai";
    return window.localStorage.getItem("growdash:crm-view") === "list" ? "list" : "board";
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [owner, setOwner] = useState("all");
  const [selectedDeal, setSelectedDeal] = useState<RDDealLite | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [stageLimits, setStageLimits] = useState<Record<string, number>>({});

  // Query cache keeps the previous screen visible globally, which is useful
  // for a silent refresh of the same scope. A different account is a hard
  // boundary: displaying that previous account while the new query runs is
  // materially misleading in CRM. Fail closed until every account-scoped
  // source belongs to the selection.
  const isChangingAccountScope = isPreviousFunnelScope || isPreviousDealScope || isPreviousSalesScope || isPreviousInsightScope;
  const isLoadingSelectedScope = isChangingAccountScope || loadingDeals || loadingSales || loadingMetaInsights;
  const funnels = useMemo(() => isChangingAccountScope ? [] : funnelData, [funnelData, isChangingAccountScope]);
  const allDeals = useMemo(() => isChangingAccountScope ? [] : dealData, [dealData, isChangingAccountScope]);
  const canonicalSales = useMemo(() => isChangingAccountScope ? [] : salesData, [isChangingAccountScope, salesData]);
  const metaInsights = useMemo(() => isChangingAccountScope ? [] : insightData, [insightData, isChangingAccountScope]);

  useEffect(() => {
    if (adAccountId !== "all" && availableAccounts.length && !availableAccountIds.has(adAccountId)) setAdAccountId("all");
  }, [adAccountId, availableAccountIds, availableAccounts.length, setAdAccountId]);

  // Historical RD rows can remain in the database after a funnel is detached.
  // They are retained for audit, but must not create phantom columns or appear
  // in the operational CRM. The board has exactly the active RD funnels that
  // are still linked in Integrations.
  const connectedFunnels = useMemo(
    () => funnels.filter((funnel) => funnel.is_active && !!funnel.rd_funnel_id && availableAccountIds.has(funnel.ad_account_id)),
    [availableAccountIds, funnels],
  );
  // CRM is driven by the Meta account selector. Each active RD funnel linked
  // to that account becomes its pipeline scope automatically; users should
  // never need to reconcile a second, independent funnel filter.
  const funnelScopeIds = useMemo(
    () => connectedFunnels.map((funnel) => funnel.id),
    [connectedFunnels],
  );
  const connectedFunnelIdSet = useMemo(() => connectedRDFunnelIds(connectedFunnels), [connectedFunnels]);
  const connectedFunnelNameById = useMemo(
    () => new Map(connectedFunnels.map((funnel) => [funnel.id, funnel.name])),
    [connectedFunnels],
  );
  const excludedDealIds = useMemo(
    () => excludedOperationalRDDealIds(allDeals, connectedFunnels),
    [allDeals, connectedFunnels],
  );
  const scopedDeals = useMemo(
    () => dedupeRDDeals(allDeals.filter((deal) =>
      !!deal.ad_account_id
      && availableAccountIds.has(deal.ad_account_id)
      && !!deal.rd_funnel_id
      && connectedFunnelIdSet.has(deal.rd_funnel_id)
      && !isExcludedLegacyRannielyStage(connectedFunnelNameById.get(deal.rd_funnel_id), deal.rd_stage_name),
    )),
    [allDeals, availableAccountIds, connectedFunnelIdSet, connectedFunnelNameById],
  );
  const scopedSales = useMemo(() => canonicalSales.filter((sale) =>
    !!sale.ad_account_id
    && availableAccountIds.has(sale.ad_account_id)
    && (!sale.rd_deal_id || !excludedDealIds.has(sale.rd_deal_id)),
  ), [availableAccountIds, canonicalSales, excludedDealIds]);
  const scopedMetaInsights = useMemo(
    () => metaInsights.filter((insight) => !!insight.ad_account_id && availableAccountIds.has(insight.ad_account_id)),
    [availableAccountIds, metaInsights],
  );
  const metaLeads = useMemo(() => scopedMetaInsights
    .reduce((sum, insight) => sum + Number(insight.leads ?? 0), 0), [scopedMetaInsights]);
  const metaActionAdIds = useMemo(
    () => Array.from(new Set(scopedMetaInsights.map((insight) => insight.ad_id).filter(Boolean))),
    [scopedMetaInsights],
  );
  const metaActionAccountMap = useMemo(
    () => Object.fromEntries(scopedMetaInsights.map((insight) => [insight.ad_id, insight.ad_account_id])),
    [scopedMetaInsights],
  );
  const { data: metaActionData, isLoading: loadingMetaActions } = useActionTotalsByAds(
    metaActionAdIds,
    startDate,
    endDate,
    metaActionAccountMap,
  );
  const metaConversations = Number(metaActionData?.totals?.[MESSAGING_CONVERSATION_EVENT] ?? 0);
  const totalMetaLeads = metaLeads + metaConversations;
  const productPriceByName = useMemo(() => new Map(
    products
      .filter((product) => Number(product.price) > 0)
      .map((product) => [normalizeProductName(product.name), Number(product.price)]),
  ), [products]);
  const accountOpportunityFallbackById = useMemo(() => new Map(
    availableAccounts.map((account) => [account.id, accountOpportunityFallback(account.name)]),
  ), [availableAccounts]);
  // The seller/RD amount is always used first. Only a zero-value opportunity
  // receives an estimate, preferring the agreed account price over a generic
  // product catalog price so the board reflects the commercial offer.
  const getOpportunityAmount = useCallback((deal: RDDealLite) => getRDDealAmount(
    deal,
    accountOpportunityFallbackById.get(deal.ad_account_id || "")
      ?? productPriceByName.get(normalizeProductName(deal.rd_product_name)),
  ), [accountOpportunityFallbackById, productPriceByName]);

  const { data: storedStages = [] } = useFunnelStagesForIds(funnelScopeIds);
  const visibleStoredStages = useMemo(() => storedStages.filter((stage) =>
    !isExcludedLegacyRannielyStage(connectedFunnelNameById.get(stage.rd_funnel_id), stage.name),
  ), [connectedFunnelNameById, storedStages]);

  useEffect(() => {
    window.localStorage.setItem("growdash:crm-view", view);
    const next = new URLSearchParams(searchParams);
    if (view === "ai") next.set("tab", "ai"); else next.delete("tab");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [view, searchParams, setSearchParams]);

  useEffect(() => {
    setPage(1);
    setStageLimits({});
  }, [adAccountId, endDate, owner, preset, query, startDate, status]);

  const funnelNames = useMemo(() => new Map(connectedFunnels.map((funnel) => [funnel.id, funnel.name])), [connectedFunnels]);
  const dealsInPipeline = useMemo(
    () => scopedDeals.filter((deal) => isRDDealInCrmPeriod(deal, startDate, endDate, preset === "max")),
    [endDate, preset, scopedDeals, startDate],
  );
  const owners = useMemo(
    () => Array.from(new Set(dealsInPipeline.map((deal) => deal.deal_owner_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [dealsInPipeline],
  );
  const normalizedQuery = normalize(query);
  const deals = useMemo(() => dealsInPipeline.filter((deal) => {
    const bucket = classifyLead(deal);
    if (status === "open" && !["open", "qualified"].includes(bucket)) return false;
    if (status === "won" && bucket !== "won") return false;
    if (status === "lost" && !["lost", "disqualified"].includes(bucket)) return false;
    if (owner !== "all" && deal.deal_owner_name !== owner) return false;
    if (!normalizedQuery) return true;
    return normalize([
      deal.contact_name,
      deal.contact_email,
      deal.rd_stage_name,
      deal.deal_owner_name,
      deal.rd_product_name,
      deal.rd_campaign_name,
      deal.utm_source,
      deal.utm_campaign,
      deal.lead_city,
      deal.lead_state,
    ].filter(Boolean).join(" ")).includes(normalizedQuery);
  }), [dealsInPipeline, normalizedQuery, owner, status]);

  const stats = useMemo(() => {
    // KPIs describe the selected account/date scope, never a transient board
    // search or status filter. In "Todas as contas" this is the union of all
    // connected Meta accounts and RD funnels.
    const won = dealsInPipeline.filter((deal) => classifyLead(deal) === "won");
    const lost = dealsInPipeline.filter((deal) => classifyLead(deal) === "lost" || classifyLead(deal) === "disqualified");
    const active = dealsInPipeline.filter((deal) => !deal.win && !lost.includes(deal));
    const wonIds = new Set(won.map((deal) => deal.rd_deal_id));
    const realized = aggregateRevenueSources(scopedSales.filter((sale) => sale.rd_deal_id && wonIds.has(sale.rd_deal_id)), won);
    return {
      total: dealsInPipeline.length,
      active: active.length,
      openRevenue: active.reduce((sum, deal) => sum + getOpportunityAmount(deal), 0),
      won: won.length,
      wonRevenue: realized.totalNet,
      lost: lost.length,
      conversion: dealsInPipeline.length ? (won.length / dealsInPipeline.length) * 100 : 0,
    };
  }, [dealsInPipeline, getOpportunityAmount, scopedSales]);

  const stages = useMemo<PipelineStage[]>(() => {
    const map = new Map<string, PipelineStage>();
    for (const stage of visibleStoredStages) {
      const id = rdPipelineStageKey(stage.rd_funnel_id, stage.rd_stage_id);
      map.set(id, {
        id,
        name: stage.name,
        order: stage.order,
        won: stage.is_won,
        lost: stage.is_lost,
        rdFunnelId: stage.rd_funnel_id,
        rdStageId: stage.rd_stage_id,
      });
    }
    for (const deal of dealsInPipeline) {
      const id = rdPipelineStageKey(deal.rd_funnel_id, deal.rd_stage_id);
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: deal.rd_stage_name || "Sem etapa",
          order: deal.rd_stage_order ?? 9_999,
          won: classifyLead(deal) === "won",
          lost: classifyLead(deal) === "lost" || classifyLead(deal) === "disqualified",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
  }, [dealsInPipeline, isConsolidatedView, visibleStoredStages]);

  const stageDeals = useMemo(() => {
    const map = new Map<string, RDDealLite[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of deals) {
      const stageId = rdPipelineStageKey(deal.rd_funnel_id, deal.rd_stage_id);
      const current = map.get(stageId) || [];
      current.push(deal);
      map.set(stageId, current);
    }
    return map;
  }, [deals, stages]);

  const lastUpdatedAt = useMemo(() => {
    const timestamps = scopedDeals.map((deal) => deal.updated_at || deal.stage_updated_at).filter(Boolean) as string[];
    return timestamps.sort().at(-1) || null;
  }, [scopedDeals]);

  const pageCount = Math.max(1, Math.ceil(deals.length / PAGE_SIZE));
  const visibleList = deals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeView(next: CRMView) {
    setView(next);
  }

  async function syncRD() {
    if (!connectedFunnels.length) {
      toast.error(rdEnabled ? "Nenhum funil RD ativo para sincronizar." : "Nenhum funil RD disponível para sua conta. Peça acesso ao funil ou conecte o RD Station.");
      return;
    }
    setSyncing(true);
    try {
      for (const funnel of connectedFunnels) {
        const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
          body: {
            funnel_id: funnel.id,
            // This is an explicit user action, so synchronize every RD status
            // in the period selected on the screen. The background realtime
            // job remains deliberately small; it must not redefine history.
            realtime: false,
            analytics_mode: true,
            // A list response from RD can be stale or omit the edited amount.
            // A manual CRM refresh asks the server to hydrate each deal with
            // its authoritative detail before updating CRM and Comercial.
            refresh_amounts: true,
            // "Máximo" is a full RD pipeline reconciliation, not a synthetic
            // date interval beginning in 2000. The RD API's date filter can
            // omit legacy/open negotiations in some accounts.
            full_history: preset === "max",
            ...(preset === "max" ? {} : {
              start_date: format(startDate, "yyyy-MM-dd"),
              end_date: format(endDate, "yyyy-MM-dd"),
            }),
            max_pages: preset === "max" ? 250 : 50,
            max_deals: preset === "max" ? 50_000 : 10_000,
            trigger_source: "crm_history_refresh",
          },
        });
        if (error || data?.error || data?.success === false) throw error || new Error(data?.error || "Falha na sincronização.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
      ]);
      toast.success("Negociações atualizadas com o RD Station.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o RD Station.");
    } finally {
      setSyncing(false);
    }
  }

  async function renameStage(stage: PipelineStage, name: string) {
    if (!stage.rdFunnelId || !stage.rdStageId) return false;
    const trimmed = name.trim();
    if (!trimmed || trimmed === stage.name) return false;
    const { error } = await supabase
      .from("rd_funnel_stages")
      .update({ name: trimmed })
      .eq("rd_funnel_id", stage.rdFunnelId)
      .eq("rd_stage_id", stage.rdStageId);
    if (error) {
      toast.error(`Não foi possível renomear a etapa: ${error.message}`);
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] });
    toast.success("Etapa renomeada com sucesso.");
    return true;
  }

  return (
    <div className="gd-module-shell mx-auto max-w-[1700px] space-y-5">
      <PageHeading
        eyebrow="RD Station CRM"
        title="Negociações"
        description="Pipeline operacional sincronizado com os leads e negociações reais do RD Station."
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label="Visualização das negociações">
              <ViewButton active={view === "board"} onClick={() => changeView("board")} icon={<LayoutGrid />} label="Kanban" />
              <ViewButton active={view === "list"} onClick={() => changeView("list")} icon={<List />} label="Lista" />
              <ViewButton active={view === "ai"} onClick={() => changeView("ai")} icon={<Bot />} label="IA do Funil" />
            </div>
            <button className="gd-button" onClick={() => void syncRD()} disabled={syncing || loadingRDIntegration || loadingFunnels || !connectedFunnels.length}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Sincronizando" : "Atualizar RD"}
            </button>
          </div>
        )}
      />

      <section className="gd-panel mb-4 p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-3">
          <Search className="h-4 w-4 text-primary" />
          <div><h2 className="text-sm font-black text-foreground">Filtros e escopo</h2><p className="text-[11px] text-muted-foreground">Defina a conta, o período e as negociações exibidas abaixo.</p></div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.2fr)_minmax(180px,.82fr)_minmax(170px,.72fr)_minmax(235px,.95fr)_auto]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar negociações" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-10" placeholder="Buscar contato, e-mail, campanha, produto ou cidade" />
          </label>
          <AccountMultiSelect accounts={availableAccounts.map((account) => ({ id: account.id, name: account.name }))} selectedIds={adAccountIds} onChange={setAdAccountIds} className="h-11" />
          <select aria-label="Filtrar por responsável" value={owner} onChange={(event) => setOwner(event.target.value)} className="gd-button h-11 min-w-0">
            <option value="all">Todos os responsáveis</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <MetaDateRangePicker
            preset={preset}
            onPresetChange={setPreset}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            startDate={startDate}
            endDate={endDate}
            className="h-11"
          />
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
            {([ ["all", "Todos"], ["open", "Abertos"], ["won", "Ganhos"], ["lost", "Perdidos"] ] as [StatusFilter, string][]).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-black transition", status === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground")}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
          <span>{number.format(deals.length)} negociação(ões) encontrada(s) · {isConsolidatedView ? "pipeline único consolidado de todas as contas" : funnelScopeIds.length === 1 ? `funil vinculado: ${connectedFunnels[0]?.name}` : funnelScopeIds.length > 1 ? `${funnelScopeIds.length} funis vinculados à conta selecionada` : "nenhum funil RD vinculado"}{!rdEnabled && connectedFunnels.length ? " · dados compartilhados pelo proprietário do funil" : ""}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {isFetching || syncing ? "Atualizando em segundo plano…" : lastUpdatedAt ? `Atualizado ${formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true, locale: ptBR })}` : "Aguardando primeira sincronização"}</span>
        </div>
      </section>

      {view !== "ai" && (
        <section className="mb-4" aria-labelledby="crm-metrics-title">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Resumo do período selecionado</p>
              <h2 id="crm-metrics-title" className="mt-1 text-lg font-black tracking-tight text-foreground">Indicadores do CRM</h2>
            </div>
            <p className="text-xs text-muted-foreground">Cada card informa a fonte e o critério do dado.</p>
          </div>
          <div className="gd-kpi-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CrmMetricCard
              source="Meta Ads"
              label="Leads Meta"
              value={number.format(totalMetaLeads)}
              description={`${number.format(metaLeads)} leads + ${number.format(metaConversations)} conversas iniciadas`}
              icon={<UsersRound className="h-4 w-4" />}
              tone="meta"
            />
            <CrmMetricCard
              source="RD Station CRM"
              label="Negociações no funil"
              value={number.format(stats.total)}
              description={`${number.format(stats.active)} ativas · ${number.format(stats.won)} ganhas`}
              icon={<Columns3 className="h-4 w-4" />}
              tone="rd"
            />
            <CrmMetricCard
              source="Comercial · RD"
              label="Receita em aberto"
              value={brl.format(stats.openRevenue)}
              description="Soma das negociações ativas no RD Station"
              icon={<CircleDollarSign className="h-4 w-4" />}
              tone="revenue"
            />
            <CrmMetricCard
              source="Comercial · RD"
              label="Faturamento líquido ganho"
              value={brl.format(stats.wonRevenue)}
              description={`${number.format(stats.won)} negociação(ões) marcada(s) como ganha(s)`}
              icon={<Trophy className="h-4 w-4" />}
              tone="success"
            />
            <CrmMetricCard
              source="Conversão · RD"
              label="Taxa de conversão"
              value={`${stats.conversion.toFixed(2)}%`}
              description={`${number.format(stats.won)} ganhas de ${number.format(stats.total)} negociações · ${number.format(stats.lost)} perdidas`}
              icon={<Target className="h-4 w-4" />}
              tone="success"
            />
          </div>
        </section>
      )}

      {isLoadingSelectedScope || loadingMetaActions || loadingProducts ? <CRMLoading /> : dealsError ? (
        <section className="gd-panel mt-4 grid min-h-64 place-items-center p-6 text-center">
          <div className="max-w-md"><UsersRound className="mx-auto h-9 w-9 text-destructive" /><h2 className="mt-4 font-black">Não foi possível carregar as negociações</h2><p className="mt-2 text-sm text-muted-foreground">{dealsQueryError instanceof Error ? dealsQueryError.message : "A consulta do CRM falhou. Verifique seu acesso ao funil e tente novamente."}</p><Button className="mt-4" variant="outline" onClick={() => void refetchDeals()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>
        </section>
      ) : view === "ai" ? (
        <CrmAIWorkspace deals={deals} sales={scopedSales} accountId={accountFilter} />
      ) : view === "board" ? (
        <KanbanBoard
          stages={stages}
          stageDeals={stageDeals}
          stageLimits={stageLimits}
          getOpportunityAmount={getOpportunityAmount}
          onLoadMore={(stageId) => setStageLimits((current) => ({ ...current, [stageId]: (current[stageId] || BOARD_STEP) + BOARD_STEP }))}
          onOpen={setSelectedDeal}
          onRename={renameStage}
        />
      ) : (
        <DealsList
          deals={visibleList}
          funnels={funnelNames}
          page={page}
          pageCount={pageCount}
          total={deals.length}
          getOpportunityAmount={getOpportunityAmount}
          onPage={setPage}
          onOpen={setSelectedDeal}
        />
      )}

      {!isLoadingSelectedScope && !dealsError && !deals.length && view !== "ai" && (
        <section className="gd-panel mt-4 grid min-h-64 place-items-center p-6 text-center">
          <div><UsersRound className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-4 font-black">Nenhuma negociação encontrada</h2><p className="mt-2 text-sm text-muted-foreground">{crmEmptyState({ hasFunnels: !!connectedFunnels.length, hasOwnIntegration: rdEnabled })}</p></div>
        </section>
      )}

      <DealDetails deal={selectedDeal} funnelName={selectedDeal?.rd_funnel_id ? funnelNames.get(selectedDeal.rd_funnel_id) : undefined} userId={user?.id} userName={String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário Growdash")} getOpportunityAmount={getOpportunityAmount} onClose={() => setSelectedDeal(null)} onSaved={() => { queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }); queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] }); toast.success("Negociação atualizada na Growdash"); }} />
    </div>
  );
}

function KanbanBoard({ stages, stageDeals, stageLimits, getOpportunityAmount, onLoadMore, onOpen }: {
  stages: PipelineStage[];
  stageDeals: Map<string, RDDealLite[]>;
  stageLimits: Record<string, number>;
  getOpportunityAmount: (deal: RDDealLite) => number;
  onLoadMore: (stageId: string) => void;
  onOpen: (deal: RDDealLite) => void;
  onRename: (stage: PipelineStage, name: string) => Promise<boolean>;
}) {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [savingStageId, setSavingStageId] = useState<string | null>(null);

  const beginRename = (stage: PipelineStage) => {
    if (!stage.rdFunnelId || !stage.rdStageId) return;
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  };

  const cancelRename = () => {
    if (savingStageId) return;
    setEditingStageId(null);
    setEditingStageName("");
  };

  const commitRename = async (stage: PipelineStage) => {
    if (!editingStageName.trim() || savingStageId) return;
    setSavingStageId(stage.id);
    const saved = await onRename(stage, editingStageName);
    if (saved) {
      setEditingStageId(null);
      setEditingStageName("");
    }
    setSavingStageId(null);
  };

  return (
    <section className="gd-panel mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><Columns3 className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-black">Pipeline de negociações</h2><p className="text-[10px] text-muted-foreground">Etapas na mesma ordem configurada no RD Station</p></div></div>
        <span className="hidden text-[10px] text-muted-foreground sm:block">Clique em um cartão para ver todos os dados</span>
      </div>
      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="flex min-h-[520px] min-w-max items-start gap-3">
          {stages.map((stage) => {
            const deals = stageDeals.get(stage.id) || [];
            const total = deals.reduce((sum, deal) => sum + getOpportunityAmount(deal), 0);
            const limit = stageLimits[stage.id] || BOARD_STEP;
            return (
              <div key={stage.id} className="w-[286px] shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/25">
                <div className="sticky top-0 z-10 border-b border-border bg-background/95 p-3 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><StageDot won={stage.won} lost={stage.lost} />{editingStageId === stage.id ? <><Input value={editingStageName} onChange={(event) => setEditingStageName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(stage); if (event.key === "Escape") cancelRename(); }} aria-label={`Nome da etapa ${stage.name}`} autoFocus disabled={savingStageId === stage.id} className="h-7 min-w-0 px-2 text-xs font-black" /><button type="button" className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => void commitRename(stage)} disabled={savingStageId === stage.id || !editingStageName.trim()} aria-label="Salvar nome da etapa"><Save className="h-3.5 w-3.5" /></button><button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={cancelRename} disabled={savingStageId === stage.id} aria-label="Cancelar edição da etapa"><XCircle className="h-3.5 w-3.5" /></button></> : <><h3 className="truncate text-xs font-black" title={stage.name}>{stage.name}</h3>{stage.rdFunnelId && stage.rdStageId && <button type="button" className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => beginRename(stage)} aria-label={`Editar etapa ${stage.name}`} title="Editar nome da etapa"><Pencil className="h-3 w-3" /></button>}</>}</div><p className="mt-1 pl-4 text-[10px] text-muted-foreground">{number.format(deals.length)} negócio(s) · {brl.format(total)}</p></div>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-black">{deals.length}</span>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-390px)] min-h-[440px] space-y-2 overflow-y-auto p-2">
                  {deals.slice(0, limit).map((deal) => <DealCard key={deal.id} deal={deal} getOpportunityAmount={getOpportunityAmount} onOpen={onOpen} />)}
                  {!deals.length && <div className="m-2 rounded-xl border border-dashed border-border p-6 text-center text-[10px] text-muted-foreground">Nenhuma negociação nesta etapa</div>}
                  {deals.length > limit && <button type="button" className="gd-button w-full justify-center" onClick={() => onLoadMore(stage.id)}>Mostrar mais {Math.min(BOARD_STEP, deals.length - limit)}</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DealCard({ deal, getOpportunityAmount, onOpen }: { deal: RDDealLite; getOpportunityAmount: (deal: RDDealLite) => number; onOpen: (deal: RDDealLite) => void }) {
  const name = deal.contact_name || deal.contact_email || "Contato não informado";
  return (
    <button type="button" onClick={() => onOpen(deal)} className="group w-full rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">{initials(name)}</span>
        <div className="min-w-0 grow"><h4 className="truncate text-xs font-black" title={name}>{name}</h4><p className="mt-0.5 truncate text-[9px] text-muted-foreground">{deal.rd_product_name || deal.rd_campaign_name || deal.utm_source || "Sem produto/origem"}</p></div>
        <DealStatus deal={deal} compact />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
        <span className="text-xs font-black text-foreground">{brl.format(getOpportunityAmount(deal))}</span>
        <span className="max-w-[125px] truncate text-[9px] text-muted-foreground" title={deal.deal_owner_name || "Sem responsável"}>{deal.deal_owner_name || "Sem responsável"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || "Local não informado"}</span>
        <span className="shrink-0">{relativeDate(deal.stage_updated_at || deal.updated_at || deal.lead_created_at)}</span>
      </div>
    </button>
  );
}

function DealsList({ deals, funnels, page, pageCount, total, getOpportunityAmount, onPage, onOpen }: {
  deals: RDDealLite[];
  funnels: Map<string, string>;
  page: number;
  pageCount: number;
  total: number;
  getOpportunityAmount: (deal: RDDealLite) => number;
  onPage: (page: number) => void;
  onOpen: (deal: RDDealLite) => void;
}) {
  return (
    <section className="gd-panel mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2"><List className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-black">Lista de negociações</h2><p className="text-[10px] text-muted-foreground">{number.format(total)} registro(s), 50 por página</p></div></div>
        <Pagination page={page} pageCount={pageCount} onPage={onPage} />
      </div>

      <div className="divide-y divide-border md:hidden">
        {deals.map((deal) => (
          <button key={deal.id} type="button" className="grid w-full gap-2 p-4 text-left" onClick={() => onOpen(deal)}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm">{deal.contact_name || deal.contact_email || "Contato não informado"}</b><span className="text-[10px] text-muted-foreground">{deal.rd_stage_name || "Sem etapa"}</span></div><DealStatus deal={deal} /></div>
            <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-muted-foreground">{deal.deal_owner_name || "Sem responsável"}</span><b>{brl.format(getOpportunityAmount(deal))}</b></div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="bg-muted/60 text-[10px] font-black uppercase tracking-wide text-muted-foreground"><tr>{["Negociação", "Etapa", "Funil", "Responsável", "Origem/campanha", "Atualização", "Valor", "Status"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {deals.map((deal) => (
              <tr key={deal.id} className="transition hover:bg-muted/45">
                <td className="max-w-64 p-0"><button type="button" onClick={() => onOpen(deal)} className="block w-full px-4 py-3 text-left outline-none focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><b className="block truncate">{deal.contact_name || "Contato não informado"}</b><span className="block truncate text-[10px] text-muted-foreground">{deal.contact_email || deal.rd_deal_id}</span><span className="sr-only">Abrir negociação</span></button></td>
                <td className="px-4 py-3"><span className="inline-flex max-w-48 truncate rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">{deal.rd_stage_name || "Sem etapa"}</span></td>
                <td className="max-w-48 truncate px-4 py-3" title={deal.rd_funnel_id ? funnels.get(deal.rd_funnel_id) : undefined}>{deal.rd_funnel_id ? funnels.get(deal.rd_funnel_id) || "Funil RD" : "—"}</td>
                <td className="max-w-44 truncate px-4 py-3">{deal.deal_owner_name || "Não informado"}</td>
                <td className="max-w-56 px-4 py-3"><span className="block truncate">{deal.rd_campaign_name || deal.utm_campaign || deal.utm_source || "Não atribuída"}</span><span className="text-[9px] text-muted-foreground">{deal.rd_product_name || "Sem produto"}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeDate(deal.stage_updated_at || deal.updated_at || deal.lead_created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-black">{brl.format(getOpportunityAmount(deal))}</td>
                <td className="px-4 py-3"><DealStatus deal={deal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end border-t border-border p-4"><Pagination page={page} pageCount={pageCount} onPage={onPage} /></div>
    </section>
  );
}

function DealDetails({ deal, funnelName, userId, userName, getOpportunityAmount, onClose, onSaved }: { deal: RDDealLite | null; funnelName?: string; userId?: string; userName: string; getOpportunityAmount: (deal: RDDealLite) => number; onClose: () => void; onSaved: () => void }) {
  if (!deal) return null;
  const fields = Object.entries(deal.custom_fields || {}).filter(([, value]) => value != null && String(value).trim());
  return (
    <Sheet open={!!deal} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-7">
          <SheetTitle className="text-xl font-black">{deal.contact_name || deal.contact_email || "Negociação sem contato"}</SheetTitle>
          <SheetDescription>Negociação sincronizada do RD Station CRM</SheetDescription>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <DetailMetric icon={<CircleDollarSign />} label="Valor estimado" value={brl.format(getOpportunityAmount(deal))} />
          <DetailMetric icon={<Target />} label="Etapa" value={deal.rd_stage_name || "Sem etapa"} />
          <DetailMetric icon={<UserRound />} label="Responsável" value={deal.deal_owner_name || "Não informado"} />
          <DetailMetric icon={deal.win ? <Trophy /> : <XCircle />} label="Situação" value={statusLabel(deal)} />
        </div>
        <DealEditor deal={deal} userId={userId} onSaved={onSaved} />
        <DealNotes dealId={deal.id} userId={userId} userName={userName} />
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
          <DetailRow icon={<Columns3 />} label="Funil" value={funnelName || "Funil RD"} />
          <DetailRow icon={<Mail />} label="E-mail" value={deal.contact_email || "Não informado"} />
          <DetailRow icon={<MapPin />} label="Localização" value={[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || "Não informada"} />
          <DetailRow icon={<UsersRound />} label="Produto" value={deal.rd_product_name || "Não informado"} />
          <DetailRow icon={<Target />} label="Origem" value={deal.utm_source || "Não atribuída"} />
          <DetailRow icon={<Target />} label="Campanha" value={deal.rd_campaign_name || deal.utm_campaign || "Não atribuída"} />
          <DetailRow icon={<Target />} label="Conjunto (UTM term)" value={deal.utm_term || "Não atribuído"} />
          <DetailRow icon={<Target />} label="Criativo (UTM content)" value={deal.utm_content || "Não atribuído"} />
          <DetailRow icon={<Target />} label="ID do anúncio (UTM id)" value={deal.utm_id || "Não atribuído"} />
          <DetailRow icon={<CalendarClock />} label="Criado em" value={fullDate(deal.lead_created_at)} />
          <DetailRow icon={<Clock3 />} label="Última movimentação" value={fullDate(deal.stage_updated_at || deal.updated_at)} />
          {deal.lost_reason && <DetailRow icon={<XCircle />} label="Motivo da perda" value={deal.lost_reason} danger />}
        </div>
        {!!fields.length && <div className="mt-5"><h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Campos personalizados do RD</h3><div className="mt-2 divide-y divide-border rounded-2xl border border-border">{fields.map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3 px-4 py-3 text-xs"><span className="break-words text-muted-foreground">{key}</span><b className="break-words text-right">{String(value)}</b></div>)}</div></div>}
        <div className="mt-5 rounded-xl border border-dashed border-border p-3 text-[10px] leading-4 text-muted-foreground">ID RD: {deal.rd_deal_id}. A Growdash exibe o histórico armazenado imediatamente e atualiza alterações do RD em segundo plano.</div>
      </SheetContent>
    </Sheet>
  );
}

function DealNotes({ dealId, userId, userName }: { dealId: string; userId?: string; userName: string }) {
  const [body, setBody] = useState("");
  const { data: notes = [], isLoading, isError } = useRDDealNotes(dealId);
  const createNote = useCreateRDDealNote();
  const trimmed = body.trim();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) return;
    if (!userId) return toast.error("Sua sessão não está pronta para registrar uma anotação.");
    try {
      await createNote.mutateAsync({ dealId, authorId: userId, authorName: userName, body: trimmed });
      setBody("");
      toast.success("Anotação registrada na negociação.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a anotação.");
    }
  }

  return <section className="mt-5 rounded-2xl border border-primary/25 bg-primary/[.035] p-4">
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="h-4 w-4" /></span>
      <div><h3 className="text-sm font-black">Histórico de anotações</h3><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Registre contatos, combinados e próximos passos. As notas não são alteradas pela sincronização do RD Station.</p></div>
    </div>
    <form className="mt-4" onSubmit={(event) => void submit(event)}>
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={3} placeholder="Escreva uma anotação sobre esta negociação…" aria-label="Nova anotação" />
      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-muted-foreground">{body.length}/4000</span><Button type="submit" size="sm" disabled={!trimmed || createNote.isPending}><Send className="mr-2 h-3.5 w-3.5" />{createNote.isPending ? "Salvando…" : "Adicionar anotação"}</Button></div>
    </form>
    <div className="mt-4 border-t border-border/70 pt-4">
      {isLoading && <p className="text-xs text-muted-foreground">Carregando histórico…</p>}
      {isError && <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Não foi possível carregar as anotações desta negociação.</p>}
      {!isLoading && !isError && !notes.length && <p className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">Nenhuma anotação ainda. Registre o primeiro contato ou próximo passo.</p>}
      <ol className="space-y-3">{notes.map((note) => <li key={note.id} className="relative border-l-2 border-primary/30 pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><div className="flex items-baseline justify-between gap-3"><b className="truncate text-xs">{note.author_name || "Usuário Growdash"}</b><time className="shrink-0 text-[9px] text-muted-foreground" dateTime={note.created_at}>{fullDate(note.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">{note.body}</p></li>)}</ol>
    </div>
  </section>;
}

function DealEditor({ deal, userId, onSaved }: { deal: RDDealLite; userId?: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    amount: String(deal.amount_total_manual ?? getRDDealAmount(deal) ?? ""),
    reason: deal.manual_override_reason ?? "Correção manual no CRM Growdash",
    contactName: deal.contact_name ?? "",
    contactEmail: deal.contact_email ?? "",
    owner: deal.deal_owner_name ?? "",
    product: deal.rd_product_name ?? "",
    source: deal.utm_source ?? "",
    campaign: deal.utm_campaign ?? "",
    adset: deal.utm_term ?? "",
    creative: deal.utm_content ?? "",
    adId: deal.utm_id ?? "",
    lostReason: deal.lost_reason ?? "",
  }));

  async function save() {
    const amount = Number(form.amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Informe um valor de venda válido.");
    setSaving(true);
    const { error } = await supabase.from("rd_deals").update({
      amount_total_manual: amount || null,
      manual_override_enabled: amount > 0,
      manual_override_reason: amount > 0 ? form.reason.trim() || "Correção manual no CRM Growdash" : null,
      manual_override_at: amount > 0 ? new Date().toISOString() : null,
      manual_override_by: amount > 0 ? userId ?? null : null,
      contact_name: form.contactName.trim() || null,
      contact_email: form.contactEmail.trim() || null,
      deal_owner_name: form.owner.trim() || null,
      rd_product_name: form.product.trim() || null,
      utm_source: form.source.trim() || null,
      utm_campaign: form.campaign.trim() || null,
      utm_term: form.adset.trim() || null,
      utm_content: form.creative.trim() || null,
      utm_id: form.adId.trim() || null,
      lost_reason: form.lostReason.trim() || null,
    }).eq("id", deal.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setEditing(false);
    onSaved();
  }

  if (!editing) return <section className="mt-5 rounded-2xl border border-primary/25 bg-primary/[.04] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black">Editar negociação</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ajuste valor, contato, responsável, produto e atribuição diretamente na Growdash.</p></div><Button type="button" size="sm" onClick={() => setEditing(true)}>Editar</Button></div>{deal.manual_override_enabled && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-600">Valor manual ativo: {brl.format(getRDDealAmount(deal))}. Ele prevalece sobre o valor recebido do RD.</p>}</section>;

  return <section className="mt-5 rounded-2xl border border-primary/35 bg-primary/[.05] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black">Editar negociação</h3><p className="mt-1 text-[10px] text-muted-foreground">O valor manual é preservado pela Growdash mesmo quando o RD sincronizar novamente.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><EditField label="Valor da venda realizada" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} inputMode="decimal" /><EditField label="Motivo do ajuste" value={form.reason} onChange={(value) => setForm({ ...form, reason: value })} /><EditField label="Nome do contato" value={form.contactName} onChange={(value) => setForm({ ...form, contactName: value })} /><EditField label="E-mail" value={form.contactEmail} onChange={(value) => setForm({ ...form, contactEmail: value })} type="email" /><EditField label="Responsável" value={form.owner} onChange={(value) => setForm({ ...form, owner: value })} /><EditField label="Produto" value={form.product} onChange={(value) => setForm({ ...form, product: value })} /><EditField label="Origem / UTM source" value={form.source} onChange={(value) => setForm({ ...form, source: value })} /><EditField label="Campanha / UTM campaign" value={form.campaign} onChange={(value) => setForm({ ...form, campaign: value })} /><EditField label="Conjunto / UTM term" value={form.adset} onChange={(value) => setForm({ ...form, adset: value })} /><EditField label="Criativo / UTM content" value={form.creative} onChange={(value) => setForm({ ...form, creative: value })} /><EditField label="ID do anúncio / UTM id" value={form.adId} onChange={(value) => setForm({ ...form, adId: value })} /></div><label className="mt-3 grid gap-1.5 text-xs font-bold">Motivo de perda <Textarea value={form.lostReason} onChange={(event) => setForm({ ...form, lostReason: event.target.value })} rows={2} /></label><div className="mt-4 flex justify-end"><Button type="button" onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar alterações"}</Button></div></section>;
}

function EditField({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return <label className="grid gap-1.5 text-xs font-bold">{label}<Input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{<span className="[&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}{label}</button>;
}

function StageDot({ won, lost }: { won: boolean; lost: boolean }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", won ? "bg-emerald-500" : lost ? "bg-rose-500" : "bg-primary")} />;
}

function DealStatus({ deal, compact = false }: { deal: RDDealLite; compact?: boolean }) {
  const kind = classifyLead(deal);
  const label = kind === "won" ? "Ganho" : kind === "lost" || kind === "disqualified" ? "Perdido" : kind === "qualified" ? "Qualificado" : "Aberto";
  return <span className={cn("inline-flex shrink-0 rounded-full font-black", compact ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 text-[9px]", kind === "won" ? "bg-emerald-500/12 text-emerald-500" : kind === "lost" || kind === "disqualified" ? "bg-rose-500/12 text-rose-500" : "bg-amber-500/12 text-amber-500")}>{label}</span>;
}

function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  return <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-16 text-center text-[10px] font-bold" aria-live="polite">{page} de {pageCount}</span><Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button></div>;
}

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-border bg-muted/25 p-3"><span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-muted-foreground"><span className="text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{label}</span><b className="mt-2 block truncate text-sm" title={value}>{value}</b></div>;
}

function DetailRow({ icon, label, value, danger = false }: { icon: ReactNode; label: string; value: string; danger?: boolean }) {
  return <div className="grid grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] items-center gap-3 px-4 py-3 text-xs"><span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground"><span className={cn("shrink-0 [&>svg]:h-4 [&>svg]:w-4", danger ? "text-rose-500" : "text-primary")}>{icon}</span>{label}</span><b className={cn("break-words text-right", danger && "text-rose-500")}>{value}</b></div>;
}

function CRMLoading() {
  return <section className="gd-panel mt-4 p-4"><div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map((item) => <div key={item} className="h-[480px] w-[286px] shrink-0 animate-pulse rounded-2xl bg-muted" />)}</div></section>;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normalizeProductName(value: string | null | undefined) {
  return normalize(value || "").replace(/[^a-z0-9]+/g, "");
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function relativeDate(value?: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

function fullDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function statusLabel(deal: RDDealLite) {
  const kind = classifyLead(deal);
  if (kind === "won") return "Ganho";
  if (kind === "lost" || kind === "disqualified") return "Perdido";
  if (kind === "qualified") return "Qualificado";
  return "Em aberto";
}
