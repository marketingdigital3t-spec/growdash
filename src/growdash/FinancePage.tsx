/* New tenant tables are queried through the Supabase client before generated types are refreshed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, eachMonthOfInterval, endOfMonth, format, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Building2, CreditCard, Download, Landmark, Plus, ReceiptText, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { Switch } from "@/components/ui/switch";
import { TrafficInvestmentPlanner } from "@/components/finance/TrafficInvestmentPlanner";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
type EntryType = "revenue" | "expense";

interface FinancialEntry {
  id: string; entry_type: EntryType; description: string; amount: number; competence_date: string;
  due_date?: string | null; paid_at?: string | null; status: string; recurrence: string; notes?: string | null;
  financial_categories?: { name: string } | null;
}
interface FinancialAccount { id: string; name: string; account_type: string; institution_name?: string | null; last_four?: string | null; balance?: number | null; status: string; last_synced_at?: string | null; }
interface Company { id: string; name: string; legal_name?: string | null; expert_name?: string | null; status: string; }

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export default function FinancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspace();
  const {
    adAccountId,
    setAdAccountId,
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate,
    endDate,
    businessUnitId,
    segment,
  } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const [entryOpen, setEntryOpen] = useState(false);
  const [includeMetaTax, setIncludeMetaTax] = useState(true);
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

  const { data: financialAccounts = [] } = useQuery({
    queryKey: ["financial-accounts", workspace?.id, businessUnitId], enabled: !!workspace?.id,
    queryFn: async (): Promise<FinancialAccount[]> => { if (!workspace?.id || workspace.id.startsWith("legacy-")) return []; let request = (supabase as any).from("financial_accounts").select("id,name,account_type,institution_name,last_four,balance,status,last_synced_at").eq("workspace_id", workspace.id); if (businessUnitId && !businessUnitId.startsWith("legacy-")) request = request.eq("business_unit_id", businessUnitId); const { data, error } = await request.order("name"); if (error) { if (error.code === "42P01" || /financial_accounts|schema cache|does not exist/i.test(error.message)) return []; throw error; } return data ?? []; },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["finance-companies", workspace?.id, businessUnitId], enabled: !!workspace?.id,
    queryFn: async (): Promise<Company[]> => { if (!workspace?.id || workspace.id.startsWith("legacy-")) return []; let request = (supabase as any).from("companies").select("id,name,legal_name,expert_name,status").eq("workspace_id", workspace.id); if (businessUnitId && !businessUnitId.startsWith("legacy-")) request = request.eq("business_unit_id", businessUnitId); const { data, error } = await request.order("name"); if (error) { if (error.code === "42P01" || /companies|schema cache|does not exist/i.test(error.message)) return []; throw error; } return data ?? []; },
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
  const metaTaxRate = 0.1215;
  const adjustedSpend = spend * (includeMetaTax ? 1 + metaTaxRate : 1);
  const metaTax = adjustedSpend - spend;
  const result = totalRevenue - adjustedSpend - expenses;
  const margin = totalRevenue > 0 ? result / totalRevenue : 0;
  const balance = accounts.reduce((sum, account) => sum + Number(account.remaining_balance || 0), 0);
  const roas = adjustedSpend > 0 ? aggregateSales(visibleSales).totalNet / adjustedSpend : 0;
  const isLoading = loadingAccounts || loadingInsights || loadingSales || loadingEntries;

  const rows = useMemo(() => accounts.map((account) => { const ai = insights.filter((item) => item.ad_account_id === account.id); const as = sales.filter((item) => item.ad_account_id === account.id); const accountSpend = ai.reduce((sum, item) => sum + Number(item.spend || 0), 0); const revenue = aggregateSales(as).totalNet; return { account, spend: accountSpend, leads: ai.reduce((sum, item) => sum + Number(item.leads || 0), 0), sales: as.length, revenue, roas: accountSpend > 0 ? revenue / accountSpend : 0 }; }), [accounts, insights, sales]);

  const monthlyHistory = useMemo(() => eachMonthOfInterval({ start: twelveMonthsAgo, end: new Date() }).map((month) => { const key = format(month, "yyyy-MM"); const revenue = aggregateSales(historicalSales.filter((sale) => (!sale.ad_account_id || unitAccountIds.has(sale.ad_account_id)) && String(sale.sale_date).startsWith(key))).totalNet + historicalEntries.filter((item) => item.entry_type === "revenue" && item.competence_date.startsWith(key) && item.status !== "canceled").reduce((sum, item) => sum + Number(item.amount), 0); const mediaOriginal = historicalInsights.filter((item) => unitAccountIds.has(item.ad_account_id) && String(item.date).startsWith(key)).reduce((sum, item) => sum + Number(item.spend || 0), 0); const media = mediaOriginal * (includeMetaTax ? 1 + metaTaxRate : 1); const operational = historicalEntries.filter((item) => item.entry_type === "expense" && item.competence_date.startsWith(key) && item.status !== "canceled").reduce((sum, item) => sum + Number(item.amount), 0); return { key, label: format(month, "MM/yy"), revenue, media, operational, expense: media + operational, result: revenue - media - operational }; }), [historicalEntries, historicalInsights, historicalSales, includeMetaTax, twelveMonthsAgo, unitAccountIds]);
  const avgRevenue = monthlyHistory.reduce((sum, month) => sum + month.revenue, 0) / Math.max(monthlyHistory.length, 1);
  const avgExpense = monthlyHistory.reduce((sum, month) => sum + month.expense, 0) / Math.max(monthlyHistory.length, 1);
  const forecast = useMemo(() => {
    const recent = monthlyHistory.slice(-6);
    const revenueSlope = trendSlope(recent.map((item) => item.revenue));
    const expenseSlope = trendSlope(recent.map((item) => item.expense));
    return Array.from({ length: 12 }, (_, index) => {
      const revenue = Math.max(0, avgRevenue * 0.6 + (recent.at(-1)?.revenue ?? avgRevenue) * 0.4 + revenueSlope * (index + 1));
      const expense = Math.max(0, avgExpense * 0.6 + (recent.at(-1)?.expense ?? avgExpense) * 0.4 + expenseSlope * (index + 1));
      return { label: format(addMonths(startOfMonth(new Date()), index + 1), "MM/yy"), revenue, expense, result: revenue - expense };
    });
  }, [avgExpense, avgRevenue, monthlyHistory]);
  const cash12m = monthlyHistory.reduce((sum, item) => sum + item.result, 0);
  const connectedBalance = financialAccounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const horizons = [
    { label: "30 dias", months: 1 }, { label: "60 dias", months: 2 }, { label: "90 dias", months: 3 }, { label: "Semestre", months: 6 }, { label: "12 meses", months: 12 },
  ].map(({ label, months }) => { const baseRevenue = forecast.slice(0, months).reduce((sum, item) => sum + item.revenue, 0); const baseExpense = forecast.slice(0, months).reduce((sum, item) => sum + item.expense, 0); return { label, base: baseRevenue - baseExpense, revenue: baseRevenue, expense: baseExpense, optimistic: baseRevenue * 1.10 - baseExpense * 0.97, pessimistic: baseRevenue * 0.90 - baseExpense * 1.08 }; });
  const chartForecast = [...monthlyHistory.map((item) => ({ ...item, realRevenue: item.revenue, realExpense: item.expense, forecastRevenue: null, forecastExpense: null })), ...forecast.map((item) => ({ ...item, realRevenue: null, realExpense: null, forecastRevenue: item.revenue, forecastExpense: item.expense }))];
  const grossRevenue = aggregateSales(visibleSales).totalGross + otherRevenue;
  const classifyExpense = (keywords: string[]) => entries.filter((item) => item.entry_type === "expense" && item.status !== "canceled" && keywords.some((keyword) => `${item.financial_categories?.name ?? ""} ${item.description}`.toLowerCase().includes(keyword))).reduce((sum, item) => sum + Number(item.amount), 0);
  const otherTaxes = aggregateSales(visibleSales).totalTax + classifyExpense(["imposto", "taxa", "tribut"]);
  const payroll = classifyExpense(["folha", "equipe", "salário", "salario", "freela", "prestador"]);
  const software = classifyExpense(["software", "saas", "assinatura", "ferramenta"]);
  const materials = classifyExpense(["material", "insumo", "equipamento"]);
  const categorized = Math.min(expenses, otherTaxes - aggregateSales(visibleSales).totalTax + payroll + software + materials);
  const otherExpenses = Math.max(0, expenses - categorized);
  const dreResult = grossRevenue - spend - (includeMetaTax ? metaTax : 0) - otherTaxes - payroll - software - materials - otherExpenses;
  const dreMargin = grossRevenue > 0 ? dreResult / grossRevenue : 0;
  const weeklyInvestment = useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of historicalInsights.filter((row) => unitAccountIds.has(row.ad_account_id))) {
      const day = new Date(`${item.date}T12:00:00`);
      const key = format(startOfWeek(day, { weekStartsOn: 1 }), "dd/MM");
      groups.set(key, (groups.get(key) ?? 0) + Number(item.spend || 0) * (includeMetaTax ? 1 + metaTaxRate : 1));
    }
    return Array.from(groups, ([label, investment]) => ({ label, investment })).slice(-16);
  }, [historicalInsights, includeMetaTax, unitAccountIds]);

  function exportCsv() { const header = ["Conta", "ID Meta", "Investimento", "Leads", "Vendas", "Faturamento líquido", "ROAS"]; const data = rows.map((row) => [row.account.name, row.account.account_id, row.spend, row.leads, row.sales, row.revenue, row.roas]); downloadCsv(`growdash-financeiro-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.csv`, [header, ...data]); }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="Gestão" title="Financeiro" description={`DRE, caixa, previsões e mídia da unidade ${segment === "saas" ? "SaaS" : "Infoproduto"}, com dados reais e filtros globais.`} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Exportar</Button><Button onClick={() => setEntryOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo lançamento</Button></div>} />

      <section aria-label="Filtros financeiros" className="mb-4 rounded-xl border border-border bg-card p-3 shadow-sm">
        <DateFilterBar
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          startDate={startDate}
          endDate={endDate}
          adAccounts={unitAccounts}
          selectedAccount={adAccountId}
          onAccountChange={setAdAccountId}
        />
      </section>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"><span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">Unidade ativa: {segment === "saas" ? "SaaS" : "Infoproduto"}</span><div className="flex items-center gap-3"><div className="text-right"><b className="block text-xs">Incluir imposto Meta</b><span className="text-[10px] text-muted-foreground">Simulação de 12,15%; o dado bruto permanece intacto.</span></div><Switch checked={includeMetaTax} onCheckedChange={setIncludeMetaTax} /></div></div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/70 p-1"><TabsTrigger value="dre">DRE</TabsTrigger><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="forecast">Previsão</TabsTrigger><TabsTrigger value="accounts">Por conta</TabsTrigger><TabsTrigger value="traffic">Investimento em tráfego</TabsTrigger><TabsTrigger value="entries">Lançamentos</TabsTrigger><TabsTrigger value="cards">Cartões</TabsTrigger><TabsTrigger value="companies">Empresas</TabsTrigger></TabsList>

        <TabsContent value="dre" className="grid gap-4 xl:grid-cols-2"><section className="gd-panel overflow-hidden"><PanelTitle icon={<ReceiptText />} title={`DRE — Demonstrativo ${segment === "saas" ? "SaaS" : "Infoproduto"}`} subtitle="Regime de competência e unidade isolada pelos filtros globais." /><DreRow label="(+) Receita bruta" value={grossRevenue} /><DreRow label="(−) Tráfego pago" value={-spend} /><DreRow label="(−) Imposto Meta (12,15%)" value={includeMetaTax ? -metaTax : 0} /><DreRow label="(−) Outros impostos" value={-otherTaxes} /><DreRow label="(−) Folha / Equipe" value={-payroll} /><DreRow label="(−) Software / SaaS" value={-software} /><DreRow label="(−) Materiais" value={-materials} /><DreRow label="(−) Outras despesas" value={-otherExpenses} /><DreRow label="= Resultado" value={dreResult} strong highlight /><DreRow label="Margem líquida" value={dreMargin} percentage /></section><section className="gd-panel overflow-hidden"><PanelTitle icon={<Building2 />} title="Resultado por empresa / conta" subtitle="Receita atribuída menos mídia e imposto por conta conectada." /><div className="divide-y divide-border">{rows.map((row) => { const cost = row.spend * (includeMetaTax ? 1 + metaTaxRate : 1); const profit = row.revenue - cost; return <div key={row.account.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><b>{row.account.name}</b><p className="mt-1 text-[10px] text-muted-foreground">Meta Ads · {segment === "saas" ? "SaaS" : "Infoproduto"}</p></div><b className={profit < 0 ? "text-rose-500" : "text-emerald-500"}>{brl.format(profit)}</b></div><div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><span>Receita<b className="mt-1 block text-sm">{brl.format(row.revenue)}</b></span><span>Tráfego<b className="mt-1 block text-sm">{brl.format(cost)}</b></span><span>ROAS<b className="mt-1 block text-sm">{row.roas.toFixed(2)}x</b></span></div></div>; })}{!rows.length && <div className="grid min-h-72 place-items-center p-8 text-center"><div><ReceiptText className="mx-auto h-9 w-9 text-muted-foreground/50" /><p className="mt-3 text-xs text-muted-foreground">Sem dados no período para esta unidade.</p></div></div>}</div></section></TabsContent>

        <TabsContent value="dashboard" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><MetricCard label="Receita total" value={isLoading ? "Carregando…" : brl.format(totalRevenue)} change="vendas + receitas" emphasis /><MetricCard label="Despesas totais" value={isLoading ? "Carregando…" : brl.format(adjustedSpend + expenses)} change="mídia + operação" /><MetricCard label="Lucro" value={isLoading ? "Carregando…" : brl.format(result)} change={result < 0 ? "revisar" : "positivo"} /><MetricCard label="Margem" value={isLoading ? "Carregando…" : pct.format(margin)} change="lucro / receita" /><MetricCard label="Cartões e bancos" value={brl.format(connectedBalance)} change={`${financialAccounts.length} conectado(s)`} /><MetricCard label="Tráfego pago" value={isLoading ? "Carregando…" : brl.format(adjustedSpend)} change={includeMetaTax ? "com taxa" : "dado Meta"} /></div><ChartPanel title="Receita, despesas e resultado — últimos 12 meses"><ResponsiveContainer width="100%" height={300}><AreaChart data={monthlyHistory}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.32}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={compactCurrency} /><Tooltip formatter={currencyTooltip} /><Legend /><Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--primary))" fill="url(#revenueFill)" /><Line type="monotone" dataKey="expense" name="Despesa" stroke="#fb7185" strokeWidth={2} /><Line type="monotone" dataKey="result" name="Resultado" stroke="#34d399" strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartPanel><MonthlyTable rows={monthlyHistory} /></TabsContent>

        <TabsContent value="forecast" className="space-y-4"><div className="rounded-2xl border border-primary/25 bg-primary/5 p-5"><div className="flex gap-3"><Sparkles className="h-5 w-5 text-primary" /><div><b>Previsão por média móvel e tendência dos últimos 12 meses</b><p className="mt-1 text-xs text-muted-foreground">Cenário orientativo, não promessa. Base pondera média histórica, últimos seis meses e tendência; otimista usa +10% receita/−3% despesa e pessimista −10%/+8%.</p></div></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Caixa gerado (12m)" value={brl.format(cash12m)} change="receita − despesa" emphasis /><MetricCard label="Receita média/mês" value={brl.format(avgRevenue)} change="12 meses" /><MetricCard label="Despesa média/mês" value={brl.format(avgExpense)} change="12 meses" /><MetricCard label="Runway estimado" value={avgExpense > avgRevenue && connectedBalance > 0 ? `${Math.floor(connectedBalance / (avgExpense - avgRevenue))} meses` : "Operação sustentável"} change="com saldo conectado" /></div><section className="gd-panel p-5"><h2 className="font-black">Projeção de resultado por horizonte</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{horizons.map((item) => <div key={item.label} className="rounded-xl border border-border p-4"><b className="text-xs">{item.label}</b><p className={`mt-2 text-xl font-black ${item.base < 0 ? "text-rose-500" : "text-emerald-500"}`}>{brl.format(item.base)}</p><div className="mt-3 space-y-1 text-[10px] text-muted-foreground"><p>Receita <b className="float-right text-foreground">{brl.format(item.revenue)}</b></p><p>Despesa <b className="float-right text-foreground">{brl.format(item.expense)}</b></p><p>Otimista <b className="float-right text-emerald-500">{brl.format(item.optimistic)}</b></p><p>Pessimista <b className="float-right text-rose-500">{brl.format(item.pessimistic)}</b></p></div></div>)}</div></section><div className="grid gap-4 xl:grid-cols-2"><ChartPanel title="Receita e despesa — real x previsto"><ResponsiveContainer width="100%" height={290}><AreaChart data={chartForecast}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} tickFormatter={compactCurrency} /><Tooltip formatter={currencyTooltip} /><Legend /><Line dataKey="realRevenue" name="Receita real" stroke="#34d399" dot={false} /><Line dataKey="forecastRevenue" name="Receita prevista" stroke="#34d399" strokeDasharray="5 4" dot={false} /><Line dataKey="realExpense" name="Despesa real" stroke="#fb7185" dot={false} /><Line dataKey="forecastExpense" name="Despesa prevista" stroke="#fb7185" strokeDasharray="5 4" dot={false} /></AreaChart></ResponsiveContainer></ChartPanel><ChartPanel title="Resultado mensal projetado"><ResponsiveContainer width="100%" height={290}><BarChart data={forecast}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} tickFormatter={compactCurrency} /><Tooltip formatter={currencyTooltip} /><Bar dataKey="result" name="Resultado" fill="hsl(var(--primary))" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></ChartPanel></div></TabsContent>

        <TabsContent value="accounts" className="space-y-4"><AccountTable rows={rows} loading={isLoading} /><section className="gd-panel p-5"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-primary" /><div><h2 className="font-black">Saldo e autonomia</h2><p className="text-xs text-muted-foreground">Saldo consolidado {brl.format(balance)}; valores informados por conta.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{accounts.map((account) => { const daily = Number(account.daily_budget || 0); const remaining = Number(account.remaining_balance || 0); return <div key={account.id} className="rounded-xl border border-border p-4"><p className="truncate text-[10px] font-black">{account.name}</p><p className="mt-3 text-xl font-black">{brl.format(remaining)}</p><p className="text-[10px] text-muted-foreground">{daily > 0 ? `${Math.floor(remaining / daily)} dia(s) com orçamento atual` : "Orçamento diário não informado"}</p></div>; })}</div></section></TabsContent>

        <TabsContent value="traffic" className="space-y-4"><TrafficInvestmentPlanner workspaceId={workspace?.id} businessUnitId={businessUnitId} accounts={accounts} /><ChartPanel title="Gasto real semanal sincronizado"><ResponsiveContainer width="100%" height={280}><BarChart data={weeklyInvestment}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={compactCurrency} /><Tooltip formatter={currencyTooltip} /><Bar dataKey="investment" name="Gasto real" fill="hsl(var(--primary))" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></ChartPanel><section className="gd-panel overflow-hidden"><PanelTitle icon={<TrendingUp />} title="Gasto real mensal" subtitle={`${includeMetaTax ? "Inclui simulação de imposto Meta de 12,15%" : "Valores originais sincronizados da Meta"}.`} /><TrafficMonthlyTable rows={monthlyHistory} /></section></TabsContent>

        <TabsContent value="entries"><section className="gd-panel overflow-hidden"><PanelTitle icon={<Landmark />} title="Lançamentos manuais" subtitle="Receitas e despesas sem duplicar vendas ou mídia importada." /><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Data", "Descrição", "Categoria", "Tipo", "Status", "Recorrência", "Valor"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{entries.map((item) => <tr key={item.id}><td className="px-4 py-3">{format(new Date(`${item.competence_date}T12:00:00`), "dd/MM/yyyy")}</td><td className="px-4 py-3 font-bold">{item.description}</td><td className="px-4 py-3">{item.financial_categories?.name ?? "Sem categoria"}</td><td className="px-4 py-3">{item.entry_type === "revenue" ? "Receita" : "Despesa"}</td><td className="px-4 py-3">{statusLabel(item.status)}</td><td className="px-4 py-3">{item.recurrence === "monthly" ? "Mensal" : item.recurrence === "yearly" ? "Anual" : "Único"}</td><td className={`px-4 py-3 font-black ${item.entry_type === "revenue" ? "text-emerald-500" : "text-rose-500"}`}>{item.entry_type === "expense" ? "-" : "+"}{brl.format(Number(item.amount))}</td></tr>)}</tbody></table></div><div className="divide-y divide-border md:hidden">{entries.map((item) => <div key={item.id} className="p-4"><div className="flex justify-between gap-3"><div><b className="text-sm">{item.description}</b><p className="text-[10px] text-muted-foreground">{format(new Date(`${item.competence_date}T12:00:00`), "dd/MM/yyyy")} · {statusLabel(item.status)}</p></div><b className={item.entry_type === "revenue" ? "text-emerald-500" : "text-rose-500"}>{item.entry_type === "expense" ? "-" : "+"}{brl.format(Number(item.amount))}</b></div></div>)}</div>{!entries.length && !loadingEntries && <div className="p-10 text-center text-xs text-muted-foreground">Nenhum lançamento neste período. Use “Novo lançamento”.</div>}</section></TabsContent>

        <TabsContent value="cards"><section className="gd-panel overflow-hidden"><PanelTitle icon={<CreditCard />} title="Cartões e contas — Open Finance" subtitle="Consentimento bancário, extratos e conciliação; nenhuma senha bancária é armazenada." /><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{financialAccounts.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-3"><b>{item.name}</b><span className={item.status === "connected" ? "text-emerald-500" : "text-amber-500"}>{item.status === "connected" ? "Conectada" : "Configuração"}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.institution_name ?? "Instituição"}{item.last_four ? ` •••• ${item.last_four}` : ""}</p><p className="mt-5 text-2xl font-black">{item.balance == null ? "Saldo indisponível" : brl.format(Number(item.balance))}</p><p className="text-[10px] text-muted-foreground">{item.last_synced_at ? `Atualizado ${new Date(item.last_synced_at).toLocaleString("pt-BR")}` : "Aguardando primeira sincronização"}</p></div>)}{!financialAccounts.length && <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center"><CreditCard className="mx-auto h-7 w-7 text-primary" /><b className="mt-3 block">Nenhuma instituição conectada</b><p className="mt-1 text-xs text-muted-foreground">A migration prepara o modelo; a conexão real exige um provedor Open Finance homologado.</p><Button className="mt-4" variant="outline" disabled>Conectar via Open Finance</Button></div>}</div></section></TabsContent>

        <TabsContent value="companies"><section className="gd-panel overflow-hidden"><PanelTitle icon={<Building2 />} title="Empresas, marcas e experts" subtitle="A mesma origem organizacional usada por Marcas e pelos filtros financeiros." /><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{companies.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><b>{item.name}</b><p className="mt-1 text-xs text-muted-foreground">{item.legal_name || "Razão social não informada"}</p><p className="mt-4 text-xs">Expert/responsável <b className="float-right">{item.expert_name || "Não vinculado"}</b></p><p className="mt-2 text-xs">Status <b className="float-right text-emerald-500">{item.status === "active" ? "Ativa" : item.status}</b></p></div>)}{!companies.length && accounts.map((account) => <div key={account.id} className="rounded-xl border border-dashed border-border p-4"><b>{account.name}</b><p className="mt-1 text-xs text-muted-foreground">Conta Meta ainda não vinculada a uma empresa.</p><p className="mt-4 text-[10px] text-amber-500">Mapeamento pendente no módulo Marcas</p></div>)}{!companies.length && !accounts.length && <div className="col-span-full p-8 text-center text-xs text-muted-foreground">Cadastre uma marca/empresa e vincule suas contas de anúncio.</div>}</div></section></TabsContent>
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
function TrafficMonthlyTable({ rows }: { rows: Array<{ label: string; media: number; operational: number }> }) { return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr><th className="px-4 py-3">Mês</th><th className="px-4 py-3">Tráfego</th><th className="px-4 py-3">Outras despesas</th><th className="px-4 py-3">Saída total</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.label}><td className="px-4 py-3 font-black">{row.label}</td><td className="px-4 py-3 text-primary">{brl.format(row.media)}</td><td className="px-4 py-3">{brl.format(row.operational)}</td><td className="px-4 py-3 font-black text-rose-500">{brl.format(row.media + row.operational)}</td></tr>)}</tbody></table></div>; }
function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="gd-panel p-4 sm:p-5"><h2 className="mb-5 font-black">{title}</h2><div className="min-w-0">{children}</div></section>; }
function trendSlope(values: number[]) { if (values.length < 2) return 0; const n = values.length; const xMean = (n - 1) / 2; const yMean = values.reduce((sum, value) => sum + value, 0) / n; const numerator = values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0); const denominator = values.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0); return denominator ? numerator / denominator : 0; }
function compactCurrency(value: number) { return new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 }).format(Number(value)); }
function currencyTooltip(value: number | string) { return brl.format(Number(value)); }
function statusLabel(status: string) { return status === "paid" ? "Pago/recebido" : status === "overdue" ? "Vencido" : status === "canceled" ? "Cancelado" : "Pendente"; }
function downloadCsv(filename: string, lines: unknown[][]) { const csv = lines.map((line) => line.map(csvCell).join(";")).join("\n"); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
