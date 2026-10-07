import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronDown, ChevronUp, Crown, Expand, Filter, Minimize, Search, TrendingUp, Trophy, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eachDayOfInterval, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
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
import { buildCommercialAccountRankings, buildCommercialExpertRankings, buildCommercialGlobalRanking, type CommercialAccountRanking, type CommercialSaleRow } from "@/lib/commercialRanking";
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

function formatSaleDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return isValid(date) ? format(date, "dd/MM/yyyy") : "—";
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
  const { data: rdDeals = [], isError: rdIsError, error: rdError } = useRDDealsForPeriod({ startDate, endDate, adAccountId: accountFilter, adAccountIds, funnelIds });
  const { data: products = [], isError: productsIsError, error: productsError } = useProducts();
  const { data: adAccounts = [], isError: accountsIsError, error: accountsError } = useAdAccounts();
  const { data: goalData, isError: goalsIsError, error: goalsError } = useSalesGoals(startDate);
  const { data: expertScope = [], isError: expertScopeIsError, error: expertScopeError } = useQuery({
    queryKey: ["commercial-expert-scope", workspaceId],
    enabled: Boolean(workspaceId),
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
  const { data: expertDirectory = [] } = useQuery({
    queryKey: ["commercial-expert-directory", workspaceId],
    enabled: Boolean(workspaceId),
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
  const [detailAccountFilter, setDetailAccountFilter] = useState("all");
  const [detailSellerFilter, setDetailSellerFilter] = useState("all");
  const [detailProductFilter, setDetailProductFilter] = useState("all");
  const [detailStatusFilter, setDetailStatusFilter] = useState("all");
  const [detailSearch, setDetailSearch] = useState("");
  const [isDetailedSalesCollapsed, setIsDetailedSalesCollapsed] = useState(false);
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("revenue");
  const [rankingScope, setRankingScope] = useState<RankingScope>("expert");
  const [leaderboardAccountId, setLeaderboardAccountId] = useState("");
  const [rankingPage, setRankingPage] = useState(0);
  const [selectedExpertIds, setSelectedExpertIds] = useState<string[]>([]);
  const sellerProfiles = useQuery({
    queryKey: ["commercial-seller-profiles", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("commercial_seller_profiles").select("seller_name,avatar_url").eq("workspace_id", workspaceId!);
      if (error) throw error;
      return (data || []) as Array<{ seller_name: string; avatar_url: string | null }>;
    },
    staleTime: 5 * 60_000,
  });
  const saveSellerAvatar = async (sellerName: string, file: File) => {
    if (!user || !workspaceId) throw new Error("Sua sessão ainda não está pronta para salvar a foto.");
    const validationError = validateSellerAvatarFile(file);
    if (validationError) throw new Error(validationError);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/commercial-sellers/${encodeURIComponent(sellerName)}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
    if (uploadError) throw uploadError;
    const avatarUrl = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("commercial_seller_profiles").upsert({ workspace_id: workspaceId, seller_name: sellerName, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,seller_name" });
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
  const dealOwners = useMemo(() => new Map(rdDeals.map((deal) => [deal.rd_deal_id, deal.deal_owner_name || "Não informado"])), [rdDeals]);
  const enriched = useMemo<CommercialSaleRow[]>(() => sales.map((sale) => {
    const seller = customValue(sale, ["vendedor", "seller", "responsavel", "responsável", "deal_owner_name"])
      || (sale.rd_deal_id ? dealOwners.get(sale.rd_deal_id) : null)
      || "Não informado";
    const commissionRaw = customValue(sale, ["comissao", "comissão", "commission", "valor_comissao"]);
    const commission = commissionRaw ? Number(String(commissionRaw).replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0 : 0;
    return { sale, seller, commission, product: (sale.product_id && productNames.get(sale.product_id)) || sale.rd_product_name || "Não informado" };
  }), [dealOwners, productNames, sales]);
  const sellers = useMemo(() => Array.from(new Set(enriched.map((row) => row.seller))).sort((a, b) => a.localeCompare(b, "pt-BR")), [enriched]);
  const productOptions = useMemo(() => [
    ...products.map((product) => ({ value: `local:${product.id}`, label: product.name })),
    ...Array.from(new Set(enriched.filter((row) => !row.sale.product_id && row.product !== "Não informado").map((row) => row.product)))
      .map((product) => ({ value: `rd:${product}`, label: product })),
  ], [enriched, products]);
  const filtered = useMemo(() => enriched.filter((row) => (
    (!adAccountIds.length || adAccountIds.includes(row.sale.ad_account_id || ""))
    && (!scopedExpertAccountIds || scopedExpertAccountIds.has(row.sale.ad_account_id || ""))
    && (sellerFilter === "all" || row.seller === sellerFilter)
    && (productFilter === "all" || productFilter === `local:${row.sale.product_id}` || (!row.sale.product_id && productFilter === `rd:${row.product}`))
  )), [adAccountIds, enriched, productFilter, scopedExpertAccountIds, sellerFilter]);
  const detailedFiltered = useMemo(() => {
    const term = detailSearch.trim().toLocaleLowerCase("pt-BR");
    return filtered.filter((row) => {
      if (detailAccountFilter !== "all" && row.sale.ad_account_id !== detailAccountFilter) return false;
      if (detailSellerFilter !== "all" && row.seller !== detailSellerFilter) return false;
      if (detailProductFilter !== "all" && row.product !== detailProductFilter) return false;
      if (detailStatusFilter !== "all" && row.sale.status !== detailStatusFilter) return false;
      if (!term) return true;
      return [row.sale.contact_name, row.sale.contact_email, row.seller, row.product, row.sale.rd_product_name]
        .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [detailAccountFilter, detailProductFilter, detailSearch, detailSellerFilter, detailStatusFilter, filtered]);
  const goals = useMemo(() => new Map((goalData?.rows ?? []).map((goal) => [goal.ad_account_id, Number(goal.target_revenue)])), [goalData?.rows]);
  const rankingDeals = useMemo(() => rdDeals.filter((deal) => visibleAccounts.some((account) => account.id === deal.ad_account_id) && (sellerFilter === "all" || deal.deal_owner_name === sellerFilter)), [rdDeals, sellerFilter, visibleAccounts]);
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
      if (!accountIds.has(row.sale.ad_account_id || "") || row.sale.status !== "confirmed") continue;
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
  ].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error));
  const salesUnavailable = salesIsError && sales.length === 0;
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
          <button type="button" role="tab" aria-selected={rankingScope === "expert"} className={rankingScope === "expert" ? "is-active" : ""} onClick={() => { setRankingScope("expert"); setRankingPage(0); }}>Por expert</button>
          <button type="button" role="tab" aria-selected={rankingScope === "global"} className={rankingScope === "global" ? "is-active" : ""} onClick={() => { setRankingScope("global"); setRankingPage(0); }}>Global da empresa</button>
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

      {!salesUnavailable && <section className="gd-panel mt-4 overflow-hidden">
        <div className={`${isDetailedSalesCollapsed ? "" : "border-b border-border"} p-5`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">Vendas detalhadas</h2><p className="text-xs text-muted-foreground">A comissão só aparece quando recebida em campo explícito; a plataforma não estima valores.</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">{detailedFiltered.length} venda(s)</span><Button type="button" variant="outline" size="icon" aria-label={isDetailedSalesCollapsed ? "Expandir vendas detalhadas" : "Minimizar vendas detalhadas"} aria-expanded={!isDetailedSalesCollapsed} onClick={() => setIsDetailedSalesCollapsed((collapsed) => !collapsed)}>{isDetailedSalesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}</Button></div></div>{!isDetailedSalesCollapsed && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1.4fr)_repeat(4,minmax(135px,1fr))_auto]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar venda por cliente" className="h-10 pl-9" value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} placeholder="Buscar cliente, vendedor ou produto" /></label><DetailFilter label="Conta" value={detailAccountFilter} onChange={setDetailAccountFilter} options={accountOptions.map((item) => ({ value: item.id, label: item.name }))} /><DetailFilter label="Vendedor" value={detailSellerFilter} onChange={setDetailSellerFilter} options={sellers.map((item) => ({ value: item, label: item }))} /><DetailFilter label="Produto" value={detailProductFilter} onChange={setDetailProductFilter} options={Array.from(new Set(filtered.map((item) => item.product))).sort((a, b) => a.localeCompare(b, "pt-BR")).map((item) => ({ value: item, label: item }))} /><DetailFilter label="Status" value={detailStatusFilter} onChange={setDetailStatusFilter} options={Array.from(new Set(filtered.map((item) => item.sale.status))).sort().map((item) => ({ value: item, label: item }))} /><Button type="button" variant="outline" className="h-10" onClick={() => { setDetailAccountFilter("all"); setDetailSellerFilter("all"); setDetailProductFilter("all"); setDetailStatusFilter("all"); setDetailSearch(""); }}><X className="mr-1.5 h-4 w-4" />Limpar</Button></div>}</div>
        {!isDetailedSalesCollapsed && <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Data", "Conta de anúncio", "Cliente", "Vendedor", "Campanha / criativo", "Produto", "Valor líquido", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{detailedFiltered.map((row) => <tr key={row.sale.id}><td className="px-4 py-4">{formatSaleDate(row.sale.sale_date)}</td><td className="max-w-48 truncate px-4 py-4">{accountOptions.find((account) => account.id === row.sale.ad_account_id)?.name || "Sem conta de anúncio"}</td><td className="px-4 py-4 font-black">{row.sale.contact_name || row.sale.contact_email || "Não informado"}</td><td className="px-4 py-4">{row.seller}</td><td className="max-w-56 px-4 py-4"><b className="block truncate" title={row.sale.utm_campaign || row.sale.rd_campaign_name || ""}>{row.sale.utm_campaign || row.sale.rd_campaign_name || "Não atribuída"}</b><span className="block truncate text-[9px] text-muted-foreground" title={row.sale.utm_content || ""}>{row.sale.utm_content ? `Criativo: ${row.sale.utm_content}` : row.sale.ad_id ? `Anúncio: ${row.sale.ad_id}` : "Sem UTM de criativo"}</span></td><td className="px-4 py-4">{row.product}</td><td className="px-4 py-4 font-black">{brl.format(Number(row.sale.net_revenue || 0))}</td><td className="px-4 py-4"><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold">{row.sale.status}</span></td></tr>)}{!isLoading && !detailedFiltered.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhuma venda encontrada com estes filtros.</td></tr>}</tbody></table></div>}
      </section>}
    </div>
  );
}

function DetailFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><select aria-label={`Filtrar vendas por ${label.toLocaleLowerCase("pt-BR")}`} className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-8 pr-3 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" value={value} onChange={(event) => onChange(event.target.value)}><option value="all">{label}: todos</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}

function CommercialLeaderboard({ account, accounts, isLoading, metric, onMetricChange, accountId, onAccountChange, ranking, rankingPage, onRankingPageChange, periodLabel, preset, onPresetChange, customRange, onCustomRangeChange, startDate, endDate, totals, series, scope, accountOptions, selectedAccountIds, onAccountsChange, expertOptions, selectedExpertIds, onExpertsChange, sellerOptions, sellerFilter, onSellerFilterChange, productOptions, productFilter, onProductFilterChange, sellerAvatars, onSellerAvatarUpload }: {
  account: CommercialAccountRanking | undefined; accounts: CommercialAccountRanking[]; isLoading: boolean; metric: RankingMetric; onMetricChange: (metric: RankingMetric) => void; accountId: string; onAccountChange: (id: string) => void; ranking: CommercialAccountRanking["sellers"]; rankingPage: number; onRankingPageChange: (page: number) => void; periodLabel: string; preset: import("@/hooks/useDateFilter").DatePreset; onPresetChange: (preset: import("@/hooks/useDateFilter").DatePreset) => void; customRange: { from: Date; to: Date }; onCustomRangeChange: (range: { from: Date; to: Date }) => void; startDate: Date; endDate: Date; totals: { revenue: number; sales: number; target: number; ticket: number }; series: Array<{ date: string; revenue: number; sales: number }>; scope: RankingScope; accountOptions: Array<{ id: string; name: string }>; selectedAccountIds: string[]; onAccountsChange: (ids: string[]) => void; expertOptions: Array<{ id: string; name: string }>; selectedExpertIds: string[]; onExpertsChange: (ids: string[]) => void; sellerOptions: string[]; sellerFilter: string; onSellerFilterChange: (value: string) => void; productOptions: Array<{ value: string; label: string }>; productFilter: string; onProductFilterChange: (value: string) => void; sellerAvatars: Map<string, string>; onSellerAvatarUpload: (sellerName: string, file: File) => Promise<void>;
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
  const leaderboard = <section role={focusMode ? "dialog" : undefined} aria-modal={focusMode ? true : undefined} aria-label={focusMode ? "Ranking Comercial expandido" : undefined} className={`isolate overflow-auto border border-[#d9a928]/25 bg-[#050b18] text-slate-100 shadow-[0_28px_100px_-35px_rgba(0,0,0,.95)] motion-reduce:animate-none ${focusMode ? "fixed inset-0 z-[300] min-h-screen rounded-none animate-in fade-in-0 zoom-in-95 duration-300" : "relative rounded-[28px]"}`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,169,40,.16),transparent_42%),radial-gradient(ellipse_at_5%_35%,rgba(33,94,176,.14),transparent_38%),linear-gradient(135deg,#081226_0%,#050b18_58%,#0d1830_100%)]" />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f6c94c]/75 to-transparent" />
    <div className="relative p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2 text-[#f6c94c]"><Trophy className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[.28em]">Ranking Comercial</span></div><h2 className="mt-2 text-2xl font-black tracking-[-.045em] text-white sm:text-3xl">Painel de performance</h2><p className="mt-1 text-xs text-slate-400">Classificação calculada somente com vendas confirmadas no período.</p></div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <AccountMultiSelect accounts={accountOptions} selectedIds={selectedAccountIds} onChange={onAccountsChange} popoverClassName="z-[360]" ariaLabel="Selecionar contas do ranking comercial" />
          <OptionMultiSelect options={expertOptions} selectedIds={selectedExpertIds} onChange={onExpertsChange} popoverClassName="z-[360]" emptyLabel="Todos os experts" emptyMessage="Este expert não possui contas de anúncio vinculadas." ariaLabel="Selecionar experts do ranking comercial" />
          <select aria-label="Filtrar por vendedor" className="gd-button min-w-40 border-white/10 bg-white/[.045] text-slate-100" value={sellerFilter} onChange={(event) => onSellerFilterChange(event.target.value)}><option value="all">Todos os vendedores</option>{sellerOptions.map((seller) => <option key={seller} value={seller}>{seller}</option>)}</select>
          <select aria-label="Filtrar por produto" className="gd-button min-w-40 border-white/10 bg-white/[.045] text-slate-100" value={productFilter} onChange={(event) => onProductFilterChange(event.target.value)}><option value="all">Todos os produtos</option>{productOptions.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}</select>
          {focusMode && <MetaDateRangePicker preset={preset} onPresetChange={onPresetChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} startDate={startDate} endDate={endDate} popoverClassName="z-[360]" className="border-white/10 bg-white/[.045] text-slate-100" />}
          <div className="rounded-xl border border-white/10 bg-white/[.045] px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-[.17em] text-slate-500">Período atual</p><p className="mt-0.5 text-xs font-black tracking-wide text-[#f5deb0]">{periodLabel}</p></div>
          <button type="button" aria-label={focusMode ? "Restaurar tela do ranking" : "Mostrar somente o ranking"} aria-pressed={focusMode} onClick={toggleFocusMode} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-slate-300 transition hover:border-[#f6c94c]/50 hover:text-[#f6c94c]">{focusMode ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button>
        </div>
      </header>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><select aria-label={scope === "global" ? "Ranking global exibido" : "Expert exibido no ranking"} value={accountId} onChange={(event) => onAccountChange(event.target.value)} className="h-10 max-w-full rounded-xl border border-white/10 bg-[#0b172c] px-3 text-xs font-bold text-slate-100 outline-none focus:border-[#f6c94c]">{accounts.map((item) => <option key={item.accountId} value={item.accountId}>{item.accountName}</option>)}</select><div className="flex rounded-xl border border-white/10 bg-black/20 p-1">{(["revenue", "sales", "goalPercentage"] as RankingMetric[]).map((item) => <button type="button" key={item} onClick={() => { onMetricChange(item); onRankingPageChange(0); }} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] transition ${metric === item ? "bg-[#d9a928] text-[#111728] shadow-lg" : "text-slate-400 hover:text-white"}`}>{item === "revenue" ? "Caixa" : item === "sales" ? "Vendas" : "Meta"}</button>)}</div></div>
      {!account && <div className="mt-6"><EmptyRanking text="Nenhuma conta ou vendedor encontrado para os filtros atuais." /></div>}
      {account && <><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(320px,.62fr)]">
        <div className="rounded-2xl border border-white/10 bg-[#071124]/72 p-4 sm:p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#f6c94c]">Elite do período</p><p className="mt-1 text-xs text-slate-400">Critério: <b className="text-slate-200">{metricLabel}</b></p></div><span className="rounded-full border border-[#f6c94c]/20 bg-[#f6c94c]/10 px-3 py-1.5 text-[10px] font-black text-[#f6c94c]">{ranking.length} vendedor(es)</span></div>
          <div className={`mt-5 grid items-end gap-3 ${podiumOrder.length === 1 ? "mx-auto max-w-sm" : podiumOrder.length === 2 ? "mx-auto max-w-2xl grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>{podiumOrder.map((seller) => <PodiumCard key={seller.seller} seller={seller} place={ranking.findIndex((item) => item.seller === seller.seller) + 1} hasGoal={account.target > 0} avatarUrl={sellerAvatars.get(seller.seller)} onAvatarUpload={onSellerAvatarUpload} />)}</div>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-[#08152b]/80 p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.22em] text-slate-500">Resumo geral</p><div className="mt-4 grid grid-cols-2 gap-3"><SummaryMetric label="Vendas" value={isLoading ? "—" : String(totals.sales)} /><SummaryMetric label="Caixa gerado" value={isLoading ? "—" : brl.format(totals.revenue)} /><SummaryMetric label="Meta atingida" value={totals.target ? `${goalProgress.toFixed(1).replace(".", ",")}%` : "Não definida"} /><SummaryMetric label="Ticket médio" value={isLoading ? "—" : brl.format(totals.ticket)} /></div><div className="mt-5 border-t border-white/10 pt-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Meta da conta</p><div className="mt-2 flex items-end justify-between gap-2"><b className="text-lg text-white">{totals.target ? brl.format(totals.target) : "Não configurada"}</b>{totals.target > 0 && <span className="text-xs font-black text-[#f6c94c]">{Math.min(999, goalProgress).toFixed(1).replace(".", ",")}%</span>}</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#d9a928] to-[#ffe692]" style={{ width: `${Math.min(100, goalProgress)}%` }} /></div></div></aside>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.92fr)]"><section className="min-h-[260px] rounded-2xl border border-white/10 bg-[#071124]/72 p-4 sm:p-5"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#f6c94c]" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#f6c94c]">Evolução da performance</p><p className="mt-1 text-xs text-slate-400">Caixa gerado por dia</p></div></div><div className="mt-4 h-[185px]">{series.some((item) => item.revenue > 0) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={series}><defs><linearGradient id="commercialGoldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f6c94c" stopOpacity={.4}/><stop offset="100%" stopColor="#f6c94c" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7c8aa5" }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis tick={{ fontSize: 10, fill: "#7c8aa5" }} axisLine={false} tickLine={false} width={48} tickFormatter={(value) => value >= 1000 ? `R$${Math.round(value / 1000)}k` : `R$${value}`} /><Tooltip formatter={(value: number) => brl.format(value)} contentStyle={{ background: "#0d1830", border: "1px solid rgba(246,201,76,.25)", borderRadius: 12, color: "#fff" }} /><Area type="monotone" dataKey="revenue" name="Caixa gerado" stroke="#f6c94c" strokeWidth={2.5} fill="url(#commercialGoldFill)" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-xs text-slate-500">Sem vendas confirmadas para formar a evolução deste período.</div>}</div></section>
        <section className="rounded-2xl border border-white/10 bg-[#071124]/72 p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#f6c94c]">Mensagem do time</p><p className="mt-3 text-xl font-black leading-snug tracking-tight text-white">{ranking[0] ? `“${ranking[0].seller} lidera o período. Cada venda fortalece o próximo nível.”` : "“Todo resultado começa com uma boa conversa.”"}</p><p className="mt-4 text-xs leading-relaxed text-slate-400">Acompanhe o ranking, celebre as evoluções e use os dados para transformar foco em resultado.</p></section></div>
      {remaining.length > 0 && <section className="mt-4 rounded-2xl border border-white/10 bg-[#071124]/72 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#f6c94c]">Ranking geral</p><p className="mt-1 text-xs text-slate-400">Da 4ª posição em diante · sem limite de vendedores</p></div><p className="text-xs font-bold text-slate-400">{remaining.length} posição(ões)</p></div><div className="mt-4 space-y-2">{pageRows.map((seller, index) => <RankingRow key={seller.seller} seller={seller} position={safePage * rowsPerPage + index + 4} hasGoal={account.target > 0} avatarUrl={sellerAvatars.get(seller.seller)} onAvatarUpload={onSellerAvatarUpload} />)}</div>{totalPages > 1 && <div className="mt-4 flex items-center justify-end gap-2"><button type="button" disabled={safePage === 0} onClick={() => onRankingPageChange(safePage - 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-35">Anterior</button><span className="text-xs text-slate-500">{safePage + 1} / {totalPages}</span><button type="button" disabled={safePage >= totalPages - 1} onClick={() => onRankingPageChange(safePage + 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-35">Próxima</button></div>}</section>}</>}
    </div>
  </section>;
  return focusMode && typeof document !== "undefined" ? createPortal(leaderboard, document.body) : leaderboard;
}

function PodiumCard({ seller, place, hasGoal, avatarUrl, onAvatarUpload }: { seller: CommercialAccountRanking["sellers"][number]; place: number; hasGoal: boolean; avatarUrl?: string; onAvatarUpload: (sellerName: string, file: File) => Promise<void> }) {
  const styles = place === 1 ? "border-[#f6c94c]/75 bg-[radial-gradient(circle_at_50%_0%,rgba(246,201,76,.22),transparent_48%),#151b20] shadow-[0_0_42px_-16px_rgba(246,201,76,.8)] sm:-translate-y-3" : place === 2 ? "border-[#d5dae3]/35 bg-[#0e1a2c]" : "border-[#d77a2b]/40 bg-[#1b1520]";
  const accent = place === 1 ? "#f6c94c" : place === 2 ? "#d5dae3" : "#ed8a36";
  return <article className={`relative min-w-0 rounded-2xl border p-4 text-center transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_-22px_rgba(246,201,76,.8)] motion-reduce:transform-none animate-in fade-in-0 slide-in-from-bottom-3 ${styles}`}><p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: accent }}>{place === 1 ? "1º lugar" : `${place}º lugar`}</p>{place === 1 && <Crown className="mx-auto mt-2 h-5 w-5 text-[#f6c94c]" />}<SellerAvatar seller={seller.seller} avatarUrl={avatarUrl} accent={accent} size="lg" onUpload={onAvatarUpload} /><h3 className="mt-3 truncate text-base font-black text-white" title={seller.seller}>{seller.seller}</h3><p className="mt-1 text-xs font-bold text-slate-400">{seller.count} venda(s)</p><p className="mt-4 truncate text-xl font-black tracking-tight text-white" title={brl.format(seller.revenue)}>{brl.format(seller.revenue)}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-slate-500">caixa gerado</p><div className="mt-4 grid grid-cols-2 gap-2 text-left"><div className="rounded-lg bg-white/[.045] p-2"><p className="text-[9px] uppercase tracking-wide text-slate-500">Ticket</p><b className="mt-1 block truncate text-[11px] text-slate-200" title={brl.format(seller.count ? seller.revenue / seller.count : 0)}>{brl.format(seller.count ? seller.revenue / seller.count : 0)}</b></div><div className="rounded-lg bg-white/[.045] p-2"><p className="text-[9px] uppercase tracking-wide text-slate-500">{hasGoal ? "Meta" : "Participação"}</p><b className="mt-1 block text-[11px]" style={{ color: accent }}>{seller.performance.toFixed(1).replace(".", ",")}%</b></div></div></article>;
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

function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-white/[.035] p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><b className="mt-1 block truncate text-sm font-black text-slate-100" title={value}>{value}</b></div>; }

function RankingRow({ seller, position, hasGoal, avatarUrl, onAvatarUpload }: { seller: CommercialAccountRanking["sellers"][number]; position: number; hasGoal: boolean; avatarUrl?: string; onAvatarUpload: (sellerName: string, file: File) => Promise<void> }) { return <article className="grid grid-cols-[32px_36px_minmax(120px,1fr)_auto] items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-[#f6c94c]/25 animate-in fade-in-0 slide-in-from-right-2 motion-reduce:transform-none hover:bg-white/[.045] sm:grid-cols-[38px_40px_minmax(150px,1.2fr)_minmax(70px,.55fr)_minmax(100px,.75fr)_minmax(90px,.65fr)]"><b className="text-sm text-slate-500">{position}º</b><SellerAvatar seller={seller.seller} avatarUrl={avatarUrl} accent="#d5dae3" size="sm" onUpload={onAvatarUpload} /><div className="min-w-0"><b className="block truncate text-sm text-white">{seller.seller}</b><span className="text-[10px] text-slate-500">{seller.count} venda(s)</span></div><b className="hidden text-right text-xs text-slate-300 sm:block">{seller.count}</b><b className="hidden text-right text-xs text-slate-200 sm:block">{brl.format(seller.revenue)}</b><div className="text-right"><b className="text-xs text-[#f6c94c]">{seller.performance.toFixed(1).replace(".", ",")}%</b><span className="mt-1 block text-[9px] text-slate-500">{hasGoal ? "da meta" : "participação"}</span></div></article>; }

function EmptyRanking({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-white/45"><Users className="mx-auto mb-2 h-5 w-5" />{text}</div>;
}
