import { useMemo, useState } from "react";
import { Award, Medal, Target, TrendingUp, Trophy } from "lucide-react";
import { format } from "date-fns";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useProducts } from "@/hooks/useProducts";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { aggregateSales, useSales, type Sale } from "@/hooks/useSales";
import { MetricCard, PageHeading } from "./shared";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function customValue(sale: Sale, keys: string[]) {
  const fields = sale.custom_fields || {};
  const entry = Object.entries(fields).find(([key]) => keys.includes(key.toLowerCase()));
  return entry?.[1] || null;
}

export default function CommercialPage() {
  const { adAccountId, startDate, endDate } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const { data: sales = [], isLoading } = useSales({ startDate, endDate, adAccountId: accountFilter });
  const { data: rdDeals = [] } = useRDDealsForPeriod({ startDate, endDate, adAccountId: accountFilter });
  const { data: products = [] } = useProducts();
  const [sellerFilter, setSellerFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product.name])), [products]);
  const dealOwners = useMemo(() => new Map(rdDeals.map((deal) => [deal.rd_deal_id, deal.deal_owner_name || "Não informado"])), [rdDeals]);
  const enriched = useMemo(() => sales.map((sale) => {
    const seller = customValue(sale, ["vendedor", "seller", "responsavel", "responsável", "deal_owner_name"])
      || (sale.rd_deal_id ? dealOwners.get(sale.rd_deal_id) : null)
      || "Não informado";
    const commissionRaw = customValue(sale, ["comissao", "comissão", "commission", "valor_comissao"]);
    const commission = commissionRaw ? Number(String(commissionRaw).replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0 : 0;
    return { sale, seller, commission, product: (sale.product_id && productNames.get(sale.product_id)) || sale.rd_product_name || "Não informado" };
  }), [sales, dealOwners, productNames]);
  const sellers = useMemo(() => Array.from(new Set(enriched.map((row) => row.seller))).sort(), [enriched]);
  const filtered = useMemo(() => enriched.filter((row) => (
    (sellerFilter === "all" || row.seller === sellerFilter)
    && (productFilter === "all" || row.sale.product_id === productFilter)
  )), [enriched, sellerFilter, productFilter]);
  const totals = useMemo(() => aggregateSales(filtered.map((row) => row.sale)), [filtered]);
  const ranking = useMemo(() => {
    const map = new Map<string, { seller: string; revenue: number; count: number; commission: number }>();
    for (const row of filtered) {
      if (row.sale.status !== "confirmed" && row.sale.status !== "pending") continue;
      const current = map.get(row.seller) || { seller: row.seller, revenue: 0, count: 0, commission: 0 };
      current.revenue += Number(row.sale.net_revenue || 0);
      current.count += Number(row.sale.quantity || 1);
      current.commission += row.commission;
      map.set(row.seller, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);
  const rankingLeaderRevenue = ranking[0]?.revenue || 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Performance de vendas"
        title="Comercial"
        description="Ranking, vendas e ticket médio calculados com os dados reais do período selecionado."
        actions={(
          <div className="flex flex-wrap gap-2">
            <select className="gd-button min-w-40" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}><option value="all">Todos os vendedores</option>{sellers.map((seller) => <option key={seller} value={seller}>{seller}</option>)}</select>
            <select className="gd-button min-w-40" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="all">Todos os produtos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          </div>
        )}
      />
      <div className="gd-auto-grid gap-3">
        <MetricCard label="Receita líquida" value={isLoading ? "Carregando…" : brl.format(totals.totalNet)} change="período" emphasis />
        <MetricCard label="Vendas" value={isLoading ? "Carregando…" : String(totals.totalQuantity)} change="confirmadas + pendentes" />
        <MetricCard label="Ticket médio" value={isLoading ? "Carregando…" : brl.format(totals.arpu)} change="por item" />
        <MetricCard label="Vendedores identificados" value={isLoading ? "Carregando…" : String(ranking.length)} change="dados RD/venda" />
      </div>

      <section className="gd-panel mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Ranking comercial</p>
            <h2 className="mt-1 text-lg font-black">Pódio do período</h2>
            <p className="mt-1 text-xs text-muted-foreground">Receita líquida, participação, vendas, ticket e comissão por responsável.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-bold text-primary">
            <TrendingUp className="h-4 w-4" /> {ranking.length} vendedor(es) ranqueado(s)
          </div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-3">
        {[0, 1, 2].map((position) => {
          const item = ranking[position];
          const Icon = position === 0 ? Trophy : position === 1 ? Medal : Award;
          const share = item && totals.totalNet > 0 ? (item.revenue / totals.totalNet) * 100 : 0;
          const progress = item && rankingLeaderRevenue > 0 ? (item.revenue / rankingLeaderRevenue) * 100 : 0;
          const ticket = item?.count ? item.revenue / item.count : 0;
          const medalTone = position === 0
            ? "border-[#d9ad33]/70 bg-gradient-to-br from-[#fff8df] via-white to-white dark:from-[#211a09] dark:via-[#0d0c09] dark:to-[#080808]"
            : position === 1
              ? "border-slate-400/35 bg-gradient-to-br from-slate-100/70 to-transparent dark:from-slate-400/10"
              : "border-amber-700/30 bg-gradient-to-br from-amber-600/10 to-transparent";
          return (
            <article key={position} className={`min-w-0 rounded-xl border p-5 shadow-sm ${medalTone}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary"><Icon className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">{position + 1}º lugar</p>
                  <h3 className="truncate text-base font-black" title={item?.seller || "Sem dados"}>{item?.seller || "Sem dados"}</h3>
                </div>
                <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] font-black tabular-nums">{share.toFixed(1).replace(".", ",")}%</span>
              </div>
              <p className="mt-5 text-2xl font-black tabular-nums">{item ? brl.format(item.revenue) : "—"}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-[#a66b00] via-[#f4cf61] to-[#fff0a8]" style={{ width: `${progress}%` }} /></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-border/70 bg-background/50 p-2"><span className="text-muted-foreground">Vendas</span><strong className="mt-1 block text-xs">{item?.count || 0}</strong></div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-2"><span className="text-muted-foreground">Ticket médio</span><strong className="mt-1 block truncate text-xs" title={brl.format(ticket)}>{item ? brl.format(ticket) : "—"}</strong></div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground"><Target className="h-3.5 w-3.5 text-primary" /> Comissão: {item?.commission ? brl.format(item.commission) : "não informada"}</div>
            </article>
          );
        })}
        </div>
      </section>

      <section className="gd-panel mt-4 overflow-hidden">
        <div className="border-b border-border p-5"><h2 className="font-black">Vendas detalhadas</h2><p className="text-xs text-muted-foreground">A comissão só aparece quando recebida em campo explícito; a plataforma não estima valores.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Data", "Cliente", "Vendedor", "Produto", "Valor", "Comissão", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{filtered.map((row) => <tr key={row.sale.id}><td className="px-4 py-4">{format(new Date(`${row.sale.sale_date}T12:00:00`), "dd/MM/yyyy")}</td><td className="px-4 py-4 font-black">{row.sale.contact_name || row.sale.contact_email || "Não informado"}</td><td className="px-4 py-4">{row.seller}</td><td className="px-4 py-4">{row.product}</td><td className="px-4 py-4 font-black">{brl.format(Number(row.sale.net_revenue || 0))}</td><td className="px-4 py-4">{row.commission ? brl.format(row.commission) : "—"}</td><td className="px-4 py-4"><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold">{row.sale.status}</span></td></tr>)}{!isLoading && !filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhuma venda encontrada com estes filtros.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}
