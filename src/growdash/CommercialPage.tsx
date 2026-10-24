import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, Crown, Expand, Minimize, TrendingUp, Trophy, Users } from "lucide-react";
import { eachDayOfInterval, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useSales, type Sale } from "@/hooks/useSales";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { AccountMultiSelect } from "@/components/dashboard/AccountMultiSelect";
import { OptionMultiSelect } from "@/components/dashboard/OptionMultiSelect";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { useSalesGoals } from "@/hooks/useSalesGoals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeading } from "./shared";
import { buildCommercialAccountRankings, buildCommercialExpertRankings, buildCommercialGlobalRanking, resolveCommercialSaleAttribution, type CommercialAccountRanking, type CommercialSaleRow } from "@/lib/commercialRanking";
import { getExpertAccountIds, validateSellerAvatarFile, type CommercialExpertAccountLink } from "@/lib/commercialFilters";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type RankingMetric = "revenue" | "sales" | "goalPercentage";
type RankingScope = "expert" | "global";

function customValue(sale: Sale, keys: string[]) {
  const fields = sale.custom_fields || {};
  const normalized = keys.map((key) => key.toLowerCase());
  const entry = Object.entries(fields).find(([key]) => normalized.includes(key.toLowerCase()));
  return entry?.[1] || null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export default function CommercialPage() {
  const { user } = useAuth();
  const {
    adAccountId,
    setAdAccountId,
    setAdAccountIds,
    adAccountIds,
    funnelIds,
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate,
    endDate,
    businessUnitId,
    segment,
    workspaceId,
  } = useGlobalFilters();
  const accountFilter = adAccountIds.length === 1 ? adAccountIds[0] : undefined;
  const { data: sales = [], isLoading, isError: salesIsError, error: salesError } = useSales({ startDate, endDate, adAccountId: accountFilter, adAccountIds, funnelIds });
  const { data: rdDeals = [], resolvedFunnelIds, isError: rdIsError, error: rdError } = useRDDealsForPeriod({ startDate, endDate, adAccountId: accountFilter, adAccountIds, funnelIds });
  const { data: rdFunnels = [] } = useRDFunnels(undefined, Boolean(user));
  const { data: products = [], isError: productsIsError, error: productsError } = useProducts();
  const { data: adAccounts = [], isError: accountsIsError, error: accountsError } = useAdAccounts();
  const effectiveWorkspaceId = workspaceId || adAccounts.find((account) => account.workspace_id)?.workspace_id;
  const { data: goalData, isLoading: goalsIsLoading, isError: goalsIsError, error: goalsError } = useSalesGoals(startDate);
  const { data: expertScope = [], isError: expertScopeIsError, error: expertScopeError } = useQuery({
    queryKey: ["commercial-expert-scope", workspaceId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [{ data: links, error: linksError }, { data: experts, error: expertsError }] = await Promise.all([
        // These tables are newer than the generated database type snapshot.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("expert_operation_sources").select("expert_id,ad_account_id").not("ad_account_id", "is", null),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("experts").select("id,nome").order("nome"),
      ]);
      if (linksError) throw linksError;
      if (expertsError) throw expertsError;
      const names = new Map((experts || []).map((expert: { id: string; nome: string }) => [expert.id, expert.nome]));
      return (links || []).filter((link: { expert_id: string; ad_account_id: string | null }) => link.ad_account_id).map((link: { expert_id: string; ad_account_id: string }) => ({
        expertId: link.expert_id,
        expertName: names.get(link.expert_id) || "Expert sem nome",
        adAccountId: link.ad_account_id,
      }));
    },
    staleTime: 5 * 60_000,
  });
  const { data: expertDirectory = [], isError: expertDirectoryIsError, error: expertDirectoryError } = useQuery({
    queryKey: ["commercial-expert-directory", workspaceId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("experts").select("id,nome").order("nome");
      if (error) throw error;
      return (data || []) as Array<{ id: string; nome: string }>;
    },
    staleTime: 5 * 60_000,
  });
  const [sellerFilter, setSellerFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("revenue");
  const [rankingScope, setRankingScope] = useState<RankingScope>("expert");
  const [leaderboardAccountId, setLeaderboardAccountId] = useState("");
  const [rankingPage, setRankingPage] = useState(0);
  const [selectedExpertIds, setSelectedExpertIds] = useState<string[]>([]);
  const sellerProfiles = useQuery({
    queryKey: ["commercial-seller-profiles", effectiveWorkspaceId],
    enabled: Boolean(effectiveWorkspaceId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("commercial_seller_profiles").select("seller_name,avatar_url").eq("workspace_id", effectiveWorkspaceId!);
      if (error) throw error;
      return (data || []) as Array<{ seller_name: string; avatar_url: string | null }>;
    },
    staleTime: 5 * 60_000,
  });
  const saveSellerAvatar = async (sellerName: string, file: File) => {
    if (!user || !effectiveWorkspaceId) throw new Error("Não foi possível identificar o workspace para salvar a foto.");
    const validationError = validateSellerAvatarFile(file);
    if (validationError) throw new Error(validationError);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/commercial-sellers/${encodeURIComponent(sellerName)}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
    if (uploadError) throw uploadError;
    const avatarUrl = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("commercial_seller_profiles").upsert({ workspace_id: effectiveWorkspaceId, seller_name: sellerName, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,seller_name" });
    if (error) throw error;
    await sellerProfiles.refetch();
    toast.success(`Foto de ${sellerName} atualizada.`);
  };

  const accessibleAccounts = useMemo(() => {
    const accounts = businessUnitId
      ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
      : adAccounts;
    return accounts;
  }, [adAccounts, businessUnitId, segment]);
  const expertLinks = useMemo<CommercialExpertAccountLink[]>(() => expertScope.map((link) => ({ expertId: link.expertId, adAccountId: link.adAccountId })), [expertScope]);
  const expertOptions = useMemo(() => {
    const options = new Map(expertDirectory.map((expert) => [expert.id, { id: expert.id, name: expert.nome }]));
    expertScope.forEach((link) => options.set(link.expertId, { id: link.expertId, name: link.expertName }));
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [expertDirectory, expertScope]);
  const scopedExpertAccountIds = useMemo(() => getExpertAccountIds(expertLinks, selectedExpertIds), [expertLinks, selectedExpertIds]);
  const accountOptions = useMemo(() => accessibleAccounts.filter((account) => !scopedExpertAccountIds || scopedExpertAccountIds.has(account.id)).map((account) => ({ id: account.id, name: String(account.name ?? "Conta sem nome") })), [accessibleAccounts, scopedExpertAccountIds]);
  const visibleAccounts = useMemo(() => accessibleAccounts.filter((account) => (!adAccountIds.length || adAccountIds.includes(account.id)) && (!scopedExpertAccountIds || scopedExpertAccountIds.has(account.id))), [accessibleAccounts, adAccountIds, scopedExpertAccountIds]);
  const rankingAccountOptions = useMemo(() => visibleAccounts.map((account) => ({ id: account.id, name: String(account.name ?? "Conta sem nome") })), [visibleAccounts]);

  const handleExpertsChange = (ids: string[]) => {
    setSelectedExpertIds(ids);
    const expertAccountIds = getExpertAccountIds(expertLinks, ids);
    if (expertAccountIds) setAdAccountIds([...expertAccountIds]);
    setRankingPage(0);
  };

  useEffect(() => {
    if (!accessibleAccounts.length) return;
    const accessibleIds = new Set(accessibleAccounts.map((account) => account.id));
    if (adAccountIds.length) {
      const validIds = adAccountIds.filter((id) => accessibleIds.has(id));
      if (validIds.length !== adAccountIds.length) setAdAccountIds(validIds);
      return;
    }
    if (adAccountId !== "all" && !accessibleIds.has(adAccountId)) setAdAccountId("all");
  }, [accessibleAccounts, adAccountId, adAccountIds, setAdAccountId, setAdAccountIds]);
  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product.name])), [products]);
  const dealById = useMemo(() => new Map(rdDeals.map((deal) => [deal.rd_deal_id, deal])), [rdDeals]);
  const funnelAccountByProviderId = useMemo(() => new Map(rdFunnels.filter((funnel) => funnel.rd_funnel_id && funnel.ad_account_id).map((funnel) => [funnel.rd_funnel_id!, funnel.ad_account_id!])), [rdFunnels]);
  const scopedAccountIds = useMemo(() => Array.from(new Set(adAccountIds.filter(Boolean))), [adAccountIds]);
  const resolvedScopeFunnelIds = useMemo(() => new Set((resolvedFunnelIds ?? []).filter((id) => id !== "__no_linked_rd_funnels__")), [resolvedFunnelIds]);
  const enriched = useMemo<CommercialSaleRow[]>(() => sales.map((sale) => {
    const attribution = resolveCommercialSaleAttribution(sale, { dealById, funnelAccountByProviderId, selectedAccountIds: scopedAccountIds, resolvedFunnelIds: resolvedScopeFunnelIds });
    const commissionRaw = customValue(sale, ["comissao", "comissão", "commission", "valor_comissao"]);
    const commission = commissionRaw ? Number(String(commissionRaw).replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0 : 0;
    return { sale, seller: attribution.seller, accountId: attribution.accountId, commission, product: (sale.product_id && productNames.get(sale.product_id)) || sale.rd_product_name || "Não informado" };
  }), [dealById, funnelAccountByProviderId, productNames, resolvedScopeFunnelIds, sales, scopedAccountIds]);
  const sellers = useMemo(() => Array.from(new Set(enriched.map((row) => row.seller))).sort((a, b) => a.localeCompare(b, "pt-BR")), [enriched]);
  const productOptions = useMemo(() => [
    ...products.map((product) => ({ value: `local:${product.id}`, label: product.name })),
    ...Array.from(new Set(enriched.filter((row) => !row.sale.product_id && row.product !== "Não informado").map((row) => row.product)))
      .map((product) => ({ value: `rd:${product}`, label: product })),
  ], [enriched, products]);
  const filtered = useMemo(() => enriched.filter((row) => (
    (!adAccountIds.length || adAccountIds.includes(row.accountId || row.sale.ad_account_id || ""))
    && (!scopedExpertAccountIds || scopedExpertAccountIds.has(row.accountId || row.sale.ad_account_id || ""))
    && (sellerFilter === "all" || row.seller === sellerFilter)
    && (productFilter === "all" || productFilter === `local:${row.sale.product_id}` || (!row.sale.product_id && productFilter === `rd:${row.product}`))
  )), [adAccountIds, enriched, productFilter, scopedExpertAccountIds, sellerFilter]);
  const goals = useMemo(() => new Map((goalData?.rows ?? []).map((goal) => [goal.ad_account_id, Number(goal.target_revenue)])), [goalData?.rows]);
  const rankingDeals = useMemo(() => {
    const visibleAccountIds = new Set(visibleAccounts.map((account) => account.id));
    const hasExplicitAccountScope = adAccountIds.length > 0 || selectedExpertIds.length > 0;
    return rdDeals.filter((deal) => {
      const effectiveAccountId = deal.ad_account_id
        || (deal.rd_funnel_id ? funnelAccountByProviderId.get(deal.rd_funnel_id) : undefined)
        || (scopedAccountIds.length === 1 && deal.rd_funnel_id && resolvedScopeFunnelIds.has(deal.rd_funnel_id) ? scopedAccountIds[0] : null);
      const visibleByAccount = effectiveAccountId
        ? visibleAccountIds.has(effectiveAccountId)
        : hasExplicitAccountScope
          ? resolvedScopeFunnelIds.has(deal.rd_funnel_id || "")
          : true;
      return visibleByAccount && (sellerFilter === "all" || deal.deal_owner_name === sellerFilter);
    }).map((deal) => {
      const inferredAccountId = deal.ad_account_id
        || (deal.rd_funnel_id ? funnelAccountByProviderId.get(deal.rd_funnel_id) : undefined)
        || (scopedAccountIds.length === 1 && deal.rd_funnel_id && resolvedScopeFunnelIds.has(deal.rd_funnel_id) ? scopedAccountIds[0] : null);
      return inferredAccountId ? { ...deal, ad_account_id: inferredAccountId } : deal;
    });
  }, [adAccountIds, funnelAccountByProviderId, rdDeals, resolvedScopeFunnelIds, scopedAccountIds, selectedExpertIds.length, sellerFilter, visibleAccounts]);
  const accountRankings = useMemo(() => buildCommercialAccountRankings({ sales: filtered, deals: rankingDeals, accounts: rankingAccountOptions, goals }), [filtered, goals, rankingAccountOptions, rankingDeals]);
  const filteredExpertLinks = useMemo(() => expertScope.filter((link) => (!adAccountIds.length || adAccountIds.includes(link.adAccountId)) && (!selectedExpertIds.length || selectedExpertIds.includes(link.expertId))), [adAccountIds, expertScope, selectedExpertIds]);
  const expertRankings = useMemo(() => buildCommercialExpertRankings(accountRankings, filteredExpertLinks), [accountRankings, filteredExpertLinks]);
  const globalRanking = useMemo(() => buildCommercialGlobalRanking(expertRankings), [expertRankings]);
  const rankingGroups = useMemo(() => rankingScope === "global" ? [globalRanking] : expertRankings, [expertRankings, globalRanking, rankingScope]);
  useEffect(() => {
    const preferred = rankingScope === "global" ? "global" : expertRankings.some((group) => group.accountId === leaderboardAccountId) ? leaderboardAccountId : expertRankings[0]?.accountId;
    if (preferred && !rankingGroups.some((account) => account.accountId === leaderboardAccountId)) setLeaderboardAccountId(preferred);
    if (!preferred) setLeaderboardAccountId("");
  }, [expertRankings, leaderboardAccountId, rankingGroups, rankingScope]);
  const leaderboardAccount = useMemo(() => rankingGroups.find((account) => account.accountId === leaderboardAccountId) || rankingGroups[0], [leaderboardAccountId, rankingGroups]);
  const rankedSellers = useMemo(() => {
    const sellersForAccount = leaderboardAccount?.sellers || [];
    const metricValue = (seller: typeof sellersForAccount[number]) => rankingMetric === "sales" ? seller.count : rankingMetric === "goalPercentage" ? seller.performance : seller.revenue;
    return [...sellersForAccount].sort((a, b) => metricValue(b) - metricValue(a) || b.revenue - a.revenue || b.count - a.count || a.seller.localeCompare(b.seller, "pt-BR"));
  }, [leaderboardAccount, rankingMetric]);
  const performanceSeries = useMemo(() => {
    if (!leaderboardAccount) return [];
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const data = new Map(dates.map((date) => [format(date, "yyyy-MM-dd"), { date: format(date, "dd/MM"), revenue: 0, sales: 0 }]));
    const accountIds = new Set(leaderboardAccount.accountIds || [leaderboardAccount.accountId]);
    for (const row of filtered) {
      if (!accountIds.has(row.accountId || row.sale.ad_account_id || "") || row.sale.status !== "confirmed") continue;
      const parsed = parseISO(row.sale.sale_date);
      if (!isValid(parsed)) continue;
      const key = format(parsed, "yyyy-MM-dd");
      const current = data.get(key);
      if (current) { current.revenue += Number(row.sale.net_revenue || 0); current.sales += Number(row.sale.quantity || 1); }
    }
    return Array.from(data.values());
  }, [endDate, filtered, leaderboardAccount, startDate]);
  const selectedTarget = leaderboardAccount?.target || 0;
  const selectedRevenue = leaderboardAccount?.totalRevenue || 0;
  const selectedSales = leaderboardAccount?.totalCount || 0;
  const queryErrors = [
    salesIsError ? salesError : null,
    rdIsError ? rdError : null,
    productsIsError ? productsError : null,
    accountsIsError ? accountsError : null,
    goalsIsError ? goalsError : null,
    expertScopeIsError ? expertScopeError : null,
    expertDirectoryIsError ? expertDirectoryError : null,
  ].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error));
  const salesUnavailable = salesIsError && sales.length === 0;
  const goalState = goalsIsError ? (goalData?.rows?.length ? "stale" : "unavailable") : goalsIsLoading && !goalData?.rows?.length ? "loading" : "ready";
  return (
    <div className="gd-module-shell commercial-ranking-shell mx-auto max-w-[1600px] space-y-5" data-commercial-ranking>
      <PageHeading
        eyebrow="Performance de vendas"
        title="Ranking Comercial"
        description="Veja os líderes por expert e o ranking global da empresa com base nas vendas confirmadas."
        actions={<span className="hidden" aria-hidden="true" />}
      />

      {queryErrors.length > 0 && (
        <section role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <b>Não foi possível atualizar todos os dados comerciais.</b>
          <p className="mt-1 text-xs text-amber-100/80">O último snapshot disponível foi preservado. Detalhes: {Array.from(new Set(queryErrors)).join(" · ")}</p>
        </section>
      )}

      {salesUnavailable ? (
        <section role="status" className="gd-panel rounded-2xl border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          <h2 className="font-black">Vendas indisponíveis</h2>
          <p className="mt-1 text-sm text-amber-100/80">Não foi possível consultar as vendas deste período. Nenhum zero foi inferido; tente novamente quando a fonte estiver disponível.</p>
        </section>
      ) : <>
        <div className="commercial-ranking-tabs" role="tablist" aria-label="Escopo do ranking comercial">
          <button type="button" role="tab" aria-selected={rankingScope === "expert"} className={rankingScope === "expert" ? "is-active gd-commercial-tab-active" : ""} onClick={() => { setRankingScope("expert"); setRankingPage(0); }}>Por expert</button>
          <button type="button" role="tab" aria-selected={rankingScope === "global"} className={rankingScope === "global" ? "is-active gd-commercial-tab-active" : ""} onClick={() => { setRankingScope("global"); setRankingPage(0); }}>Global da empresa</button>
        </div>
        <CommercialLeaderboard
        account={leaderboardAccount}
        accounts={rankingGroups}
        isLoading={isLoading}
        metric={rankingMetric}
        onMetricChange={setRankingMetric}
        accountId={leaderboardAccount?.accountId || ""}
        onAccountChange={(value) => { setLeaderboardAccountId(value); setRankingPage(0); }}
        ranking={rankedSellers}
        rankingPage={rankingPage}
        onRankingPageChange={setRankingPage}
        periodLabel={`${format(startDate, "dd/MM/yyyy")} – ${format(endDate, "dd/MM/yyyy")}`}
        preset={preset}
        onPresetChange={setPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        startDate={startDate}
        endDate={endDate}
        totals={{ revenue: selectedRevenue, sales: selectedSales, target: selectedTarget, ticket: selectedSales ? selectedRevenue / selectedSales : 0 }}
        goalState={goalState}
        series={performanceSeries}
        scope={rankingScope}
        accountOptions={accountOptions}
        selectedAccountIds={adAccountIds}
        onAccountsChange={(ids) => { setAdAccountIds(ids); setRankingPage(0); }}
        expertOptions={expertOptions}
        selectedExpertIds={selectedExpertIds}
        onExpertsChange={handleExpertsChange}
        sellerOptions={sellers}
        sellerFilter={sellerFilter}
        onSellerFilterChange={(value) => { setSellerFilter(value); setRankingPage(0); }}
        productOptions={productOptions}
        productFilter={productFilter}
        onProductFilterChange={(value) => { setProductFilter(value); setRankingPage(0); }}
        sellerAvatars={new Map((sellerProfiles.data || []).map((profile) => [profile.seller_name, profile.avatar_url || ""]))}
        onSellerAvatarUpload={saveSellerAvatar}
      /></>}

    </div>
  );
}

function CommercialLeaderboard({ account, accounts, isLoading, metric, onMetricChange, accountId, onAccountChange, ranking, rankingPage, onRankingPageChange, periodLabel, preset, onPresetChange, customRange, onCustomRangeChange, startDate, endDate, totals, goalState, series, scope, accountOptions, selectedAccountIds, onAccountsChange, expertOptions, selectedExpertIds, onExpertsChange, sellerOptions, sellerFilter, onSellerFilterChange, productOptions, productFilter, onProductFilterChange, sellerAvatars, onSellerAvatarUpload }: {
  account: CommercialAccountRanking | undefined; accounts: CommercialAccountRanking[]; isLoading: boolean; metric: RankingMetric; onMetricChange: (metric: RankingMetric) => void; accountId: string; onAccountChange: (id: string) => void; ranking: CommercialAccountRanking["sellers"]; rankingPage: number; onRankingPageChange: (page: number) => void; periodLabel: string; preset: import("@/hooks/useDateFilter").DatePreset; onPresetChange: (preset: import("@/hooks/useDateFilter").DatePreset) => void; customRange: { from: Date; to: Date }; onCustomRangeChange: (range: { from: Date; to: Date }) => void; startDate: Date; endDate: Date; totals: { revenue: number; sales: number; target: number; ticket: number }; goalState: "loading" | "unavailable" | "stale" | "ready"; series: Array<{ date: string; revenue: number; sales: number }>; scope: RankingScope; accountOptions: Array<{ id: string; name: string }>; selectedAccountIds: string[]; onAccountsChange: (ids: string[]) => void; expertOptions: Array<{ id: string; name: string }>; selectedExpertIds: string[]; onExpertsChange: (ids: string[]) => void; sellerOptions: string[]; sellerFilter: string; onSellerFilterChange: (value: string) => void; productOptions: Array<{ value: string; label: string }>; productFilter: string; onProductFilterChange: (value: string) => void; sellerAvatars: Map<string, string>; onSellerAvatarUpload: (sellerName: string, file: File) => Promise<void>;
}) {
  const podiumOrder = ranking.length === 1 ? [ranking[0]] : ranking.length === 2 ? [ranking[0], ranking[1]] : [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const rowsPerPage = 10;
  const [focusMode, setFocusMode] = useState(false);
  const remaining = ranking.slice(3);
  const totalPages = Math.max(1, Math.ceil(remaining.length / rowsPerPage));
  const safePage = Math.min(rankingPage, totalPages - 1);
  const pageRows = remaining.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);
  const metricLabel = metric === "sales" ? "Vendas" : metric === "goalPercentage" ? "% da meta" : "Caixa gerado";
  const goalProgress = totals.target > 0 ? (totals.revenue / totals.target) * 100 : 0;
  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [focusMode]);
  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);
  const toggleFocusMode = () => setFocusMode((current) => !current);
  const leaderboard = <section role={focusMode ? "dialog" : undefined} aria-modal={focusMode ? true : undefined} aria-label={focusMode ? "Ranking Comercial expandido" : undefined} className={`isolate overflow-auto border border-emerald-400/30 bg-emerald-950/20 text-slate-100 shadow-[0_28px_100px_-35px_rgba(0,0,0,.95)] motion-reduce:animate-none ${focusMode ? "fixed inset-0 z-[300] min-h-screen rounded-none animate-in fade-in-0 zoom-in-95 duration-300" : "relative rounded-[28px]"}`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,.16),transparent_42%),radial-gradient(ellipse_at_5%_35%,rgba(16,185,129,.12),transparent_38%),linear-gradient(135deg,#062015_0%,#0b1b12_58%,#123719_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/75 to-transparent" />
    <div className="relative p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2 text-emerald-300"><Trophy className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[.28em]">Ranking Comercial</span></div><h2 className="mt-2 text-2xl font-black tracking-[-.045em] text-white sm:text-3xl">Painel de performance</h2><p className="mt-1 text-xs text-slate-400">Classificação calculada somente com vendas confirmadas no período.</p></div>
        <div className="commercial-ranking-controls flex flex-wrap items-end justify-end gap-2">
          <AccountMultiSelect accounts={accountOptions} selectedIds={selectedAccountIds} onChange={onAccountsChange} popoverClassName="z-[360]" ariaLabel="Selecionar contas do ranking comercial" className="commercial-ranking-control" />
          <OptionMultiSelect options={expertOptions} selectedIds={selectedExpertIds} onChange={onExpertsChange} popoverClassName="z-[360]" emptyLabel="Todos os experts" emptyMessage="Este expert não possui contas de anúncio vinculadas." ariaLabel="Selecionar experts do ranking comercial" className="commercial-ranking-control" />
          <select aria-label="Filtrar por vendedor" className="commercial-ranking-control commercial-ranking-filter gd-button" value={sellerFilter} onChange={(event) => onSellerFilterChange(event.target.value)}><option value="all">Todos os vendedores</option>{sellerOptions.map((seller) => <option key={seller} value={seller}>{seller}</option>)}</select>
          <select aria-label="Filtrar por produto" className="commercial-ranking-control commercial-ranking-filter gd-button" value={productFilter} onChange={(event) => onProductFilterChange(event.target.value)}><option value="all">Todos os produtos</option>{productOptions.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}</select>
          <MetaDateRangePicker preset={preset} onPresetChange={onPresetChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} startDate={startDate} endDate={endDate} popoverClassName="z-[360]" className="commercial-ranking-control border-white/10 bg-white/[.045] text-slate-100" />
          <div className="rounded-xl border border-white/10 bg-white/[.045] px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-[.17em] text-slate-500">Período atual</p><p className="mt-0.5 text-xs font-black tracking-wide text-emerald-200">{periodLabel}</p></div>
          <button type="button" aria-label={focusMode ? "Restaurar tela do ranking" : "Mostrar somente o ranking"} aria-pressed={focusMode} onClick={toggleFocusMode} className="commercial-ranking-expand grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl transition">{focusMode ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button>
        </div>
      </header>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><select aria-label={scope === "global" ? "Ranking global exibido" : "Expert exibido no ranking"} value={accountId} onChange={(event) => onAccountChange(event.target.value)} className="commercial-ranking-filter h-10 max-w-full rounded-xl px-3 text-xs font-bold outline-none">{accounts.map((item) => <option key={item.accountId} value={item.accountId}>{item.accountName}</option>)}</select><div className="flex rounded-xl border border-white/10 bg-emerald-950/20 p-1">{(["revenue", "sales", "goalPercentage"] as RankingMetric[]).map((item) => <button type="button" key={item} onClick={() => { onMetricChange(item); onRankingPageChange(0); }} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] transition ${metric === item ? "bg-emerald-500 text-emerald-950 shadow-lg" : "text-slate-400 hover:text-white"}`}>{item === "revenue" ? "Caixa" : item === "sales" ? "Vendas" : "Meta"}</button>)}</div></div>
      {!account && <div className="mt-6"><EmptyRanking text="Nenhuma conta ou vendedor encontrado para os filtros atuais." /></div>}
      {account && <><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(320px,.62fr)]">
        <div className="rounded-2xl border border-white/10 bg-emerald-950/20 p-4 sm:p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">Elite do período</p><p className="mt-1 text-xs text-slate-400">Critério: <b className="text-slate-200">{metricLabel}</b></p></div><span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black text-emerald-300">{ranking.length} vendedor(es)</span></div>
          <div className={`mt-5 grid items-end gap-3 ${podiumOrder.length === 1 ? "mx-auto max-w-sm" : podiumOrder.length === 2 ? "mx-auto max-w-2xl grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>{podiumOrder.map((seller) => <PodiumCard key={seller.seller} seller={seller} place={ranking.findIndex((item) => item.seller === seller.seller) + 1} hasGoal={account.target > 0} avatarUrl={sellerAvatars.get(seller.seller)} onAvatarUpload={onSellerAvatarUpload} />)}</div>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-emerald-950/25 p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.22em] text-slate-500">Resumo geral</p><div className="mt-4 grid grid-cols-2 gap-3"><SummaryMetric label="Vendas" value={isLoading ? "—" : String(totals.sales)} /><SummaryMetric label="Caixa gerado" value={isLoading ? "—" : brl.format(totals.revenue)} /><SummaryMetric label="Meta atingida" value={goalState === "loading" ? "Carregando…" : goalState === "unavailable" ? "Indisponível" : totals.target ? `${goalProgress.toFixed(1).replace(".", ",")}%` : "Não definida"} /><SummaryMetric label="Ticket médio" value={isLoading ? "—" : brl.format(totals.ticket)} /></div><GoalProgressPanel target={totals.target} revenue={totals.revenue} progress={goalProgress} state={goalState} /></aside>
      </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.92fr)]"><section className="min-h-[260px] rounded-2xl border border-white/10 bg-emerald-950/20 p-4 sm:p-5"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Evolução da performance</p><p className="mt-1 text-xs text-slate-400">Caixa gerado por dia</p></div></div><div className="mt-4 h-[185px]">{series.some((item) => item.revenue > 0) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={series}><defs><linearGradient id="commercialEmeraldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={.4}/><stop offset="100%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--gd-border-subtle)" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gd-content-muted)" }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis tick={{ fontSize: 10, fill: "var(--gd-content-muted)" }} axisLine={false} tickLine={false} width={48} tickFormatter={(value) => value >= 1000 ? `R$${Math.round(value / 1000)}k` : `R$${value}`} /><Tooltip formatter={(value: number) => brl.format(value)} contentStyle={{ background: "var(--gd-surface-card)", border: "1px solid var(--gd-border)", borderRadius: 12, color: "var(--gd-content)" }} /><Area type="monotone" dataKey="revenue" name="Caixa gerado" stroke="#34d399" strokeWidth={2.5} fill="url(#commercialEmeraldFill)" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-xs text-slate-500">Sem vendas confirmadas para formar a evolução deste período.</div>}</div></section>
        <section className="rounded-2xl border border-white/10 bg-emerald-950/20 p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Mensagem do time</p><p className="mt-3 text-xl font-black leading-snug tracking-tight text-white">{ranking[0] ? `“${ranking[0].seller} lidera o período. Cada venda fortalece o próximo nível.”` : "“Todo resultado começa com uma boa conversa.”"}</p><p className="mt-4 text-xs leading-relaxed text-slate-400">Acompanhe o ranking, celebre as evoluções e use os dados para transformar foco em resultado.</p></section></div>
      {remaining.length > 0 && <section className="mt-4 rounded-2xl border border-white/10 bg-emerald-950/20 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">Ranking geral</p><p className="mt-1 text-xs text-slate-400">Da 4ª posição em diante · sem limite de vendedores</p></div><p className="text-xs font-bold text-slate-400">{remaining.length} posição(ões)</p></div><div className="mt-4 space-y-2">{pageRows.map((seller, index) => <RankingRow key={seller.seller} seller={seller} position={safePage * rowsPerPage + index + 4} hasGoal={account.target > 0} avatarUrl={sellerAvatars.get(seller.seller)} onAvatarUpload={onSellerAvatarUpload} />)}</div>{totalPages > 1 && <div className="mt-4 flex items-center justify-end gap-2"><button type="button" disabled={safePage === 0} onClick={() => onRankingPageChange(safePage - 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-35">Anterior</button><span className="text-xs text-slate-500">{safePage + 1} / {totalPages}</span><button type="button" disabled={safePage >= totalPages - 1} onClick={() => onRankingPageChange(safePage + 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-35">Próxima</button></div>}</section>}</>}
    </div>
  </section>;
  return focusMode && typeof document !== "undefined" ? createPortal(leaderboard, document.body) : leaderboard;
}

function PodiumCard({ seller, place, hasGoal, avatarUrl, onAvatarUpload }: { seller: CommercialAccountRanking["sellers"][number]; place: number; hasGoal: boolean; avatarUrl?: string; onAvatarUpload: (sellerName: string, file: File) => Promise<void> }) {
  const styles = place === 1 ? "border-emerald-300/75 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,.18),transparent_48%),#0c1b12] shadow-[0_0_42px_-16px_rgba(16,185,129,.4)] sm:-translate-y-3" : place === 2 ? "border-emerald-200/35 bg-emerald-950/30" : "border-emerald-700/50 bg-emerald-950/30";
  const accent = place === 1 ? "#34d399" : place === 2 ? "#10b981" : "#047857";
  return <article className={`relative min-w-0 rounded-2xl border p-4 text-center transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_-22px_rgba(16,185,129,.4)] motion-reduce:transform-none animate-in fade-in-0 slide-in-from-bottom-3 ${styles}`}><p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: accent }}>{place === 1 ? "1º lugar" : `${place}º lugar`}</p>{place === 1 && <Crown className="mx-auto mt-2 h-5 w-5 text-emerald-300" />}<SellerAvatar seller={seller.seller} avatarUrl={avatarUrl} accent={accent} size="lg" onUpload={onAvatarUpload} /><h3 className="mt-3 truncate text-base font-black text-white" title={seller.seller}>{seller.seller}</h3><p className="mt-1 text-xs font-bold text-slate-400">{seller.count} venda(s)</p><p className="mt-4 truncate text-xl font-black tracking-tight text-white" title={brl.format(seller.revenue)}>{brl.format(seller.revenue)}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-slate-500">caixa gerado</p><div className="mt-4 grid grid-cols-2 gap-2 text-left"><div className="rounded-lg bg-white/[.045] p-2"><p className="text-[9px] uppercase tracking-wide text-slate-500">Ticket</p><b className="mt-1 block truncate text-[11px] text-slate-200" title={brl.format(seller.count ? seller.revenue / seller.count : 0)}>{brl.format(seller.count ? seller.revenue / seller.count : 0)}</b></div><div className="rounded-lg bg-white/[.045] p-2"><p className="text-[9px] uppercase tracking-wide text-slate-500">{hasGoal ? "Meta" : "Participação"}</p><b className="mt-1 block text-[11px]" style={{ color: accent }}>{seller.performance.toFixed(1).replace(".", ",")}%</b></div></div></article>;
}

function SellerAvatar({ seller, avatarUrl, accent, size, onUpload }: { seller: string; avatarUrl?: string; accent: string; size: "sm" | "lg"; onUpload: (sellerName: string, file: File) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const inputId = `seller-avatar-${encodeURIComponent(seller)}`;
  return <label htmlFor={inputId} title={`Editar foto de ${seller}`} className={`group relative mx-auto grid cursor-pointer place-items-center overflow-hidden rounded-full border-2 text-lg font-black ${size === "lg" ? "mt-3 h-16 w-16" : "h-9 w-9 text-[10px]"}`} style={{ borderColor: accent, background: `${accent}18`, color: accent }}>
    {avatarUrl ? <img src={avatarUrl} alt={`Foto de ${seller}`} className="h-full w-full object-cover" /> : initials(seller)}
    <span className="absolute inset-0 grid place-items-center bg-black/65 text-white opacity-0 transition group-hover:opacity-100">{saving ? "…" : <Camera className="h-3.5 w-3.5" />}</span>
    <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setSaving(true); try { await onUpload(seller, file); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a foto."); } finally { setSaving(false); event.target.value = ""; } }} />
  </label>;
}

function GoalProgressPanel({ target, revenue, progress, state }: { target: number; revenue: number; progress: number; state: "loading" | "unavailable" | "stale" | "ready" }) {
  const message = state === "loading" ? "Carregando meta…" : state === "unavailable" ? "Dados indisponíveis" : state === "stale" ? "Snapshot antigo" : target <= 0 ? "Meta não configurada" : progress >= 100 ? "Meta atingida" : "Acompanhamento mensal";
  const width = target > 0 && state === "ready" ? Math.min(100, progress) : 0;
  return <div className="commercial-goal-panel mt-5 border-t border-white/10 pt-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Meta da conta</p><p className="mt-1 text-xs font-semibold text-slate-400">{message}</p></div>{target > 0 && state !== "unavailable" && state !== "loading" && <span className="text-xs font-black text-emerald-300">{Math.min(999, progress).toFixed(1).replace(".", ",")}%</span>}</div><div className="mt-3 flex flex-wrap items-baseline justify-between gap-2"><b className="text-lg text-white">{target > 0 && state !== "unavailable" && state !== "loading" ? brl.format(target) : "—"}</b>{target > 0 && state === "ready" && <span className="text-[10px] text-slate-400">Atual: {brl.format(revenue)}</span>}</div><div className="commercial-goal-track mt-3" role="progressbar" aria-label="Progresso da meta mensal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}><div className="commercial-goal-fill" style={{ width: `${width}%` }} /></div></div>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-white/[.035] p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><b className="mt-1 block truncate text-sm font-black text-slate-100" title={value}>{value}</b></div>; }

function RankingRow({ seller, position, hasGoal, avatarUrl, onAvatarUpload }: { seller: CommercialAccountRanking["sellers"][number]; position: number; hasGoal: boolean; avatarUrl?: string; onAvatarUpload: (sellerName: string, file: File) => Promise<void> }) { return <article className="grid grid-cols-[32px_36px_minmax(120px,1fr)_auto] items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/30 animate-in fade-in-0 slide-in-from-right-2 motion-reduce:transform-none hover:bg-white/[.045] sm:grid-cols-[38px_40px_minmax(150px,1.2fr)_minmax(70px,.55fr)_minmax(100px,.75fr)_minmax(90px,.65fr)]"><b className="text-sm text-slate-500">{position}º</b><SellerAvatar seller={seller.seller} avatarUrl={avatarUrl} accent="#34d399" size="sm" onUpload={onAvatarUpload} /><div className="min-w-0"><b className="block truncate text-sm text-white">{seller.seller}</b><span className="text-[10px] text-slate-500">{seller.count} venda(s)</span></div><b className="hidden text-right text-xs text-slate-300 sm:block">{seller.count}</b><b className="hidden text-right text-xs text-slate-200 sm:block">{brl.format(seller.revenue)}</b><div className="text-right"><b className="text-xs text-emerald-300">{seller.performance.toFixed(1).replace(".", ",")}%</b><span className="mt-1 block text-[9px] text-slate-500">{hasGoal ? "da meta" : "participação"}</span></div></article>; }

function EmptyRanking({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-white/45"><Users className="mx-auto mb-2 h-5 w-5" />{text}</div>;
}
