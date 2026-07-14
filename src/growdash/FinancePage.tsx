/* New tenant tables are queried through the Supabase client before generated types are refreshed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, eachMonthOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Download, Landmark, Plus, ReceiptText, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { aggregateSales, useSales } from "@/hooks/useSales";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MetricCard, PageHeading } from "./shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
type EntryType = "revenue" | "expense";

interface FinancialEntry {
  id: string; entry_type: EntryType; description: string; amount: number; competence_date: string;
  due_date?: string | null; paid_at?: string | null; status: string; recurrence: string; notes?: string | null;
  financial_categories?: { name: string } | null;
}

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export default function FinancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { adAccountId, startDate, endDate, businessUnitId, segment } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState({ entry_type: "expense" as EntryType, description: "", amount: "", competence_date: format(new Date(), "yyyy-MM-dd"), due_date: "", status: "pending", recurrence: "none", notes: "" });
  const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));
  const futureMonth = endOfMonth(new Date());

  const { data: allAccounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const unitAccounts = businessUnitId
    ? allAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : allAccounts;
  const accounts = accountFilter ? unitAccounts.filter((account) => account.id === accountFilter) : unitAccounts;
  const { data: insights = [], isLoading: loadingInsights } = useInsights({ adAccountId: accountFilter, startDate, endDate });
  const { data: sales = [], isLoading: loadingSales } = useSales({ adAccountId: accountFilter, startDate, endDate });
  const { data: historicalInsights = [] } = useInsights({ adAccountId: accountFilter, startDate: twelveMonthsAgo, endDate: futureMonth });
  const { data: historicalSales = [] } = useSales({ adAccountId: accountFilter, startDate: twelveMonthsAgo, endDate: futureMonth });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["financial-entries", workspace?.id, businessUnitId, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FinancialEntry[]> => {
      let request = (supabase as any).from("financial_entries").select("id, entry_type, description, amount, competence_date, due_date, paid_at, status, recurrence, notes, financial_categories(name)").eq("workspace_id", workspace!.id).gte("competence_date", format(startDate, "yyyy-MM-dd")).lte("competence_date", format(endDate, "yyyy-MM-dd")).order("competence_date", { ascending: false });
      if (businessUnitId) request = request.eq("business_unit_id", businessUnitId);
      const { data, error } = await request;
      if (error) {
        if (error.code === "42P01" || /financial_entries|schema cache|does not exist/i.test(error.message)) return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const { data: historicalEntries = [] } = useQuery({
    queryKey: ["financial-history", workspace?.id, businessUnitId], enabled: !!workspace?.id,
    queryFn: async (): Promise<FinancialEntry[]> => { let request = (supabase as any).from("financial_entries").select("id, entry_type, description, amount, competence_date, due_date, paid_at, status, recurrence, notes").eq("workspace_id", workspace!.id).gte("competence_date", format(twelveMonthsAgo, "yyyy-MM-dd")).lte("competence_date", format(futureMonth, "yyyy-MM-dd")); if (businessUnitId) request = request.eq("business_unit_id", businessUnitId); const { data, error } = await request; if (error) { if (error.code === "42P01" || /financial_entries|schema cache|does not exist/i.test(error.message)) return []; throw error; } return data ?? []; },
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!workspace?.id || !businessUnitId || !user?.id) throw new Error("Workspace ou unidade ainda não foi carregado.");
      const amount = Number(entry.amount.replace(",", "."));
      if (!entry.description.trim() || !Number.isFinite(amount) || amount <= 0) throw new Error("Informe descrição e valor maior que zero.");
      const { error } = await (supabase as any).from("financial_entries").insert({ workspace_id: workspace.id, business_unit_id: businessUnitId, user_id: user.id, ...entry, amount, due_date: entry.due_date || null, paid_at: entry.status === "paid" ? entry.competence_date : null });
      if (error) throw error;
    },
    onSuccess: () => { setEntryOpen(false); setEntry({ entry_type: "expense", description: "", amount: "", competence_date: format(new Date(), "yyyy-MM-dd"), due_date: "", status: "pending", recurrence: "none", notes: "" }); queryClient.invalidateQueries({ queryKey: ["financial-entries"] }); queryClient.invalidateQueries({ queryKey: ["financial-history"] }); toast({ title: "Lançamento criado" }); },
    onError: (error: Error) => toast({ title: "Não foi possível lançar", description: error.message, variant: "destructive" }),
  });

  const unitAccountIds = useMemo(() => new Set(accounts.map((account) => account.id)), [accounts]);
  const visibleInsights = insights.filter((item) => unitAccountIds.has(item.ad_account_id));
  const visibleSales = sales.filter((item) => !item.ad_account_id || unitAccountIds.has(item.ad_account_id));
  const spend = visibleInsights.reduce((sum, item) => sum + Number(item.spend || 0), 0);
  const otherRevenue = entries.filter((item) => item.entry_type === "revenue" && item.status !== "canceled").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = entries.filter((item) => item.entry_type === "expense" && item.status !== "canceled").reduce((sum, item) => sum + Number(item.amount), 0);
  const totalRevenue = aggregateSales(visibleSales).totalNet + otherRevenue;
  const result = totalRevenue - spend - expenses;
  const margin = totalRevenue > 0 ? result / totalRevenue : 0;
  const balance = accounts.reduce((sum, account) => sum + Number(account.remaining_balance || 0), 0);
  const roas = spend > 0 ? aggregateSales(visibleSales).totalNet / spend : 0;
  const isLoading = loadingAccounts || loadingInsights || loadingSales || loadingEntries;

  const rows = useMemo(() => accounts.map((account) => { const ai = insights.filter((item) => item.ad_account_id === account.id); const as = sales.filter((item) => item.ad_account_id === account.id); const accountSpend = ai.reduce((sum, item) => sum + Number(item.spend || 0), 0); const revenue = aggregateSales(as).totalNet; return { account, spend: accountSpend, leads: ai.reduce((sum, item) => sum + Number(item.leads || 0), 0), sales: as.length, revenue, roas: accountSpend > 0 ? revenue / accountSpend : 0 }; }), [accounts, insights, sales]);

  const monthlyHistory = useMemo(() => eachMonthOfInterval({ start: twelveMonthsAgo, end: new Date() }).map((month) => { const key = format(month, "yyyy-MM"); const revenue = aggregateSales(historicalSales.filter((sale) => (!sale.ad_account_id || unitAccountIds.has(sale.ad_account_id)) && String(sale.sale_date).startsWith(key))).totalNet + historicalEntries.filter((item) => item.entry_type === "revenue" && item.competence_date.startsWith(key) && item.status !== "canceled").reduce((sum, item) => sum + Number(item.amount), 0); const media = historicalInsights.filter((item) => unitAccountIds.has(item.ad_account_id) && String(item.date).startsWith(key)).reduce((sum, item) => sum + Number(item.spend || 0), 0); const operational = historicalEntries.filter((item) => item.entry_type === "expense" && item.competence_date.startsWith(key) && item.status !== "canceled").reduce((sum, item) => sum + Number(item.amount), 0); return { key, label: format(month, "MM/yy"), revenue, expense: media + operational, result: revenue - media - operational }; }), [historicalEntries, historicalInsights, historicalSales, twelveMonthsAgo, unitAccountIds]);
  const avgRevenue = monthlyHistory.reduce((sum, month) => sum + month.revenue, 0) / Math.max(monthlyHistory.length, 1);
  const avgExpense = monthlyHistory.reduce((sum, month) => sum + month.expense, 0) / Math.max(monthlyHistory.length, 1);
  const forecast = Array.from({ length: 6 }, (_, index) => ({ label: format(addMonths(startOfMonth(new Date()), index + 1), "MM/yy"), revenue: avgRevenue, expense: avgExpense, result: avgRevenue - avgExpense }));

  function exportCsv() { const header = ["Conta", "ID Meta", "Investimento", "Leads", "Vendas", "Faturamento líquido", "ROAS"]; const data = rows.map((row) => [row.account.name, row.account.account_id, row.spend, row.leads, row.sales, row.revenue, row.roas]); downloadCsv(`growdash-financeiro-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.csv`, [header, ...data]); }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="Gestão" title="Financeiro" description={`DRE, caixa, previsões e mídia da unidade ${segment === "saas" ? "SaaS" : "Infoproduto"}, com dados reais e filtros globais.`} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Exportar</Button><Button onClick={() => setEntryOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo lançamento</Button></div>} />

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/70 p-1"><TabsTrigger value="summary">Resumo</TabsTrigger><TabsTrigger value="dre">DRE</TabsTrigger><TabsTrigger value="entries">Lançamentos</TabsTrigger><TabsTrigger value="cashflow">Fluxo de caixa</TabsTrigger><TabsTrigger value="forecast">Previsão</TabsTrigger></TabsList>

        <TabsContent value="summary" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Receita total" value={isLoading ? "Carregando…" : brl.format(totalRevenue)} change="vendas + receitas" emphasis /><MetricCard label="Investimento em mídia" value={isLoading ? "Carregando…" : brl.format(spend)} change="período" /><MetricCard label="Despesas operacionais" value={isLoading ? "Carregando…" : brl.format(expenses)} change="lançamentos" /><MetricCard label="Resultado" value={isLoading ? "Carregando…" : brl.format(result)} change={result < 0 ? "revisar" : pct.format(margin)} /><MetricCard label="ROAS" value={isLoading ? "Carregando…" : `${roas.toFixed(2)}x`} change="vendas / mídia" /></div><AccountTable rows={rows} loading={isLoading} /><section className="gd-panel p-5"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-primary" /><div><h2 className="font-black">Saldo e autonomia</h2><p className="text-xs text-muted-foreground">Saldo consolidado {brl.format(balance)}; valores informados pelas contas.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{accounts.map((account) => { const daily = Number(account.daily_budget || 0); const remaining = Number(account.remaining_balance || 0); return <div key={account.id} className="rounded-xl border border-border p-4"><p className="truncate text-[10px] font-black">{account.name}</p><p className="mt-3 text-xl font-black">{brl.format(remaining)}</p><p className="text-[10px] text-muted-foreground">{daily > 0 ? `${Math.floor(remaining / daily)} dia(s) com orçamento atual` : "Orçamento diário não informado"}</p></div>; })}</div></section></TabsContent>

        <TabsContent value="dre"><section className="gd-panel overflow-hidden"><PanelTitle icon={<ReceiptText />} title="DRE gerencial" subtitle="Regime de competência no período selecionado." /><DreRow label="Receita líquida de vendas" value={aggregateSales(visibleSales).totalNet} /><DreRow label="Outras receitas" value={otherRevenue} /><DreRow label="Receita total" value={totalRevenue} strong /><DreRow label="(-) Investimento em mídia" value={-spend} /><DreRow label="(-) Despesas operacionais" value={-expenses} /><DreRow label="Resultado operacional" value={result} strong highlight /><DreRow label="Margem operacional" value={margin} percentage /></section></TabsContent>

        <TabsContent value="entries"><section className="gd-panel overflow-hidden"><PanelTitle icon={<Landmark />} title="Lançamentos" subtitle="Receitas e despesas manuais, sem duplicar vendas ou mídia importada." /><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Data", "Descrição", "Categoria", "Tipo", "Status", "Recorrência", "Valor"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{entries.map((item) => <tr key={item.id}><td className="px-4 py-3">{format(new Date(`${item.competence_date}T12:00:00`), "dd/MM/yyyy")}</td><td className="px-4 py-3 font-bold">{item.description}</td><td className="px-4 py-3">{item.financial_categories?.name ?? "Sem categoria"}</td><td className="px-4 py-3">{item.entry_type === "revenue" ? "Receita" : "Despesa"}</td><td className="px-4 py-3">{statusLabel(item.status)}</td><td className="px-4 py-3">{item.recurrence === "monthly" ? "Mensal" : item.recurrence === "yearly" ? "Anual" : "Único"}</td><td className={`px-4 py-3 font-black ${item.entry_type === "revenue" ? "text-emerald-500" : "text-rose-500"}`}>{item.entry_type === "expense" ? "-" : "+"}{brl.format(Number(item.amount))}</td></tr>)}</tbody></table></div><div className="divide-y divide-border md:hidden">{entries.map((item) => <div key={item.id} className="p-4"><div className="flex justify-between gap-3"><div><b className="text-sm">{item.description}</b><p className="text-[10px] text-muted-foreground">{format(new Date(`${item.competence_date}T12:00:00`), "dd/MM/yyyy")} · {statusLabel(item.status)}</p></div><b className={item.entry_type === "revenue" ? "text-emerald-500" : "text-rose-500"}>{item.entry_type === "expense" ? "-" : "+"}{brl.format(Number(item.amount))}</b></div></div>)}</div>{!entries.length && !loadingEntries && <div className="p-10 text-center text-xs text-muted-foreground">Nenhum lançamento neste período. Use “Novo lançamento”.</div>}</section></TabsContent>

        <TabsContent value="cashflow"><section className="gd-panel overflow-hidden"><PanelTitle icon={<TrendingUp />} title="Fluxo de caixa — 12 meses" subtitle="Vendas, mídia e lançamentos consolidados por mês." /><MonthlyTable rows={monthlyHistory} /></section></TabsContent>

        <TabsContent value="forecast" className="space-y-4"><div className="rounded-2xl border border-primary/25 bg-primary/5 p-5"><div className="flex gap-3"><Sparkles className="h-5 w-5 text-primary" /><div><b>Previsão determinística de 6 meses</b><p className="mt-1 text-xs text-muted-foreground">Baseada na média móvel dos últimos 12 meses. Não é uma promessa de resultado; valores melhoram conforme o histórico fica completo.</p></div></div></div><section className="gd-panel overflow-hidden"><MonthlyTable rows={forecast} /></section></TabsContent>
      </Tabs>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Novo lançamento financeiro</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo"><Select value={entry.entry_type} onValueChange={(value: EntryType) => setEntry({ ...entry, entry_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="revenue">Receita</SelectItem><SelectItem value="expense">Despesa</SelectItem></SelectContent></Select></Field><Field label="Valor"><Input inputMode="decimal" value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} placeholder="0,00" /></Field><div className="sm:col-span-2"><Field label="Descrição"><Input value={entry.description} onChange={(event) => setEntry({ ...entry, description: event.target.value })} /></Field></div><Field label="Competência"><Input type="date" value={entry.competence_date} onChange={(event) => setEntry({ ...entry, competence_date: event.target.value })} /></Field><Field label="Vencimento"><Input type="date" value={entry.due_date} onChange={(event) => setEntry({ ...entry, due_date: event.target.value })} /></Field><Field label="Status"><Select value={entry.status} onValueChange={(value) => setEntry({ ...entry, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="paid">Pago/recebido</SelectItem><SelectItem value="overdue">Vencido</SelectItem></SelectContent></Select></Field><Field label="Recorrência"><Select value={entry.recurrence} onValueChange={(value) => setEntry({ ...entry, recurrence: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Único</SelectItem><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="yearly">Anual</SelectItem></SelectContent></Select></Field><div className="sm:col-span-2"><Field label="Observações"><Textarea value={entry.notes} onChange={(event) => setEntry({ ...entry, notes: event.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setEntryOpen(false)}>Cancelar</Button><Button onClick={() => createEntry.mutate()} disabled={createEntry.isPending}>{createEntry.isPending ? "Salvando…" : "Salvar lançamento"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function PanelTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) { return <div className="flex items-center gap-3 border-b border-border p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div></div>; }
function DreRow({ label, value, strong, highlight, percentage }: { label: string; value: number; strong?: boolean; highlight?: boolean; percentage?: boolean }) { return <div className={`flex items-center justify-between border-b border-border px-5 py-4 last:border-0 ${highlight ? "bg-primary/5" : ""}`}><span className={strong ? "font-black" : "text-sm"}>{label}</span><span className={`${strong ? "text-lg font-black" : "font-semibold"} ${value < 0 ? "text-rose-500" : highlight ? "text-emerald-500" : ""}`}>{percentage ? pct.format(value) : brl.format(value)}</span></div>; }
function AccountTable({ rows, loading }: { rows: any[]; loading: boolean }) { return <section className="gd-panel overflow-hidden"><PanelTitle icon={<TrendingUp />} title="Mídia x faturamento" subtitle="Cruzamento por conta de anúncio." /><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Conta", "Plataforma", "Investimento", "Leads", "Vendas", "Faturamento", "ROAS"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.account.id}><td className="px-4 py-4 font-black">{row.account.name}</td><td className="px-4 py-4">Meta Ads</td><td className="px-4 py-4">{brl.format(row.spend)}</td><td className="px-4 py-4">{row.leads}</td><td className="px-4 py-4">{row.sales}</td><td className="px-4 py-4 font-black">{brl.format(row.revenue)}</td><td className="px-4 py-4 font-black text-emerald-500">{row.roas.toFixed(2)}x</td></tr>)}</tbody></table></div><div className="divide-y divide-border md:hidden">{rows.map((row) => <div key={row.account.id} className="p-4"><b className="text-sm">{row.account.name}</b><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span>Investimento <b className="block">{brl.format(row.spend)}</b></span><span>Faturamento <b className="block">{brl.format(row.revenue)}</b></span><span>Leads <b className="block">{row.leads}</b></span><span>ROAS <b className="block text-emerald-500">{row.roas.toFixed(2)}x</b></span></div></div>)}</div>{!loading && !rows.length && <div className="p-10 text-center text-xs text-muted-foreground">Nenhuma conta conectada para esta unidade.</div>}</section>; }
function MonthlyTable({ rows }: { rows: { label: string; revenue: number; expense: number; result: number }[] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr><th className="px-4 py-3">Mês</th><th className="px-4 py-3">Entradas</th><th className="px-4 py-3">Saídas</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Margem</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.label}><td className="px-4 py-3 font-black">{row.label}</td><td className="px-4 py-3 text-emerald-500">{brl.format(row.revenue)}</td><td className="px-4 py-3 text-rose-500">{brl.format(row.expense)}</td><td className={`px-4 py-3 font-black ${row.result < 0 ? "text-rose-500" : "text-emerald-500"}`}>{brl.format(row.result)}</td><td className="px-4 py-3">{row.revenue > 0 ? pct.format(row.result / row.revenue) : "—"}</td></tr>)}</tbody></table></div>; }
function statusLabel(status: string) { return status === "paid" ? "Pago/recebido" : status === "overdue" ? "Vencido" : status === "canceled" ? "Cancelado" : "Pendente"; }
function downloadCsv(filename: string, lines: unknown[][]) { const csv = lines.map((line) => line.map(csvCell).join(";")).join("\n"); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
