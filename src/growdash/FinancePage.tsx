import { useMemo } from "react";
import { Download, TrendingUp, WalletCards } from "lucide-react";
import { format } from "date-fns";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { aggregateSales, useSales } from "@/hooks/useSales";
import { MetricCard, PageHeading } from "./shared";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function FinancePage() {
  const { adAccountId, startDate, endDate } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const { data: allAccounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const accounts = accountFilter ? allAccounts.filter((account) => account.id === accountFilter) : allAccounts;
  const { data: insights = [], isLoading: loadingInsights } = useInsights({ adAccountId: accountFilter, startDate, endDate });
  const { data: sales = [], isLoading: loadingSales } = useSales({ adAccountId: accountFilter, startDate, endDate });

  const salesTotals = useMemo(() => aggregateSales(sales), [sales]);
  const rows = useMemo(() => accounts.map((account) => {
    const accountInsights = insights.filter((insight) => insight.ad_account_id === account.id);
    const accountSales = sales.filter((sale) => sale.ad_account_id === account.id);
    const spend = accountInsights.reduce((sum, insight) => sum + Number(insight.spend || 0), 0);
    const leads = accountInsights.reduce((sum, insight) => sum + Number(insight.leads || 0), 0);
    const revenue = aggregateSales(accountSales).totalNet;
    return { account, spend, leads, sales: accountSales.length, revenue, roas: spend > 0 ? revenue / spend : 0 };
  }), [accounts, insights, sales]);
  const spend = insights.reduce((sum, insight) => sum + Number(insight.spend || 0), 0);
  const balance = accounts.reduce((sum, account) => sum + Number(account.remaining_balance || 0), 0);
  const roas = spend > 0 ? salesTotals.totalNet / spend : 0;
  const isLoading = loadingAccounts || loadingInsights || loadingSales;

  function exportCsv() {
    const header = ["Conta", "ID Meta", "Investimento", "Leads", "Vendas", "Faturamento líquido", "ROAS"];
    const data = rows.map((row) => [row.account.name, row.account.account_id, row.spend, row.leads, row.sales, row.revenue, row.roas]);
    const csv = [header, ...data].map((line) => line.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `growdash-financeiro-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Gestão"
        title="Financeiro"
        description="Investimento Meta, vendas registradas e retorno calculados com os filtros globais."
        actions={<button className="gold-action" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Exportar CSV</button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Investimento em mídia" value={isLoading ? "Carregando…" : brl.format(spend)} change="período" emphasis />
        <MetricCard label="Faturamento líquido" value={isLoading ? "Carregando…" : brl.format(salesTotals.totalNet)} change={`${salesTotals.totalQuantity} venda(s)`} />
        <MetricCard label="ROAS consolidado" value={isLoading ? "Carregando…" : `${roas.toFixed(2)}x`} change="receita / mídia" />
        <MetricCard label="Saldo informado" value={isLoading ? "Carregando…" : brl.format(balance)} change={`${accounts.length} conta(s)`} />
      </div>

      <section className="gd-panel mt-4 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#faf0cf] text-[#956e14] dark:bg-[#332912]"><TrendingUp className="h-5 w-5" /></span><div><h2 className="font-black">Mídia x faturamento</h2><p className="text-xs text-muted-foreground">Cruzamento real por conta de anúncio</p></div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Conta", "Plataforma", "Investimento", "Leads", "Vendas", "Faturamento", "ROAS"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => <tr key={row.account.id} className="hover:bg-muted/40"><td className="px-4 py-4 font-black">{row.account.name}</td><td className="px-4 py-4">Meta Ads</td><td className="px-4 py-4">{brl.format(row.spend)}</td><td className="px-4 py-4">{row.leads}</td><td className="px-4 py-4">{row.sales}</td><td className="px-4 py-4 font-black">{brl.format(row.revenue)}</td><td className="px-4 py-4 font-black text-[#3f8155]">{row.roas.toFixed(2)}x</td></tr>)}
              {!isLoading && !rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhuma conta conectada para este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gd-panel mt-4 p-5">
        <div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-[#a27817]" /><div><h2 className="font-black">Saldo e autonomia</h2><p className="text-xs text-muted-foreground">Valores configurados em cada conta; não são estimativas inventadas.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {accounts.map((account) => {
            const dailyBudget = Number(account.daily_budget || 0);
            const remaining = Number(account.remaining_balance || 0);
            const days = dailyBudget > 0 ? Math.floor(remaining / dailyBudget) : null;
            return <div key={account.id} className="rounded-xl border border-border p-4"><p className="truncate text-[10px] font-black">{account.name}</p><p className="mt-3 text-xl font-black">{brl.format(remaining)}</p><p className="mt-1 text-[10px] text-muted-foreground">Orçamento diário {brl.format(dailyBudget)}{days !== null ? ` · ${days} dia(s)` : ""}</p></div>;
          })}
        </div>
      </section>
    </div>
  );
}
