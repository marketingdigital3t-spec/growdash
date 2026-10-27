import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  MessageSquare,
  Pencil,
  RefreshCw,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { businessDateKey } from "@/lib/businessDate";
import { NO_LINKED_RD_FUNNEL_SCOPE_ID } from "@/lib/rdAccountScope";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useProducts } from "@/hooks/useProducts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useRDIntegration } from "@/hooks/useRDIntegration";
import { useFunnelStagesForIds } from "@/hooks/useRDDeals";
import { classifyLead, dedupeRDDeals, type RDDealLite, useRDCRMDeals } from "@/hooks/useRDDealsForPeriod";
import { useSales } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getRDDealAmount } from "@/lib/rdDealAmount";
import { accountOpportunityFallback } from "@/lib/opportunityValueFallback";
import { crmEmptyState, crmPipelineEnabled } from "@/lib/crmAccess";
import { consolidatedCRMStage, excludedOperationalRDDealIds, isExcludedLegacyRannielyStage, mergeCRMStageSources } from "@/lib/crmPipelineStages";
import { aggregateRevenueSources } from "@/lib/revenueAggregation";
import { isDealInRDAccountOrFunnelScope, isRDDealInScopePeriod, type RDQueryScope } from "@/lib/rdQueryScope";
import { isCanonicalWonDealInPeriod, saoPauloDayBounds } from "@/lib/canonicalMetrics";
import { isWonRDStageName } from "@/lib/rdDealStatus";
import { useInsights } from "@/hooks/useInsights";
import { useLeadAttributionCatalog } from "@/hooks/useLeadAttributionCatalog";
import { resolveLeadAttribution, type LeadAttribution } from "@/lib/leadAttributionResolver";
import { normalizeTrackingDraft, type ManualTracking } from "@/lib/leadTracking";
import { buildRDDealUpdate, formatDealAmountInput, parseDealAmount, serializeRDDealUpdate, statusFromRDDeal, type DealEditDraft, type DealEditStatus } from "@/lib/rdDealEdit";
import { useRDDealNotes, useCreateRDDealNote } from "@/hooks/useRDDealNotes";
import { PageHeading } from "./shared";
import CrmAIWorkspace from "./CrmAIWorkspace";
import { useResolvedRDAccountFunnelScope } from "@/hooks/useResolvedRDAccountFunnelScope";
import type { MetricAvailability } from "@/lib/metricAvailability";
import { crmBoardSummaryLabel } from "@/lib/crmAvailability";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");
const PAGE_SIZE = 50;
const BOARD_STEP = 50;

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

type EditablePipeline = { id: string; name: string; rd_funnel_id: string; rd_connection_id?: string | null };
type EditableStage = { rd_funnel_id: string; rd_stage_id: string; name: string; order: number; is_won: boolean; is_lost: boolean };
type RDStageHistoryRow = { id: string; from_stage_name: string | null; to_stage_name: string | null; source: string; changed_at: string };

type FirstPartyLead = { id: string; status: string | null; source_provider: string | null; first_received_at: string | null; utm_source: string | null; utm_campaign: string | null };
type FirstPartyLeadQuery = {
  eq: (column: string, value: unknown) => FirstPartyLeadQuery;
  order: (column: string, options: { ascending: boolean }) => FirstPartyLeadQuery;
  limit: (count: number) => Promise<{ data: FirstPartyLead[] | null; error: Error | null }>;
};
type FirstPartyLeadTable = { select: (columns: string) => FirstPartyLeadQuery };

// RD stage IDs are only unique within a pipeline. This key is retained for
// single-account views and as the source key for the consolidated mapping.
function rdPipelineStageKey(rdFunnelId: string | null | undefined, rdStageId: string | null | undefined) {
  return `${rdFunnelId || "unassigned-funnel"}:${rdStageId || "no-stage"}`;
}

function canonicalStageForDeal(deal: Pick<RDDealLite, "rd_stage_name" | "rd_stage_order" | "win" | "stage_bucket">) {
  return consolidatedCRMStage({
    name: deal.rd_stage_name,
    order: deal.rd_stage_order,
    won: deal.win || deal.stage_bucket === "client",
    lost: deal.stage_bucket === "lost" || deal.stage_bucket === "disqualified",
  });
}

type CrmMetricCardProps = {
  source: string;
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone: "meta" | "rd" | "revenue" | "success";
  availability?: MetricAvailability;
};

function CrmMetricCard({ source, label, value, description, icon, tone, availability }: CrmMetricCardProps) {
  const toneClass = tone === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "revenue"
      ? "text-primary"
      : tone === "meta"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <article className="gd-panel gd-metric-card gd-crm-metric-card min-w-0 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            {source}
          </span>
          <h3 className="mt-2 text-xs font-black uppercase tracking-[.08em] text-muted-foreground">{label}</h3>
        </div>
        <span className={cn("gd-metric-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl", toneClass)}>{icon}</span>
      </div>
      <p className={cn("mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.35rem,2.25vw,1.9rem)] font-black tracking-tight", toneClass, availability && !["fresh", "stale", "partial", "empty_confirmed"].includes(availability.state) && "text-muted-foreground")} title={availability?.reason || value}>{availability?.state === "loading" ? "Carregando…" : availability && !["fresh", "stale", "partial", "empty_confirmed"].includes(availability.state) ? "Indisponível" : value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-muted-foreground">{description}</p>
    </article>
  );
}

export default function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const {
    adAccountId,
    setAdAccountId,
    adAccountIds,
    funnelIds: selectedFunnelIds,
    setFunnelIds: setSelectedFunnelIds,
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
  const { data: adAccounts = [], isLoading: loadingAdAccounts, isError: adAccountsError, error: adAccountsQueryError, refetch: refetchAdAccounts } = useAdAccounts();
  const availableAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, segment]);
  const availableAccountIds = useMemo(() => new Set(availableAccounts.map((account) => account.id)), [availableAccounts]);
  const accountScopeIds = useMemo(
    () => adAccountIds.length ? adAccountIds.filter((id) => availableAccountIds.has(id)) : Array.from(availableAccountIds),
    [adAccountIds, availableAccountIds],
  );
  const accountScopeSet = useMemo(() => new Set(accountScopeIds), [accountScopeIds]);
  const { data: rdIntegration, isLoading: loadingRDIntegration } = useRDIntegration();
  const rdEnabled = rdIntegration?.is_active === true;
  // A conexão do RD pertence ao dono da conta/funil. Um gestor ou membro com
  // permissão de leitura não deve perder o pipeline apenas por não possuir
  // uma cópia pessoal do token. A consulta usa RLS e continua retornando
  // somente os funis atribuídos ao usuário atual.
  const canReadCrm = crmPipelineEnabled(!!user);
  // RD remains its own source; global account selection scopes it only through
  // the explicit RD-connection-to-Meta-account mapping in GlobalFiltersContext.
  const { data: funnelData = [], isLoading: loadingFunnels, isPlaceholderData: isPreviousFunnelScope, dataUpdatedAt: funnelsUpdatedAt, isError: funnelsError, error: funnelsQueryError, refetch: refetchFunnels } = useRDFunnels(undefined, canReadCrm && (availableAccounts.length > 0 || !adAccountIds.length));
  const isTemporaryBackendError = (error: unknown) => error instanceof Error && /Tempo de carregamento excedido|PGRST002|schema cache|503|indisponível/i.test(error.message);
  const backendUnavailable = isTemporaryBackendError(funnelsQueryError);
  const availableFunnels = useMemo(
    () => funnelData.filter((funnel) => funnel.is_active && !!funnel.rd_funnel_id),
    [funnelData],
  );
  const availableFunnelIds = useMemo(() => new Set(availableFunnels.map((funnel) => funnel.id)), [availableFunnels]);
  const scopedSelectedFunnelIds = useMemo(
    () => selectedFunnelIds.filter((id) => id === NO_LINKED_RD_FUNNEL_SCOPE_ID || availableFunnelIds.has(id)),
    [availableFunnelIds, selectedFunnelIds],
  );
  // An empty funnel filter means "resolve the funnels linked to the selected
  // Meta accounts". Passing every active local row here used to widen a
  // single-account view to unrelated RD pipelines and made duplicate local
  // mappings appear as duplicate Kanban columns.
  const resolvedRDAccountScope = useResolvedRDAccountFunnelScope({
    adAccountId: accountFilter,
    adAccountIds: accountScopeIds,
    funnelIds: selectedFunnelIds.length ? scopedSelectedFunnelIds : undefined,
  });
  const requestedFunnelIds = useMemo(
    () => selectedFunnelIds.length ? scopedSelectedFunnelIds : (resolvedRDAccountScope.funnelIds ?? []),
    [resolvedRDAccountScope.funnelIds, scopedSelectedFunnelIds, selectedFunnelIds.length],
  );
  const {
    data: dealData = [],
    isLoading: loadingDeals,
    isFetching,
    isPlaceholderData: isPreviousDealScope,
    dataUpdatedAt: dealsUpdatedAt,
    isError: dealsError,
    error: dealsQueryError,
    refetch: refetchDeals,
  } = useRDCRMDeals({
    adAccountId: accountFilter,
    adAccountIds: accountScopeIds,
    funnelIds: requestedFunnelIds,
    startDate: preset === "max" ? undefined : startDate,
    endDate: preset === "max" ? undefined : endDate,
    // O quadro precisa obedecer ao mesmo calendário visível nos indicadores.
    // "Máximo" continua sendo a única escolha que solicita o histórico inteiro.
    dateScope: preset === "max" ? "pipeline" : "period",
    enabled: canReadCrm && (requestedFunnelIds.length > 0 || accountScopeIds.length > 0),
  });
  const { data: salesData = [], isLoading: loadingSales, isPlaceholderData: isPreviousSalesScope, dataUpdatedAt: salesUpdatedAt, isError: salesError, error: salesQueryError } = useSales({
    adAccountId: accountFilter,
    adAccountIds: accountScopeIds,
    funnelIds: selectedFunnelIds,
    startDate: preset === "max" ? undefined : startDate,
    endDate: preset === "max" ? undefined : endDate,
  });
  const { data: attributionInsights = [] } = useInsights({ adAccountIds: accountScopeIds, startDate, endDate, enabled: canReadCrm && accountScopeIds.length > 0 });
  const { data: firstPartyLeads = [] } = useQuery({
    queryKey: ["crm_leads", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const from = supabase.from.bind(supabase) as unknown as (table: string) => FirstPartyLeadTable;
      const { data, error } = await from("crm_leads")
        .select("id,status,source_provider,first_received_at,utm_source,utm_campaign")
        .eq("workspace_id", workspace!.id)
        .order("first_received_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
  const firstPartyLeadsInPeriod = useMemo(() => {
    if (preset === "max") return firstPartyLeads;
    const bounds = saoPauloDayBounds(startDate, endDate);
    const start = bounds.start.getTime();
    const end = bounds.end.getTime();
    return firstPartyLeads.filter((lead: FirstPartyLead) => {
      const timestamp = new Date(lead.first_received_at || 0).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }, [endDate, firstPartyLeads, preset, startDate]);
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
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [stageLimits, setStageLimits] = useState<Record<string, number>>({});
  const selectedAdIds = useMemo(() => selectedDeal ? [selectedDeal.meta_ad_id, selectedDeal.utm_id].filter((value): value is string => Boolean(value)) : [], [selectedDeal]);
  const { data: historicalAttributionInsights = [] } = useLeadAttributionCatalog(selectedDeal?.ad_account_id, selectedAdIds);
  const selectedAttribution = useMemo<LeadAttribution | null>(() => selectedDeal ? resolveLeadAttribution(selectedDeal, [...attributionInsights, ...historicalAttributionInsights]) : null, [attributionInsights, historicalAttributionInsights, selectedDeal]);
  const selectedAutomaticAttribution = useMemo<LeadAttribution | null>(() => selectedDeal ? resolveLeadAttribution({ ...selectedDeal, manual_tracking: null }, [...attributionInsights, ...historicalAttributionInsights]) : null, [attributionInsights, historicalAttributionInsights, selectedDeal]);

  useEffect(() => {
    const next = selectedFunnelIds.filter((id) => id === NO_LINKED_RD_FUNNEL_SCOPE_ID || availableFunnelIds.has(id));
    if (next.length !== selectedFunnelIds.length || next.some((id, index) => id !== selectedFunnelIds[index])) setSelectedFunnelIds(next);
  }, [availableFunnelIds, selectedFunnelIds, setSelectedFunnelIds]);

  // Query cache keeps the previous screen visible globally, which is useful
  // for a silent refresh of the same scope. A different account is a hard
  // boundary: displaying that previous account while the new query runs is
  // materially misleading in CRM. Fail closed until every account-scoped
  // source belongs to the selection.
  const isChangingAccountScope = isPreviousFunnelScope || isPreviousDealScope || isPreviousSalesScope;
  const isLoadingSelectedScope = isChangingAccountScope || loadingAdAccounts || loadingRDIntegration || loadingFunnels || loadingDeals || loadingSales;
  const crmUpdatedAt = Math.max(dealsUpdatedAt || 0, funnelsUpdatedAt || 0, salesUpdatedAt || 0);
  const crmError = adAccountsError || funnelsError || dealsError || salesError;
  const crmErrorMessage = adAccountsQueryError instanceof Error
    ? adAccountsQueryError.message
    : funnelsQueryError instanceof Error
    ? funnelsQueryError.message
    : dealsQueryError instanceof Error
      ? dealsQueryError.message
      : salesQueryError instanceof Error
        ? salesQueryError.message
        : "Não foi possível consultar o RD Station.";
  const crmAvailability: MetricAvailability = isLoadingSelectedScope || loadingRDIntegration
    ? (crmUpdatedAt ? { state: "stale", reason: "Atualizando o escopo selecionado; o último snapshot permanece visível." } : { state: "loading" })
    : crmError
      ? (crmUpdatedAt ? { state: "partial", reason: "Uma fonte falhou; o último snapshot permanece visível." } : { state: "unavailable", reason: crmErrorMessage })
      : crmUpdatedAt
        ? (dealData.length ? { state: "fresh" } : { state: "empty_confirmed" })
        : { state: "loading" };
  const funnels = useMemo(() => isChangingAccountScope ? [] : funnelData, [funnelData, isChangingAccountScope]);
  const allDeals = useMemo(() => isChangingAccountScope ? [] : dealData, [dealData, isChangingAccountScope]);
  const canonicalSales = useMemo(() => isChangingAccountScope ? [] : salesData, [isChangingAccountScope, salesData]);

  useEffect(() => {
    if (adAccountId !== "all" && availableAccounts.length && !availableAccountIds.has(adAccountId)) setAdAccountId("all");
  }, [adAccountId, availableAccountIds, availableAccounts.length, setAdAccountId]);

  // Historical RD rows can remain in the database after a funnel is detached.
  // They are retained for audit, but must not create phantom columns or appear
  // in the operational CRM. The board has exactly the active RD funnels that
  // are still linked in Integrations.
  const connectedFunnels = useMemo(
    () => funnels.filter((funnel) => funnel.is_active && !!funnel.rd_funnel_id && requestedFunnelIds.includes(funnel.id)),
    [funnels, requestedFunnelIds],
  );
  // CRM is driven by the Meta account selector. Each active RD funnel linked
  // to that account becomes its pipeline scope automatically; users should
  // never need to reconcile a second, independent funnel filter.
  const funnelScopeIds = useMemo(
    () => connectedFunnels.map((funnel) => funnel.id),
    [connectedFunnels],
  );
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
      isDealInRDAccountOrFunnelScope(deal, accountScopeIds, funnelScopeIds)
      && !isExcludedLegacyRannielyStage(connectedFunnelNameById.get(deal.rd_funnel_id || ""), deal.rd_stage_name),
    )),
    [allDeals, accountScopeIds, connectedFunnelNameById, funnelScopeIds],
  );
  const scopedSales = useMemo(() => canonicalSales.filter((sale) =>
    !!sale.ad_account_id
    && accountScopeSet.has(sale.ad_account_id)
    && (!sale.rd_deal_id || !excludedDealIds.has(sale.rd_deal_id)),
  ), [accountScopeSet, canonicalSales, excludedDealIds]);
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
  const editableFunnels = useMemo<EditablePipeline[]>(() => {
    const connectionId = selectedDeal?.rd_connection_id || connectedFunnels.find((funnel) => funnel.id === selectedDeal?.rd_funnel_id)?.rd_connection_id;
    if (!connectionId) return [];
    return availableFunnels
      .filter((funnel) => funnel.rd_connection_id === connectionId && !!funnel.rd_funnel_id)
      .map((funnel) => ({ id: funnel.id, name: funnel.name, rd_funnel_id: funnel.rd_funnel_id!, rd_connection_id: funnel.rd_connection_id }));
  }, [availableFunnels, connectedFunnels, selectedDeal]);
  const editableFunnelIds = useMemo(() => editableFunnels.map((funnel) => funnel.id), [editableFunnels]);
  const { data: editableStages = [] } = useFunnelStagesForIds(editableFunnelIds);
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
  }, [adAccountId, endDate, owner, preset, query, selectedFunnelIds, startDate, status]);

  const funnelNames = useMemo(() => new Map(connectedFunnels.map((funnel) => [funnel.id, funnel.name])), [connectedFunnels]);
  const rdScope = useMemo<RDQueryScope>(() => ({
    accountIds: accountScopeIds,
    funnelIds: funnelScopeIds,
    startDate,
    endDate,
    dateRule: "created_at_for_open_closed_at_for_won",
  }), [accountScopeIds, endDate, funnelScopeIds, startDate]);
  // O quadro e os indicadores usam o mesmo recorte do calendário. A exceção
  // é o preset "Máximo", que solicita explicitamente todo o histórico.
  const dealsInPipeline = scopedDeals;
  const dealsInSelectedPeriod = useMemo(
    () => preset === "max" ? scopedDeals : scopedDeals.filter((deal) => isRDDealInScopePeriod(deal, { ...rdScope, accountIds: [], funnelIds: [] })),
    [preset, rdScope, scopedDeals],
  );
  const wonDealsInSelectedPeriod = useMemo(
    () => preset === "max"
      ? scopedDeals.filter((deal) => deal.win || isWonRDStageName(deal.rd_stage_name))
      : scopedDeals.filter((deal) => isCanonicalWonDealInPeriod(deal, startDate, endDate)),
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
    // Summary KPIs use the selected period while the Kanban above remains the
    // current RD pipeline, including older negotiations still in progress.
    const won = wonDealsInSelectedPeriod;
    const lost = dealsInSelectedPeriod.filter((deal) => classifyLead(deal) === "lost" || classifyLead(deal) === "disqualified");
    const active = dealsInSelectedPeriod.filter((deal) => {
      const bucket = classifyLead(deal);
      return bucket === "open" || bucket === "qualified";
    });
    const wonIds = new Set(won.map((deal) => deal.rd_deal_id));
    const realized = aggregateRevenueSources(scopedSales.filter((sale) => sale.rd_deal_id && wonIds.has(sale.rd_deal_id)), won);
    return {
      total: dealsInSelectedPeriod.length,
      active: active.length,
      openRevenue: active.reduce((sum, deal) => sum + getOpportunityAmount(deal), 0),
      won: won.length,
      wonRevenue: realized.totalNet,
      lost: lost.length,
      conversion: dealsInSelectedPeriod.length ? (won.length / dealsInSelectedPeriod.length) * 100 : 0,
    };
  }, [dealsInSelectedPeriod, getOpportunityAmount, scopedSales, wonDealsInSelectedPeriod]);

  const boardStageModel = useMemo(() => {
    const map = new Map<string, PipelineStage>();
    const sourceToCanonicalId = new Map<string, string>();

    if (isConsolidatedView) {
      const addCanonicalStage = (source: {
        rd_funnel_id: string | null;
        rd_stage_id?: string | null;
        name: string | null;
        order: number | null;
        is_won?: boolean;
        is_lost?: boolean;
      }) => {
        const canonical = consolidatedCRMStage({
          name: source.name,
          order: source.order,
          won: source.is_won,
          lost: source.is_lost,
        });
        if (source.rd_stage_id) sourceToCanonicalId.set(rdPipelineStageKey(source.rd_funnel_id, source.rd_stage_id), canonical.id);
        const current = map.get(canonical.id);
        if (!current || canonical.order < current.order) {
          map.set(canonical.id, {
            id: canonical.id,
            name: canonical.name,
            order: canonical.order,
            won: canonical.won,
            lost: canonical.lost,
          });
        }
      };

      for (const stage of visibleStoredStages) addCanonicalStage(stage);
      for (const deal of dealsInPipeline) addCanonicalStage({
        rd_funnel_id: deal.rd_funnel_id,
        rd_stage_id: deal.rd_stage_id,
        name: deal.rd_stage_name,
        order: deal.rd_stage_order,
        is_won: deal.win || deal.stage_bucket === "client",
        is_lost: deal.stage_bucket === "lost" || deal.stage_bucket === "disqualified",
      });

      return {
        stages: Array.from(map.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")),
        sourceToCanonicalId,
      };
    }

    // RD can retain two local stage snapshots with different provider IDs
    // after a stage was renamed/recreated. The provider UI exposes these as
    // one named column, so merge the snapshots while retaining every source
    // ID for deal placement and stage editing.
    const merged = mergeCRMStageSources([
      ...visibleStoredStages.map((stage) => ({
        sourceId: rdPipelineStageKey(stage.rd_funnel_id, stage.rd_stage_id),
        funnelId: stage.rd_funnel_id,
        stageId: stage.rd_stage_id,
        name: stage.name,
        order: stage.order,
        won: stage.is_won,
        lost: stage.is_lost,
      })),
      ...dealsInPipeline.map((deal) => ({
        sourceId: rdPipelineStageKey(deal.rd_funnel_id, deal.rd_stage_id),
        funnelId: deal.rd_funnel_id,
        stageId: deal.rd_stage_id,
        name: deal.rd_stage_name,
        order: deal.rd_stage_order,
        won: classifyLead(deal) === "won",
        lost: classifyLead(deal) === "lost" || classifyLead(deal) === "disqualified",
      })),
    ], { preserveFunnelBoundaries: false });
    for (const stage of merged.stages) {
      map.set(stage.id, {
        id: stage.id,
        name: stage.name,
        order: stage.order,
        won: stage.won,
        lost: stage.lost,
        rdFunnelId: stage.funnelId,
        rdStageId: stage.stageId,
      });
    }
    for (const [sourceId, canonicalId] of merged.sourceToCanonicalId) sourceToCanonicalId.set(sourceId, canonicalId);
    return {
      stages: Array.from(map.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")),
      sourceToCanonicalId,
    };
  }, [dealsInPipeline, isConsolidatedView, visibleStoredStages]);
  const stages = boardStageModel.stages;

  const stageDeals = useMemo(() => {
    const map = new Map<string, RDDealLite[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of deals) {
      const sourceKey = rdPipelineStageKey(deal.rd_funnel_id, deal.rd_stage_id);
      const stageId = boardStageModel.sourceToCanonicalId.get(sourceKey)
        || (isConsolidatedView ? canonicalStageForDeal(deal).id : sourceKey);
      const current = map.get(stageId) || [];
      current.push(deal);
      map.set(stageId, current);
    }
    return map;
  }, [boardStageModel.sourceToCanonicalId, deals, isConsolidatedView, stages]);

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
    setSyncWarning(null);
    try {
      const syncResults: Array<{ deals?: number; pages_processed?: number; stage_sync_warning?: string | null }> = [];
      for (const funnel of connectedFunnels) {
        const syncBody = {
          funnel_id: funnel.id,
          // This is an explicit user action, so synchronize every RD status
          // in the connected RD pipeline. This explicit action reconciles the
          // provider snapshot independently of the visual calendar scope;
          // the refreshed rows are then queried according to that scope.
          realtime: false,
          analytics_mode: true,
          // The historical mirror is intentionally list-first. Hydrating each
          // deal through RD detail/contact endpoints can orphan a large run
          // before its page cursor is persisted. Existing profiles stay
          // intact; missing contact fields use a separate bounded path.
          refresh_amounts: false,
          // "Máximo" is a full RD pipeline reconciliation, not a synthetic
          // date interval beginning in 2000. The RD API's date filter can
          // omit legacy/open negotiations in some accounts.
          // A manual refresh is explicit user intent: reconcile the entire
          // RD history instead of truncating at a page/deal ceiling. Do not
          // send the dashboard calendar here: doing so turns a pipeline
          // mirror into a period report and silently drops older stages.
          full_history: true,
          trigger_source: "crm_history_refresh",
        };

        // The RD Edge Function deliberately stops before its runtime budget
        // and stores a cursor. A single HTTP call therefore represents one
        // resumable chunk, not necessarily the complete pipeline. Continue
        // the same explicit refresh until the provider reports a complete
        // snapshot; without this loop a 1,176-deal pipeline stopped at the
        // first ~600 rows while the UI reported a successful refresh.
        let latestResult: (typeof syncResults)[number] | null = null;
        // A large RD pipeline can require several runtime-sized chunks. The
        // edge function persists the next cursor before yielding, so this
        // explicit refresh can safely drain the complete snapshot without
        // re-reading the same page forever.
        const MAX_RESUMABLE_PASSES = 24;
        for (let pass = 0; pass < MAX_RESUMABLE_PASSES; pass++) {
          const { data, error } = await supabase.functions.invoke("rd-sync-deals", { body: syncBody });
          // A historical refresh is resumable. The Edge Function returns
          // HTTP 200 with `partial: true` while it checkpoints the next RD
          // page; only transport errors or non-resumable responses should
          // abort the loop and preserve the previous snapshot.
          if (error || data?.error || (data?.success === false && !data?.partial)) {
            const details = data?.snapshot_missing_ids?.length
              ? ` IDs ausentes: ${data.snapshot_missing_ids.slice(0, 5).join(", ")}`
              : "";
            throw error || new Error(`${data?.error || "Snapshot RD incompleto."}${details}`);
          }
          latestResult = data;
          if (data?.status === "already_running") {
            throw new Error("Este funil já está sendo sincronizado. Aguarde o ciclo atual terminar e atualize novamente.");
          }
          if (data?.complete !== false && !data?.partial) break;
          if (pass === MAX_RESUMABLE_PASSES - 1) {
            throw new Error("O RD ainda não concluiu todas as páginas. A sincronização foi preservada e pode ser retomada sem duplicar registros.");
          }
        }
        syncResults.push(latestResult || {});
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
      ]);
      const deals = syncResults.reduce((sum, result) => sum + Number(result?.deals || 0), 0);
      const pages = syncResults.reduce((sum, result) => sum + Number(result?.pages_processed || 0), 0);
      const warnings = syncResults.map((result) => result.stage_sync_warning).filter(Boolean);
      if (warnings.length) {
        const message = `RD reconciliado: ${deals} negócios em ${pages} páginas. ${warnings.join(" ")}`;
        setSyncWarning(message);
        toast.warning(message);
      } else {
        toast.success(`RD reconciliado: ${deals} negócios em ${pages} páginas.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar o RD Station.";
      setSyncWarning(`Último snapshot mantido; sincronização pendente: ${message}`);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  async function moveRDDeal(deal: RDDealLite, destination: PipelineStage) {
    if (isConsolidatedView || !destination.rdStageId || !destination.rdFunnelId) {
      toast.error("Selecione uma única conta RD para movimentar uma negociação.");
      return;
    }
    if (!rdIntegration?.write_enabled) {
      toast.error("Habilite a escrita governada no card de integração do RD Station.");
      return;
    }
    const connectionId = deal.rd_connection_id || connectedFunnels.find((funnel) => funnel.id === destination.rdFunnelId)?.rd_connection_id;
    if (!connectionId) {
      toast.error("Esta negociação não tem uma conexão RD identificada.");
      return;
    }
    const previous = queryClient.getQueriesData({ queryKey: ["rd_crm_deals"] });
    const optimisticBucket = destination.won ? "client" : destination.lost ? "lost" : "opportunity";
    queryClient.setQueriesData({ queryKey: ["rd_crm_deals"] }, (current: RDDealLite[] | undefined) => current?.map((item) => item.id === deal.id ? {
      ...item,
      rd_funnel_id: destination.rdFunnelId || item.rd_funnel_id,
      rd_stage_id: destination.rdStageId,
      rd_stage_name: destination.name,
      rd_stage_order: destination.order,
      stage_bucket: optimisticBucket,
      win: destination.won,
      stage_updated_at: new Date().toISOString(),
    } : item));
    try {
      const { data, error } = await supabase.functions.invoke("rd-move-deal", {
        body: {
          rd_connection_id: connectionId,
          rd_deal_id: deal.rd_deal_id,
          destination_rd_funnel_id: destination.rdFunnelId,
          deal_stage_id: destination.rdStageId,
          correlation_id: crypto.randomUUID(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deal_stage_history"] }),
      ]);
      setSelectedDeal((current) => current?.id === deal.id ? {
        ...current,
        rd_funnel_id: destination.rdFunnelId || current.rd_funnel_id,
        rd_stage_id: destination.rdStageId || current.rd_stage_id,
        rd_stage_name: destination.name,
        rd_stage_order: destination.order,
        stage_bucket: optimisticBucket,
        win: destination.won,
        stage_updated_at: new Date().toISOString(),
      } : current);
      toast.success(data?.noop ? "A negociação já estava nessa etapa." : "Negociação movida no RD Station.");
    } catch (error) {
      for (const [key, data] of previous) queryClient.setQueryData(key, data);
      toast.error(error instanceof Error ? error.message : "Não foi possível mover a negociação no RD Station.");
    }
  }

  async function updateRDDeal(deal: RDDealLite, fields: Record<string, unknown>) {
    if (!rdIntegration?.write_enabled) {
      toast.error("Habilite a escrita governada no card de integração do RD Station.");
      return;
    }
    const connectionId = deal.rd_connection_id || connectedFunnels.find((funnel) => funnel.id === deal.rd_funnel_id)?.rd_connection_id;
    if (!connectionId) {
      toast.error("Esta negociação não tem uma conexão RD identificada.");
      return;
    }
    const dealUpdate = serializeRDDealUpdate(fields);
    try {
      const { data, error } = await supabase.functions.invoke("rd-update-deal", {
        body: {
          rd_connection_id: connectionId,
          rd_deal_id: deal.rd_deal_id,
          fields: dealUpdate.fields,
          confirm_loss: dealUpdate.confirm_loss,
          correlation_id: crypto.randomUUID(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
      ]);
      setSelectedDeal(null);
      toast.success(data?.noop ? "A negociação já estava com esses dados." : "Negociação atualizada no RD Station.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a negociação no RD Station.");
    }
  }

  async function updateRDTracking(deal: RDDealLite, tracking: ManualTracking, useAutomatic = false) {
    if (!rdIntegration?.write_enabled) {
      toast.error("Habilite a escrita governada no card de integração do RD Station.");
      return;
    }
    const connectionId = deal.rd_connection_id || connectedFunnels.find((funnel) => funnel.id === deal.rd_funnel_id)?.rd_connection_id;
    if (!connectionId) {
      toast.error("Esta negociação não tem uma conexão RD identificada.");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("rd-update-tracking", {
        body: { rd_connection_id: connectionId, rd_deal_id: deal.rd_deal_id, tracking: normalizeTrackingDraft(tracking), use_automatic: useAutomatic, correlation_id: crypto.randomUUID() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }), queryClient.invalidateQueries({ queryKey: ["rd_deals"] })]);
      setSelectedDeal(null);
      if (Array.isArray(data?.rd_unmapped) && data.rd_unmapped.length) toast.warning(`Rastreamento salvo nos dois lados. O RD recebeu uma anotação para: ${data.rd_unmapped.join(", ")}.`);
      else toast.success(useAutomatic ? "Rastreamento automático restaurado no RD Station." : "Rastreamento atualizado no Growdash e no RD Station.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o rastreamento no RD Station.");
    }
  }

  async function updateRDContact(deal: RDDealLite, fields: Record<string, unknown>) {
    if (!rdIntegration?.write_enabled) {
      toast.error("Habilite a escrita governada no card de integração do RD Station.");
      return;
    }
    const connectionId = deal.rd_connection_id || connectedFunnels.find((funnel) => funnel.id === deal.rd_funnel_id)?.rd_connection_id;
    if (!connectionId) {
      toast.error("Esta negociação não tem uma conexão RD identificada.");
      return;
    }
    try {
      const operation = deal.contact_email || deal.contact_name ? "update" : "create";
      const { data, error } = await supabase.functions.invoke("rd-contact-write", {
        body: { operation, rd_connection_id: connectionId, rd_deal_id: deal.rd_deal_id, fields, correlation_id: crypto.randomUUID() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
      ]);
      setSelectedDeal(null);
      toast.success(data?.noop ? "O contato já estava vinculado à negociação." : "Contato atualizado no RD Station.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o contato no RD Station.");
    }
  }

  return (
    <div className="crm-page gd-module-shell mx-auto max-w-[1700px] space-y-5">
      <PageHeading
        eyebrow="RD Station CRM"
        title="Negociações"
        description={preset === "max"
          ? "Pipeline completo do RD Station, com todo o histórico disponível."
          : "Negociações do RD Station no período selecionado: abertas pela criação e ganhas pela data de fechamento."}
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

      <section className="crm-filter-strip gd-panel mb-4 p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-3">
          <Search className="h-4 w-4 text-primary" />
          <div><h2 className="text-sm font-black text-foreground">Filtros e escopo</h2><p className="text-[11px] text-muted-foreground">A conta define os funis RD vinculados. O quadro e os indicadores respeitam o período selecionado; escolha “Máximo” para consultar todo o histórico.</p></div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.2fr)_minmax(180px,.82fr)_minmax(170px,.72fr)_minmax(235px,.95fr)_auto]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar negociações" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-10" placeholder="Buscar contato, e-mail, campanha, produto ou cidade" />
          </label>
          <select aria-label="Filtrar por responsável" value={owner} onChange={(event) => setOwner(event.target.value)} className="gd-button h-11 min-w-0">
            <option value="all">Todos os responsáveis</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <div className="crm-filter-status flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
            {([ ["all", "Todos"], ["open", "Abertos"], ["won", "Ganhos"], ["lost", "Perdidos"] ] as [StatusFilter, string][]).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-black transition", status === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground")}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
          <span>{crmBoardSummaryLabel(crmAvailability.state, deals.length)}{!["loading", "unavailable"].includes(crmAvailability.state) && <> · {preset === "max" ? "histórico completo" : `${number.format(dealsInSelectedPeriod.length)} no período selecionado`}{isConsolidatedView ? " · pipeline consolidado das contas selecionadas" : funnelScopeIds.length === 1 ? ` · funil vinculado: ${connectedFunnels[0]?.name}` : funnelScopeIds.length > 1 ? ` · ${funnelScopeIds.length} funis selecionados` : " · nenhum funil RD vinculado"}{!rdEnabled && connectedFunnels.length ? " · dados compartilhados pelo proprietário do funil" : ""}</>}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {isFetching || syncing ? "Atualizando em segundo plano…" : lastUpdatedAt ? `Atualizado ${formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true, locale: ptBR })}` : "Aguardando primeira sincronização"}</span>
        </div>
      </section>

      {syncWarning && (
        <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {syncWarning}
        </div>
      )}

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
              source="RD Station CRM"
              label="Negociações criadas no período"
              value={number.format(stats.total)}
              description={`${number.format(stats.active)} ativas · ${number.format(stats.won)} fechadas como ganhas no período`}
              icon={<Columns3 className="h-4 w-4" />}
              tone="rd"
              availability={crmAvailability}
            />
            <CrmMetricCard
              source="Comercial · RD"
              label="Receita em aberto"
              value={brl.format(stats.openRevenue)}
              description="Soma das negociações ativas no RD Station"
              icon={<CircleDollarSign className="h-4 w-4" />}
              tone="revenue"
              availability={crmAvailability}
            />
            <CrmMetricCard
              source="Comercial · RD"
              label="Faturamento líquido ganho"
              value={brl.format(stats.wonRevenue)}
              description={`${number.format(stats.won)} fechamento(s) ganho(s) no período`}
              icon={<Trophy className="h-4 w-4" />}
              tone="success"
              availability={crmAvailability}
            />
            <CrmMetricCard
              source="Conversão · RD"
              label="Taxa de conversão"
              value={`${stats.conversion.toFixed(2)}%`}
              description={`${number.format(stats.won)} fechamentos ganhos de ${number.format(stats.total)} negociações · ${number.format(stats.lost)} perdidas`}
              icon={<Target className="h-4 w-4" />}
              tone="success"
              availability={crmAvailability}
            />
            <CrmMetricCard
              source="CRM próprio · webhook"
              label="Leads recebidos"
              value={number.format(firstPartyLeadsInPeriod.length)}
              description={`${number.format(firstPartyLeadsInPeriod.filter((lead: { status?: string }) => lead.status === "new").length)} novos · UTMs preservadas na entrada`}
              icon={<UsersRound className="h-4 w-4" />}
              tone="meta"
              availability={crmAvailability}
            />
          </div>
        </section>
      )}

      {funnelsError && !backendUnavailable ? (
        <section role="alert" className="gd-panel mt-4 grid min-h-48 place-items-center p-6 text-center">
          <div className="max-w-md"><UsersRound className="mx-auto h-9 w-9 text-destructive" /><h2 className="mt-4 font-black">Não foi possível carregar os funis RD</h2><p className="mt-2 text-sm text-muted-foreground">{funnelsQueryError instanceof Error ? funnelsQueryError.message : "A consulta dos funis falhou. Verifique a conexão RD e tente novamente."}</p><Button className="mt-4" variant="outline" onClick={() => void refetchFunnels()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>
        </section>
      ) : backendUnavailable ? (
        <section role="status" className="gd-panel mt-4 grid min-h-48 place-items-center p-6 text-center">
          <div className="max-w-lg"><Clock3 className="mx-auto h-9 w-9 text-amber-500" /><h2 className="mt-4 font-black">Sincronização RD aguardando</h2><p className="mt-2 text-sm text-muted-foreground">O serviço de dados está temporariamente indisponível. A Growdash manteve o shell utilizável e tentará novamente quando a conexão voltar.</p><Button className="mt-4" variant="outline" onClick={() => void refetchFunnels()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>
        </section>
      ) : isLoadingSelectedScope ? <CRMLoading /> : dealsError ? (
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
          onMove={(deal, stage) => void moveRDDeal(deal, stage)}
          canMove={!isConsolidatedView && rdEnabled && rdIntegration?.write_enabled === true}
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

      {!funnelsError && !isLoadingSelectedScope && !dealsError && !deals.length && view !== "ai" && (
        <section className="gd-panel mt-4 grid min-h-64 place-items-center p-6 text-center">
          <div><UsersRound className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-4 font-black">Nenhuma negociação encontrada</h2><p className="mt-2 text-sm text-muted-foreground">{crmEmptyState({ hasFunnels: !!connectedFunnels.length, hasOwnIntegration: rdEnabled })}</p></div>
        </section>
      )}

      <DealDetails
        deal={selectedDeal}
        attribution={selectedAttribution}
        automaticAttribution={selectedAutomaticAttribution}
        funnelName={selectedDeal?.rd_funnel_id ? funnelNames.get(selectedDeal.rd_funnel_id) : undefined}
        funnels={editableFunnels}
        stages={editableStages as EditableStage[]}
        getOpportunityAmount={getOpportunityAmount}
        onClose={() => setSelectedDeal(null)}
        onUpdate={(deal, fields) => void updateRDDeal(deal, fields)}
        onTrackingUpdate={(deal, tracking, useAutomatic) => void updateRDTracking(deal, tracking, useAutomatic)}
        onContactUpdate={(deal, fields) => void updateRDContact(deal, fields)}
        onMove={(deal, destination) => void moveRDDeal(deal, destination)}
        onActivateWrite={() => { window.location.href = "/integracoes?tab=crm"; }}
        canWrite={rdIntegration?.write_enabled === true}
      />
    </div>
  );
}

function KanbanBoard({ stages, stageDeals, stageLimits, getOpportunityAmount, onLoadMore, onOpen, onMove, canMove }: {
  stages: PipelineStage[];
  stageDeals: Map<string, RDDealLite[]>;
  stageLimits: Record<string, number>;
  getOpportunityAmount: (deal: RDDealLite) => number;
  onLoadMore: (stageId: string) => void;
  onOpen: (deal: RDDealLite) => void;
  onMove: (deal: RDDealLite, stage: PipelineStage) => void;
  canMove: boolean;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const dealsById = new Map(Array.from(stageDeals.values()).flat().map((deal) => [deal.id, deal]));
  return (
    <section className="gd-panel mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><Columns3 className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-black">Pipeline de negociações</h2><p className="text-[10px] text-muted-foreground">Etapas na mesma ordem configurada no RD Station</p></div></div>
        <span className="hidden text-[10px] text-muted-foreground sm:block">{canMove ? "Arraste um cartão para mover no RD · clique para ver os dados" : "Clique em um cartão para ver todos os dados"}</span>
      </div>
      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="flex min-h-[520px] min-w-max items-start gap-3">
          {stages.map((stage) => {
            const deals = stageDeals.get(stage.id) || [];
            const total = deals.reduce((sum, deal) => sum + getOpportunityAmount(deal), 0);
            const limit = stageLimits[stage.id] || BOARD_STEP;
            return (
              <div key={stage.id} onDragOver={(event) => { if (canMove) { event.preventDefault(); setDragOverStage(stage.id); } }} onDragLeave={() => setDragOverStage(null)} onDrop={(event) => { if (!canMove) return; event.preventDefault(); const deal = dealsById.get(event.dataTransfer.getData("text/growdash-deal")); setDragOverStage(null); if (deal) onMove(deal, stage); }} className={cn("w-[286px] shrink-0 overflow-hidden rounded-2xl border bg-muted/25 transition-colors", dragOverStage === stage.id ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                <div className="sticky top-0 z-10 border-b border-border bg-background/95 p-3 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><StageDot won={stage.won} lost={stage.lost} /><h3 className="truncate text-xs font-black" title={stage.name}>{stage.name}</h3></div><p className="mt-1 pl-4 text-[10px] text-muted-foreground">{number.format(deals.length)} negócio(s) · {brl.format(total)}</p></div>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-black">{deals.length}</span>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-390px)] min-h-[440px] space-y-2 overflow-y-auto p-2">
                  {deals.slice(0, limit).map((deal) => <DealCard key={deal.id} deal={deal} getOpportunityAmount={getOpportunityAmount} onOpen={onOpen} canMove={canMove} />)}
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

function DealCard({ deal, getOpportunityAmount, onOpen, canMove }: { deal: RDDealLite; getOpportunityAmount: (deal: RDDealLite) => number; onOpen: (deal: RDDealLite) => void; canMove: boolean }) {
  const name = deal.contact_name || deal.contact_email || "Contato não informado";
  return (
    <button type="button" draggable={canMove} onDragStart={(event) => { if (canMove) event.dataTransfer.setData("text/growdash-deal", deal.id); }} onClick={() => onOpen(deal)} className="group w-full rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md">
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

function DealDetails({ deal, attribution, automaticAttribution, funnelName, funnels, stages, getOpportunityAmount, onClose, onUpdate, onTrackingUpdate, onContactUpdate, onMove, onActivateWrite, canWrite }: {
  deal: RDDealLite | null;
  attribution: LeadAttribution | null;
  automaticAttribution: LeadAttribution | null;
  funnelName?: string;
  funnels: EditablePipeline[];
  stages: EditableStage[];
  getOpportunityAmount: (deal: RDDealLite) => number;
  onClose: () => void;
  onUpdate: (deal: RDDealLite, fields: Record<string, unknown>) => void;
  onTrackingUpdate: (deal: RDDealLite, tracking: ManualTracking, useAutomatic: boolean) => void;
  onContactUpdate: (deal: RDDealLite, fields: Record<string, unknown>) => void;
  onMove: (deal: RDDealLite, stage: PipelineStage) => void;
  onActivateWrite: () => void;
  canWrite: boolean;
}) {
  const [winValue, setWinValue] = useState<DealEditStatus>("open");
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [holdValue, setHoldValue] = useState("false");
  const [rating, setRating] = useState("");
  const [predictionDate, setPredictionDate] = useState("");
  const [lostNote, setLostNote] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [note, setNote] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [trackingDraft, setTrackingDraft] = useState<ManualTracking>({});
  const initialEdit = useRef<DealEditDraft | null>(null);
  const notes = useRDDealNotes(deal?.id ?? null);
  const createNote = useCreateRDDealNote();
  const stageHistory = useQuery({
    queryKey: ["rd_deal_stage_history", deal?.id],
    enabled: !!deal?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("rd_deal_stage_history")
        .select("id,from_stage_name,to_stage_name,source,changed_at,metadata")
        .eq("rd_deal_id", deal!.id)
        .order("changed_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!deal) return;
    const raw = deal.raw && typeof deal.raw === "object" ? deal.raw : {};
    const nested = raw.deal;
    const rawDeal = nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Record<string, unknown> : raw;
    const nextStatus = statusFromRDDeal(deal);
    const nextDraft: DealEditDraft = {
      name: String(rawDeal.name || deal.contact_name || ""),
      amount: formatDealAmountInput(Number(rawDeal.amount ?? rawDeal.amount_total ?? deal.amount_total ?? 0)),
      status: nextStatus,
      hold: rawDeal.hold === true,
      rating: rawDeal.rating == null ? "" : String(rawDeal.rating),
      predictionDate: typeof rawDeal.prediction_date === "string" ? rawDeal.prediction_date.slice(0, 10) : "",
      lostNote: String(rawDeal.deal_lost_note || ""),
    };
    initialEdit.current = nextDraft;
    setWinValue(nextStatus);
    setDealName(nextDraft.name);
    setDealAmount(nextDraft.amount);
    setHoldValue(nextDraft.hold ? "true" : "false");
    setRating(nextDraft.rating);
    setPredictionDate(nextDraft.predictionDate);
    setLostNote(nextDraft.lostNote);
    setContactName(deal.contact_name || "");
    setContactEmail(deal.contact_email || "");
    setNote("");
    setSelectedFunnelId(deal.rd_funnel_id || "");
    setSelectedStageId(deal.rd_stage_id || "");
    const source = attribution || automaticAttribution;
    setTrackingDraft(source ? {
      source: source.source,
      campaign: source.campaignName,
      adset: source.adsetName,
      creative: source.adName,
      form: source.formName || source.formId,
      platform: source.platform,
      placement: source.placement,
      isOrganic: source.isOrganic,
    } : {});
  }, [attribution, automaticAttribution, deal]);

  if (!deal) return null;
  const fields = Object.entries(deal.custom_fields || {}).filter(([, value]) => value != null && String(value).trim());
  const stagesForFunnel = stages.filter((stage) => stage.rd_funnel_id === selectedFunnelId).sort((a, b) => a.order - b.order);
  const selectedStage = stagesForFunnel.find((stage) => stage.rd_stage_id === selectedStageId);
  const selectedFunnel = funnels.find((funnel) => funnel.id === selectedFunnelId);
  const noteConnectionId = deal.rd_connection_id || selectedFunnel?.rd_connection_id || "";
  const draft: DealEditDraft = {
    name: dealName,
    amount: dealAmount,
    status: winValue,
    hold: holdValue === "true",
    rating,
    predictionDate,
    lostNote,
  };
  const fieldsToUpdate = initialEdit.current ? buildRDDealUpdate(initialEdit.current, draft) : {};
  const invalidDealAmount = parseDealAmount(dealAmount) === null;
  const canSaveDeal = canWrite && !invalidDealAmount && !!dealName.trim() && Object.keys(fieldsToUpdate).length > 0;
  const hasManualTracking = Object.keys(deal.manual_tracking || {}).length > 0;

  const saveDealFields = () => {
    if (!canWrite) return onActivateWrite();
    if (!Object.keys(fieldsToUpdate).length) return;
    onUpdate(deal, fieldsToUpdate);
  };

  const submitNote = async () => {
    if (!canWrite) return onActivateWrite();
    const body = note.trim();
    if (!body || !noteConnectionId) return;
    try {
      await createNote.mutateAsync({ dealId: deal.id, rdConnectionId: noteConnectionId, rdProviderDealId: deal.rd_deal_id, body });
      setNote("");
      toast.success("Anotação enviada para o RD Station.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a anotação.");
    }
  };

  return (
    <Sheet open={!!deal} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-7">
          <SheetTitle className="text-xl font-black">{deal.contact_name || deal.contact_email || "Negociação sem contato"}</SheetTitle>
          <SheetDescription>Visão da negociação, histórico e ações sincronizadas com o RD Station CRM.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DetailMetric icon={<CircleDollarSign />} label="Valor estimado" value={brl.format(getOpportunityAmount(deal))} />
          <DetailMetric icon={<Target />} label="Etapa" value={deal.rd_stage_name || "Sem etapa"} />
          <DetailMetric icon={<UserRound />} label="Responsável" value={deal.deal_owner_name || "Não informado"} />
          <DetailMetric icon={deal.win ? <Trophy /> : <XCircle />} label="Situação" value={statusLabel(deal)} />
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Editar negociação</h3><p className="mt-1 text-[10px] text-muted-foreground">Atualize o valor investido e os demais campos diretamente no RD Station.</p></div><Pencil className="h-4 w-4 text-primary" /></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2"><span>Nome da negociação</span><Input value={dealName} onChange={(event) => setDealName(event.target.value)} disabled={!canWrite} /></label>
            <label className="grid gap-1.5 text-xs font-bold"><span>Valor investido (R$)</span><Input inputMode="decimal" value={dealAmount} onChange={(event) => setDealAmount(event.target.value)} disabled={!canWrite} placeholder="0,00" /></label>
            <label className="grid gap-1.5 text-xs font-bold"><span>Situação</span><select value={winValue} onChange={(event) => setWinValue(event.target.value as DealEditStatus)} disabled={!canWrite} className="h-10 rounded-lg border border-border bg-background px-3"><option value="open">Em aberto</option><option value="won">Venda ganha</option><option value="lost">Venda perdida</option></select></label>
            <label className="grid gap-1.5 text-xs font-bold"><span>Em espera</span><select value={holdValue} onChange={(event) => setHoldValue(event.target.value)} disabled={!canWrite} className="h-10 rounded-lg border border-border bg-background px-3"><option value="false">Não</option><option value="true">Sim</option></select></label>
            <label className="grid gap-1.5 text-xs font-bold"><span>Classificação (0–5)</span><Input inputMode="decimal" value={rating} onChange={(event) => setRating(event.target.value)} disabled={!canWrite} placeholder="Não informado" /></label>
            <label className="grid gap-1.5 text-xs font-bold"><span>Data prevista</span><Input type="date" value={predictionDate} onChange={(event) => setPredictionDate(event.target.value)} disabled={!canWrite} /></label>
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2"><span>Observação de perda</span><Input value={lostNote} onChange={(event) => setLostNote(event.target.value)} disabled={!canWrite} placeholder="Preencha quando aplicável" /></label>
          </div>
          {invalidDealAmount && <p className="mt-2 text-[10px] font-semibold text-destructive">Informe um valor válido, por exemplo: 12.500,00.</p>}
          <Button type="button" className="mt-3" disabled={canWrite ? !canSaveDeal : false} onClick={saveDealFields}>{canWrite ? "Salvar informações no RD" : "Ativar escrita no RD"}</Button>
          <p className="mt-2 text-[10px] text-muted-foreground">{canWrite ? "A alteração é validada no backend, auditada antes da chamada e sincronizada de volta ao espelho." : "A escrita está desativada. O proprietário precisa autorizá-la no card de integração do RD."}</p>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2"><Columns3 className="h-4 w-4 text-primary" /><div><h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Mover no RD Station</h3><p className="mt-1 text-[10px] text-muted-foreground">A etapa destino define automaticamente o pipeline no RD.</p></div></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold"><span>Pipeline</span><select value={selectedFunnelId} onChange={(event) => { setSelectedFunnelId(event.target.value); setSelectedStageId(""); }} disabled={!canWrite || !funnels.length} className="h-10 rounded-lg border border-border bg-background px-3">{!funnels.length && <option value="">Pipeline não disponível</option>}{funnels.map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-bold"><span>Etapa</span><select value={selectedStageId} onChange={(event) => setSelectedStageId(event.target.value)} disabled={!canWrite || !stagesForFunnel.length} className="h-10 rounded-lg border border-border bg-background px-3">{!stagesForFunnel.length && <option value="">Etapas não disponíveis</option>}{stagesForFunnel.map((stage) => <option key={stage.rd_stage_id} value={stage.rd_stage_id}>{stage.name}</option>)}</select></label>
          </div>
          <Button type="button" className="mt-3" variant="outline" disabled={!canWrite || !selectedStage || !selectedFunnel || (selectedFunnel.id === deal.rd_funnel_id && selectedStage.rd_stage_id === deal.rd_stage_id)} onClick={() => selectedStage && selectedFunnel && onMove(deal, { id: `${selectedFunnel.id}:${selectedStage.rd_stage_id}`, name: selectedStage.name, order: selectedStage.order, won: selectedStage.is_won, lost: selectedStage.is_lost, rdFunnelId: selectedFunnel.id, rdStageId: selectedStage.rd_stage_id })}>Salvar pipeline e etapa no RD</Button>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
          <div className="flex items-start gap-3"><MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h3 className="text-sm font-black uppercase tracking-wide text-foreground sm:text-base">Anotações e histórico</h3><p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">A anotação fica na Growdash e é enviada para a timeline da negociação no RD.</p></div></div>
          <div className="mt-5 flex items-end gap-3"><Textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={!canWrite} placeholder="Escreva uma anotação comercial…" maxLength={4000} rows={3} className="min-h-24 resize-y bg-background text-sm leading-6 sm:text-base" onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submitNote(); }} /><Button type="button" size="icon" className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" aria-label="Enviar anotação" disabled={canWrite ? !note.trim() || createNote.isPending : false} onClick={() => void submitNote()}>{canWrite ? <Send className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}</Button></div>
          <div className="mt-7 space-y-5 border-l-2 border-primary/20 pl-5 sm:pl-7">{notes.isLoading && <p className="text-sm text-muted-foreground">Carregando anotações do RD e da Growdash…</p>}{notes.data?.map((item) => <article key={`${item.source}-${item.id}`} className="relative rounded-2xl border border-border bg-background p-5 shadow-sm before:absolute before:-left-[27px] before:top-6 before:h-3 before:w-3 before:rounded-full before:border-2 before:border-background before:bg-primary sm:before:-left-[35px]"><p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground sm:text-base">{item.body}</p><p className="mt-4 text-xs leading-5 text-muted-foreground sm:text-sm">{item.author_name} · {item.source === "rd" ? "RD Station" : "Growdash"} · {fullDate(item.created_at)}</p></article>)}{(stageHistory.data as RDStageHistoryRow[] | undefined)?.map((item) => <article key={item.id} className="relative rounded-2xl border border-dashed border-border bg-background/70 p-5 before:absolute before:-left-[27px] before:top-6 before:h-3 before:w-3 before:rounded-full before:border-2 before:border-background before:bg-muted-foreground sm:before:-left-[35px]"><p className="text-sm font-bold leading-6 text-foreground sm:text-base">Etapa alterada: {item.from_stage_name || "—"} → {item.to_stage_name || "—"}</p><p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">{item.source === "rd_sync" ? "Sincronizado do RD" : item.source} · {fullDate(item.changed_at)}</p></article>)}{!notes.isLoading && !notes.data?.length && !stageHistory.data?.length && <p className="text-sm text-muted-foreground">Nenhuma anotação ou movimentação encontrada.</p>}</div>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
          <h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Contato vinculado no RD</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold"><span>Nome</span><Input value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={!canWrite} /></label><label className="grid gap-1.5 text-xs font-bold"><span>E-mail</span><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} disabled={!canWrite} /></label></div>
          <Button type="button" className="mt-3" variant="outline" disabled={!canWrite || (!contactName.trim() && !contactEmail.trim())} onClick={() => onContactUpdate(deal, { name: contactName.trim(), emails: contactEmail.trim() ? [{ email: contactEmail.trim() }] : [] })}>{deal.contact_name || deal.contact_email ? "Salvar contato no RD" : "Criar contato no RD"}</Button>
        </section>

        <div className="mt-5 rounded-2xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-3"><div><h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Dados da negociação</h3><p className="mt-1 text-[10px] text-muted-foreground">Os campos de rastreamento podem ser editados aqui e espelhados no RD Station.</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => canWrite ? onTrackingUpdate(deal, trackingDraft, false) : onActivateWrite()}>{canWrite ? "Salvar rastreamento" : "Ativar escrita"}</Button><Button type="button" size="sm" variant="outline" disabled={!canWrite || !hasManualTracking} onClick={() => onTrackingUpdate(deal, {}, true)}>Usar automático</Button></div></div>
          <div className="divide-y divide-border">
          <DetailRow icon={<Columns3 />} label="Funil" value={selectedFunnel?.name || funnelName || "Funil RD"} />
          <DetailRow icon={<Mail />} label="E-mail" value={deal.contact_email || "Não informado"} />
          <DetailRow icon={<MapPin />} label="Localização" value={[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || "Não informada"} />
          <DetailRow icon={<UsersRound />} label="Produto" value={deal.rd_product_name || "Não informado"} />
          {([['source', 'Origem'], ['campaign', 'Campanha'], ['adset', 'Conjunto'], ['creative', 'Criativo'], ['form', 'Formulário Meta'], ['platform', 'Plataforma Meta'], ['placement', 'Posicionamento']] as const).map(([key, label]) => <DetailRow key={key} icon={<Target />} label={label} value={String(trackingDraft[key] ?? '') || 'Não informado'} editable={canWrite} editor={<Input className="h-8 text-right text-xs" value={String(trackingDraft[key] ?? '')} onChange={(event) => setTrackingDraft((current) => ({ ...current, [key]: event.target.value }))} placeholder="Não informado" />} />)}
          <DetailRow icon={<Target />} label="Origem orgânica" value={trackingDraft.isOrganic == null ? "Não informado" : trackingDraft.isOrganic ? "Sim" : "Não"} editable={canWrite} editor={<select value={trackingDraft.isOrganic == null ? '' : trackingDraft.isOrganic ? 'true' : 'false'} onChange={(event) => setTrackingDraft((current) => ({ ...current, isOrganic: event.target.value === '' ? null : event.target.value === 'true' }))} className="h-8 w-full rounded-lg border border-border bg-background px-2 text-right text-xs"><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select>} />
          <DetailRow icon={<Target />} label="Rastreamento" value={attribution?.method === "manual" ? "Editado manualmente (sincronizado com o RD)" : attribution?.status === "attributed" ? (attribution.method === "meta_id" ? "Atribuído pelo ID do anúncio" : "Atribuído pelas UTMs") : attribution?.status === "partial" ? (deal.source || deal.campaign ? "Origem/campanha do RD recebida; vínculo Meta não confirmado" : "Parâmetros recebidos, anúncio não encontrado") : (deal.source || deal.campaign ? "Origem/campanha do RD recebida; sem vínculo Meta confirmado" : "Sem parâmetros de rastreamento")} />
          <DetailRow icon={<CalendarClock />} label="Criado em" value={fullDate(deal.lead_created_at)} />
          <DetailRow icon={<Clock3 />} label="Última movimentação" value={fullDate(deal.stage_updated_at || deal.updated_at)} />
          {deal.lost_reason && <DetailRow icon={<XCircle />} label="Motivo da perda" value={deal.lost_reason} danger />}
          </div>
        </div>
        {!!fields.length && <div className="mt-5"><h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Campos personalizados do RD (leitura)</h3><div className="mt-2 divide-y divide-border rounded-2xl border border-border">{fields.map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3 px-4 py-3 text-xs"><span className="break-words text-muted-foreground">{key}</span><b className="break-words text-right">{String(value)}</b></div>)}</div></div>}
        <div className="mt-5 rounded-xl border border-dashed border-border p-3 text-[10px] leading-4 text-muted-foreground">ID RD: {deal.rd_deal_id}. O RD Station continua sendo a fonte canônica; cada escrita é autorizada, auditada antes da chamada e refletida no espelho local.</div>
      </SheetContent>
    </Sheet>
  );
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

function DetailRow({ icon, label, value, danger = false, editable = false, editor }: { icon: ReactNode; label: string; value: string; danger?: boolean; editable?: boolean; editor?: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] items-center gap-3 px-4 py-3 text-xs"><span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground"><span className={cn("shrink-0 [&>svg]:h-4 [&>svg]:w-4", danger ? "text-rose-500" : "text-primary")}>{icon}</span>{label}</span>{editable ? editor : <b className={cn("break-words text-right", danger && "text-rose-500")}>{value}</b>}</div>;
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
