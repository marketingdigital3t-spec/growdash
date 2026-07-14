import { CalendarDays, Download, TrendingUp, WalletCards } from "lucide-react";
import { adAccounts, attributionRows } from "./data";
import { MetricCard, PageHeading } from "./shared";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function FinancePage() {
  const totals = attributionRows.reduce((sum, row) => ({ spend: sum.spend + row.spend, revenue: sum.revenue + row.revenue, deals: sum.deals + row.deals }), { spend: 0, revenue: 0, deals: 0 });
  const balance = adAccounts.reduce((sum, account) => sum + account.remainingBalance, 0);
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="Gestão" title="Financeiro" description="Investimento de mídia, saldo, faturamento do RD Station e retorno atribuível por conta." actions={<><button className="gd-button"><CalendarDays className="h-4 w-4" /> Este mês</button><button className="gold-action"><Download className="h-4 w-4" /> Exportar</button></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Investimento em mídia" value={brl.format(totals.spend)} change="+8,4%" emphasis />
        <MetricCard label="Faturamento atribuído" value={brl.format(totals.revenue)} change="+21,2%" />
        <MetricCard label="ROAS consolidado" value={`${(totals.revenue / totals.spend).toFixed(2)}x`} change="+0,62x" />
        <MetricCard label="Saldo disponível" value={brl.format(balance)} change="12 dias" />
      </div>
      <section className="gd-panel mt-4 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[#e3ded7] p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#faf0cf] text-[#956e14]"><TrendingUp className="h-5 w-5" /></span><div><h2 className="font-black">Mídia x faturamento</h2><p className="text-xs text-[#807970]">Cruzamento por conta de anúncio e vendas sincronizadas do CRM</p></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-[#f7f5f2] text-[10px] text-[#736d66]"><tr>{["Conta", "Plataforma", "Investimento", "Leads", "Vendas", "Faturamento", "ROAS"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#eeeae4]">{attributionRows.map((row) => <tr key={row.account} className="hover:bg-[#fffaf0]"><td className="px-4 py-4 font-black">{row.account}</td><td className="px-4 py-4">{row.platform}</td><td className="px-4 py-4">{brl.format(row.spend)}</td><td className="px-4 py-4">{row.leads}</td><td className="px-4 py-4">{row.deals}</td><td className="px-4 py-4 font-black">{brl.format(row.revenue)}</td><td className="px-4 py-4 font-black text-[#3f8155]">{row.roas.toFixed(2)}x</td></tr>)}</tbody></table></div>
      </section>
      <section className="gd-panel mt-4 p-5"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-[#a27817]" /><div><h2 className="font-black">Saldo e autonomia</h2><p className="text-xs text-[#817a72]">Projeção baseada no orçamento diário atual</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{adAccounts.map((account) => <div key={account.id} className="rounded-xl border border-[#e3ded6] p-4"><p className="truncate text-[10px] font-black">{account.name}</p><p className="mt-3 text-xl font-black">{brl.format(account.remainingBalance)}</p><p className="mt-1 text-[10px] text-[#817a72]">Orçamento diário {brl.format(account.dailyBudget)}</p></div>)}</div></section>
    </div>
  );
}
