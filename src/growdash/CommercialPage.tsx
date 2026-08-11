import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Crown, Sparkles, Target, Users } from "lucide-react";
import { format } from "date-fns";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { aggregateSales, useSales, type Sale } from "@/hooks/useSales";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useSalesGoals } from "@/hooks/useSalesGoals";
import { MetricCard, PageHeading } from "./shared";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { buildCommercialAccountRankings, type CommercialAccountRanking, type CommercialSaleRow } from "@/lib/commercialRanking";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
  const {
    adAccountId,
    setAdAccountId,
    startDate,
    endDate,
    preset,
    setPreset,
    customRange,
    setCustomRange,
    businessUnitId,
    segment,
  } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const { data: sales = [], isLoading } = useSales({ startDate, endDate, adAccountId: accountFilter });
  const { data: rdDeals = [] } = useRDDealsForPeriod({ startDate, endDate, adAccountId: accountFilter });
  const { data: products = [] } = useProducts();
  const { data: adAccounts = [] } = useAdAccounts();
  const { data: goalData } = useSalesGoals(new Date());
  const [sellerFilter, setSellerFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  const accessibleAccounts = useMemo(() => {
    const accounts = businessUnitId
      ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
      : adAccounts;
    return accounts;
  }, [adAccounts, businessUnitId, segment]);
  const visibleAccounts = useMemo(() => accountFilter ? accessibleAccounts.filter((account) => account.id === accountFilter) : accessibleAccounts, [accessibleAccounts, accountFilter]);
  const accountOptions = useMemo(() => accessibleAccounts.map((account) => ({ id: account.id, name: account.name })), [accessibleAccounts]);
  const rankingAccountOptions = useMemo(() => visibleAccounts.map((account) => ({ id: account.id, name: account.name })), [visibleAccounts]);

  useEffect(() => {
    if (adAccountId !== "all" && accessibleAccounts.length && !accessibleAccounts.some((account) => account.id === adAccountId)) setAdAccountId("all");
  }, [accessibleAccounts, adAccountId, setAdAccountId]);
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
    (sellerFilter === "all" || row.seller === sellerFilter)
    && (productFilter === "all" || productFilter === `local:${row.sale.product_id}` || (!row.sale.product_id && productFilter === `rd:${row.product}`))
  )), [enriched, productFilter, sellerFilter]);
  const goals = useMemo(() => new Map((goalData?.rows ?? []).map((goal) => [goal.ad_account_id, Number(goal.target_revenue)])), [goalData?.rows]);
  const rankingDeals = useMemo(() => sellerFilter === "all" ? rdDeals : rdDeals.filter((deal) => deal.deal_owner_name === sellerFilter), [rdDeals, sellerFilter]);
  const accountRankings = useMemo(() => buildCommercialAccountRankings({ sales: filtered, deals: rankingDeals, accounts: rankingAccountOptions, goals }), [filtered, goals, rankingAccountOptions, rankingDeals]);
  const totals = useMemo(() => aggregateSales(filtered.map((row) => row.sale)), [filtered]);
  const overallRanking = useMemo(() => {
    const map = new Map<string, { seller: string; revenue: number; count: number; commission: number }>();
    for (const row of filtered) {
      if (row.sale.status !== "confirmed") continue;
      const current = map.get(row.seller) || { seller: row.seller, revenue: 0, count: 0, commission: 0 };
      current.revenue += Number(row.sale.net_revenue || 0);
      current.count += Number(row.sale.quantity || 1);
      current.commission += row.commission;
      map.set(row.seller, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.count - a.count);
  }, [filtered]);
  const bestAccount = accountRankings.find((account) => account.leader?.revenue > 0) || accountRankings[0];
  const recovery = accountRankings.flatMap((account) => account.recovery.map((seller) => ({ ...seller, accountName: account.accountName, accountId: account.accountId })));

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageHeading
        eyebrow="Performance de vendas"
        title="Ranking Comercial"
        description="Descubra o melhor vendedor em cada conta de anúncio com base nas vendas confirmadas e metas configuradas."
        actions={(
          <div className="flex flex-wrap gap-2">
            <MetaDateRangePicker preset={preset} onPresetChange={setPreset} customRange={customRange} onCustomRangeChange={setCustomRange} startDate={startDate} endDate={endDate} className="min-w-[235px]" />
            <select aria-label="Filtrar por conta de anúncio" className="gd-button min-w-44" value={adAccountId} onChange={(event) => setAdAccountId(event.target.value)}>
              <option value="all">Todas as contas</option>
              {accountOptions.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <select aria-label="Filtrar por vendedor" className="gd-button min-w-40" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}><option value="all">Todos os vendedores</option>{sellers.map((seller) => <option key={seller} value={seller}>{seller}</option>)}</select>
            <select aria-label="Filtrar por produto" className="gd-button min-w-40" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="all">Todos os produtos</option>{productOptions.map((product) => <option key={product.value} value={product.value}>{product.label}</option>)}</select>
          </div>
        )}
      />

      <div className="gd-auto-grid gap-3">
        <MetricCard label="Receita líquida" value={isLoading ? "Carregando…" : brl.format(totals.totalNet)} change="vendas confirmadas" emphasis />
        <MetricCard label="Vendas" value={isLoading ? "Carregando…" : String(totals.totalQuantity)} change={`${accountRankings.length} conta(s)`} />
        <MetricCard label="Ticket médio" value={isLoading ? "Carregando…" : brl.format(totals.arpu)} change="por item" />
        <MetricCard label="Líderes identificados" value={isLoading ? "Carregando…" : String(accountRankings.filter((account) => !!account.leader).length)} change="por conta de anúncio" />
      </div>

      <section className="gd-panel overflow-hidden border-[#b57a20]/45 bg-gradient-to-br from-[#241607] via-[#110b04] to-[#060402] text-white shadow-[0_20px_80px_-35px_rgba(104,62,9,.72)] dark:border-[#b57a20]/45">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#e1b832]">Líderes de vendas</p><h2 className="mt-1 text-xl font-black tracking-tight">Melhor vendedor por conta de anúncio</h2><p className="mt-1 text-xs text-white/55">A classificação usa somente a receita líquida confirmada no intervalo selecionado.</p></div>
          <div className="flex items-center gap-2 rounded-full border border-[#e1b832]/30 bg-[#e1b832]/10 px-3 py-2 text-xs font-bold text-[#f1cc55]"><Crown className="h-4 w-4" />{accountRankings.length} conta(s) analisada(s)</div>
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <div className="space-y-5">
            {accountRankings.map((account) => <AccountPodium key={account.accountId} account={account} />)}
            {!accountRankings.length && <EmptyRanking text="Nenhuma conta de anúncio encontrada para os filtros atuais." />}
          </div>
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#b57a20]/45 bg-[#171006]/75 p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d9b86c]">Classificação geral</p><h3 className="mt-1 text-lg font-black">Todos os vendedores</h3></div><BarChart3 className="h-5 w-5 text-[#d8a63a]" /></div>
              <div className="mt-4 space-y-2">{overallRanking.map((item, index) => <div key={item.seller} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[.035] p-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#9e6815]/25 text-sm font-black text-[#e7c776]">{index + 1}</span><span className="min-w-0"><b className="block truncate text-sm">{item.seller}</b><small className="text-[10px] text-white/45">{item.count} venda(s) confirmada(s)</small></span><b className="text-sm tabular-nums text-[#f4dfaa]">{brl.format(item.revenue)}</b></div>)}{!overallRanking.length && <p className="py-6 text-center text-xs text-white/45">Nenhuma venda confirmada no período.</p>}</div>
            </section>
            <section className="rounded-2xl border border-rose-400/35 bg-rose-950/20 p-4">
              <div className="flex items-center gap-2 text-rose-300"><AlertTriangle className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[.2em]">Zona de recuperação</p></div>
              <p className="mt-1 text-xs text-white/50">Vendedores abaixo de 50% da meta ou da participação de receita da conta.</p>
              <div className="mt-4 space-y-2">{recovery.slice(0, 12).map((item) => <div key={`${item.accountId}:${item.seller}`} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-rose-300/15 bg-rose-900/10 p-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-rose-400/15 text-xs font-black text-rose-300">!</span><span className="min-w-0"><b className="block truncate text-sm text-rose-100">{item.seller}</b><small className="block truncate text-[10px] text-rose-200/50">{item.accountName} · {item.count} venda(s)</small></span><b className="text-sm tabular-nums text-rose-300">{item.performance.toFixed(1).replace(".", ",")}%</b></div>)}{!recovery.length && <p className="py-6 text-center text-xs text-white/45">Nenhum vendedor na zona de recuperação.</p>}</div>
            </section>
          </div>
        </div>
      </section>

      <section className="gd-panel overflow-hidden border-[#d3aa35]/35 bg-gradient-to-br from-[#fffdf5] to-[#f7f0dc] dark:from-[#211a0a] dark:to-[#0e0d0a]">
        <div className="flex items-start gap-3 border-b border-[#d3aa35]/20 p-5"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#d4a92e]" /><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#a27c1b] dark:text-[#e0b53b]">Motivação</p><p className="mt-2 text-xl font-black italic text-[#302710] dark:text-[#f7edcf]">{bestAccount?.leader ? `“${bestAccount.leader.seller}, ${bestAccount.accountName} está puxando o time para cima.”` : "“Cada conversa é uma oportunidade de evolução.”"}</p></div></div>
      </section>

      <section className="gd-panel mt-4 overflow-hidden">
        <div className="border-b border-border p-5"><h2 className="font-black">Vendas detalhadas</h2><p className="text-xs text-muted-foreground">A comissão só aparece quando recebida em campo explícito; a plataforma não estima valores.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Data", "Conta de anúncio", "Cliente", "Vendedor", "Produto", "Valor", "Comissão", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{filtered.map((row) => <tr key={row.sale.id}><td className="px-4 py-4">{format(new Date(`${row.sale.sale_date}T12:00:00`), "dd/MM/yyyy")}</td><td className="max-w-48 truncate px-4 py-4">{accountOptions.find((account) => account.id === row.sale.ad_account_id)?.name || "Sem conta de anúncio"}</td><td className="px-4 py-4 font-black">{row.sale.contact_name || row.sale.contact_email || "Não informado"}</td><td className="px-4 py-4">{row.seller}</td><td className="px-4 py-4">{row.product}</td><td className="px-4 py-4 font-black">{brl.format(Number(row.sale.net_revenue || 0))}</td><td className="px-4 py-4">{row.commission ? brl.format(row.commission) : "—"}</td><td className="px-4 py-4"><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold">{row.sale.status}</span></td></tr>)}{!isLoading && !filtered.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhuma venda encontrada com estes filtros.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}

function AccountPodium({ account }: { account: CommercialAccountRanking }) {
  const podium = account.sellers.slice(0, 3);
  const hasGoal = account.target > 0;
  return <section className="rounded-2xl border border-[#c49b2e]/35 bg-[#0c1429]/70 p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#d9b63c]">Conta de anúncio</p><h3 className="mt-1 truncate text-lg font-black text-white" title={account.accountName}>{account.accountName}</h3></div><div className="text-right"><p className="text-[10px] text-white/45">Receita confirmada</p><b className="text-sm text-[#f4d064]">{brl.format(account.totalRevenue)}</b></div></div>
    {hasGoal && <div className="mt-3 flex items-center gap-2 text-[10px] text-white/50"><Target className="h-3.5 w-3.5 text-[#e1b832]" />Meta: {brl.format(account.target)} · {account.totalRevenue > 0 ? ((account.totalRevenue / account.target) * 100).toFixed(1).replace(".", ",") : "0,0"}% alcançada</div>}
    <div className="mt-4 grid items-end gap-3 sm:grid-cols-3">{podium.map((seller, index) => <div key={seller.seller} className={`rounded-xl border p-3 text-center ${index === 0 ? "border-[#e4bb38]/80 bg-[#30250d] shadow-[0_0_28px_-12px_rgba(239,193,55,.9)]" : index === 1 ? "border-slate-300/35 bg-white/[.05]" : "border-amber-600/35 bg-amber-900/10"}`}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border-2 border-[#e4bb38] bg-[#1d2d4e] text-sm font-black text-white">{initials(seller.seller)}</div>
      <p className="mt-2 truncate text-xs font-black text-white" title={seller.seller}>{seller.seller}</p><p className="mt-1 text-[10px] text-white/50">{index + 1}º lugar</p><p className="mt-3 text-lg font-black text-[#f6d86b]">{seller.performance.toFixed(1).replace(".", ",")}%</p><p className="mt-1 truncate text-[10px] text-white/50" title={hasGoal ? "da meta da conta" : "da receita da conta"}>{hasGoal ? "da meta" : "da receita"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e4bb38]" style={{ width: `${Math.min(100, seller.performance)}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-1 text-[10px]"><span className="rounded-lg bg-white/[.05] p-2"><small className="block text-white/40">Vendas</small><b className="text-white">{seller.count}</b></span><span className="rounded-lg bg-white/[.05] p-2"><small className="block text-white/40">Receita</small><b className="block truncate text-white" title={brl.format(seller.revenue)}>{brl.format(seller.revenue)}</b></span></div>
    </div>)}{!podium.length && <EmptyRanking text="Nenhum vendedor identificado nesta conta." />}</div>
  </section>;
}

function EmptyRanking({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-white/45"><Users className="mx-auto mb-2 h-5 w-5" />{text}</div>;
}
