import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, Check, Copy, ExternalLink, ImageUp, Lightbulb, Link2, Presentation, Sparkles, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import { aggregateSales, type Sale } from "@/hooks/useSales";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import type { InsightRow } from "@/hooks/useInsights";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useSales } from "@/hooks/useSales";
import { buildTwoMonthAnalysis, type TwoMonthAnalysis } from "@/lib/paidTrafficReport";

export type MetricId = "spend" | "leads" | "conversations" | "cpl" | "impressions" | "reach" | "frequency" | "clicks" | "cpc" | "ctr" | "cpm" | "conversionRate" | "rd" | "sales" | "revenue" | "cac" | "roas" | "profit" | "coverage";
export type ReportTotals = Record<MetricId, number>;
export type ReportSnapshot = {
  title: string;
  accountName: string;
  branding?: { name: string; signature: string };
  dateFrom: string;
  dateTo: string;
  metrics: MetricId[];
  banner?: string;
  totals: ReportTotals;
  daily: Array<{ date: string; leads: number; spend: number }>;
  weekly: Array<{ week: string; leads: number; spend: number; days: number }>;
  analysis?: TwoMonthAnalysis;
};

const METRICS: Array<{ id: MetricId; label: string; description: string }> = [
  { id: "spend", label: "Investimento", description: "Valor gasto pela Meta no período selecionado." },
  { id: "leads", label: "Leads Meta", description: "Forms, site e conversas iniciadas atribuídos pela Meta Ads." },
  { id: "conversations", label: "Conversas iniciadas", description: "Evento onsite_conversion.messaging_conversation_started_7d da Meta Ads." },
  { id: "cpl", label: "CPL", description: "Investimento dividido pelos leads Meta." },
  { id: "impressions", label: "Impressões", description: "Total de vezes que os anúncios foram exibidos." },
  { id: "reach", label: "Alcance", description: "Quantidade estimada de pessoas únicas alcançadas." },
  { id: "frequency", label: "Frequência", description: "Média de impressões por pessoa alcançada." },
  { id: "clicks", label: "Cliques", description: "Cliques registrados nos anúncios do período." },
  { id: "cpc", label: "CPC", description: "Investimento dividido pelo total de cliques." },
  { id: "ctr", label: "CTR", description: "Percentual de cliques sobre as impressões." },
  { id: "cpm", label: "CPM", description: "Custo médio para mil impressões." },
  { id: "conversionRate", label: "Taxa de conversão", description: "Percentual de leads gerados sobre os cliques." },
  { id: "rd", label: "Negócios RD", description: "Negociações criadas no RD Station no mesmo período e conta." },
  { id: "sales", label: "Vendas", description: "Quantidade de vendas confirmadas e atribuídas." },
  { id: "revenue", label: "Receita", description: "Receita líquida confirmada no período." },
  { id: "cac", label: "CAC", description: "Investimento dividido pelas vendas confirmadas." },
  { id: "roas", label: "ROAS", description: "Receita atribuída dividida pelo investimento." },
  { id: "profit", label: "Resultado", description: "Receita menos investimento em mídia." },
  { id: "coverage", label: "Cobertura RD/Meta", description: "Relação percentual entre negócios RD e leads Meta." },
];
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function LeadReportStudio({ accountId, accountName, accounts, onAccountChange, startDate, endDate, insights, deals, sales }: { accountId: string; accountName?: string; accounts: Array<{ id: string; name: string }>; onAccountChange: (id: string) => void; startDate: Date; endDate: Date; insights: InsightRow[]; deals: RDDealLite[]; sales: Sale[] }) {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { preset, setPreset, customRange, setCustomRange } = useGlobalFilters();
  const [selected, setSelected] = useState<MetricId[]>(["spend", "leads", "conversations", "cpl", "impressions", "clicks", "rd", "sales", "revenue"]);
  const [presenting, setPresenting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [banner, setBanner] = useState(() => window.localStorage.getItem(`growdash:report-banner:${accountId}`) || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBanner(window.localStorage.getItem(`growdash:report-banner:${accountId}`) || "");
  }, [accountId]);

  const reportFrom = format(startDate, "yyyy-MM-dd");
  const reportTo = format(endDate, "yyyy-MM-dd");
  const filteredInsights = useMemo(() => insights.filter((row) => !row.date || (row.date >= reportFrom && row.date <= reportTo)), [insights, reportFrom, reportTo]);
  const filteredDeals = useMemo(() => deals.filter((row) => !row.lead_created_at || (row.lead_created_at.slice(0, 10) >= reportFrom && row.lead_created_at.slice(0, 10) <= reportTo)), [deals, reportFrom, reportTo]);
  const filteredSales = useMemo(() => sales.filter((row) => row.sale_date >= reportFrom && row.sale_date <= reportTo), [sales, reportFrom, reportTo]);
  const adIds = useMemo(() => Array.from(new Set(filteredInsights.map((row) => row.ad_id).filter(Boolean))), [filteredInsights]);
  const adAccountByAdId = useMemo(() => Object.fromEntries(filteredInsights.map((row) => [row.ad_id, row.ad_account_id])), [filteredInsights]);
  const { data: actionData } = useActionTotalsByAds(adIds, startDate, endDate, adAccountByAdId);
  const conversations = actionData?.totals?.["onsite_conversion.messaging_conversation_started_7d"] || 0;
  const totals = useMemo(() => calculate(filteredInsights, filteredDeals, filteredSales, conversations), [conversations, filteredDeals, filteredInsights, filteredSales]);
  const daily = useMemo(() => dailyRows(filteredInsights), [filteredInsights]);
  const weekly = useMemo(() => weeklyRows(daily), [daily]);
  const analysisFromDate = useMemo(() => startOfMonth(subMonths(endDate, 1)), [endDate]);
  const analysisEnabled = accountId !== "all";
  const { data: analysisInsights = [], isLoading: loadingAnalysisInsights } = useInsights({ adAccountId: analysisEnabled ? accountId : undefined, startDate: analysisFromDate, endDate, enabled: analysisEnabled });
  const { data: analysisDeals = [], isLoading: loadingAnalysisDeals } = useRDDealsForPeriod({ startDate: analysisFromDate, endDate, adAccountId: analysisEnabled ? accountId : undefined, enabled: analysisEnabled });
  const { data: analysisSales = [], isLoading: loadingAnalysisSales } = useSales({ startDate: analysisFromDate, endDate, adAccountId: analysisEnabled ? accountId : undefined, enabled: analysisEnabled });
  const analysisAdIds = useMemo(() => Array.from(new Set(analysisInsights.map((row) => row.ad_id).filter(Boolean))), [analysisInsights]);
  const analysisAdAccountByAdId = useMemo(() => Object.fromEntries(analysisInsights.map((row) => [row.ad_id, row.ad_account_id])), [analysisInsights]);
  const { data: analysisActionData, isLoading: loadingAnalysisActions } = useActionTotalsByAds(analysisAdIds, analysisFromDate, endDate, analysisAdAccountByAdId);
  const analysisConversationsByDate = useMemo(() => {
    const scoped = analysisActionData?.dailyByAccount?.[accountId];
    if (!scoped) return {};
    return Object.fromEntries(Object.entries(scoped).map(([date, actions]) => [date, Number(actions["onsite_conversion.messaging_conversation_started_7d"] || 0)]));
  }, [accountId, analysisActionData?.dailyByAccount]);
  const analysis = useMemo(() => analysisEnabled ? buildTwoMonthAnalysis({ analysisFrom: analysisFromDate, analysisTo: endDate, insights: analysisInsights, deals: analysisDeals, sales: analysisSales, conversationsByDate: analysisConversationsByDate }) : undefined, [analysisConversationsByDate, analysisDeals, analysisEnabled, analysisFromDate, analysisInsights, analysisSales, endDate]);
  const analysisLoading = analysisEnabled && (loadingAnalysisInsights || loadingAnalysisDeals || loadingAnalysisSales || (analysisAdIds.length > 0 && loadingAnalysisActions));
  const snapshot = useMemo<ReportSnapshot>(() => ({ title: `Relatório de performance — ${accountName || "Conta selecionada"}`, accountName: accountName || "Conta selecionada", branding: { name: workspace?.name || "Growdash", signature: `${workspace?.name || "Growdash"} · Operação monitorada pela Torre de Controle` }, dateFrom: reportFrom, dateTo: reportTo, metrics: selected, banner, totals, daily, weekly, analysis }), [accountName, analysis, banner, daily, reportFrom, reportTo, selected, totals, weekly, workspace?.name]);

  const history = useQuery({
    queryKey: ["lead-report-pages", workspace?.id, accountId],
    enabled: !!workspace?.id && !workspace.id.startsWith("legacy-"),
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_report_pages").select("id, share_token, title, date_from, date_to, created_at").eq("workspace_id", workspace!.id).eq("account_id", accountId).order("created_at", { ascending: false }).limit(12);
      if (error) throw error;
      return data || [];
    },
  });

  function toggle(id: MetricId) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function upload(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) { toast({ title: "Imagem muito grande", description: "Use um banner de até 2 MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result || ""); setBanner(value); window.localStorage.setItem(`growdash:report-banner:${accountId}`, value); };
    reader.readAsDataURL(file);
  }
  async function generate() {
    if (accountId === "all") { toast({ title: "Selecione uma conta", description: "O relatório compartilhável precisa manter uma origem única para não misturar métricas." }); return; }
    if (analysisLoading) { toast({ title: "Análise de dois meses carregando", description: "Aguarde a conclusão da consulta Meta, RD e vendas para publicar o relatório completo." }); return; }
    setPresenting(true);
    if (!workspace?.id || workspace.id.startsWith("legacy-") || !user) return;
    setSaving(true);
    const { data, error } = await supabase.from("lead_report_pages").insert({ workspace_id: workspace.id, user_id: user.id, account_id: accountId, account_name: accountName || "Conta selecionada", title: snapshot.title, date_from: reportFrom, date_to: reportTo, metrics: selected, payload: snapshot }).select("share_token").single();
    setSaving(false);
    if (error) { toast({ title: "Página aberta sem link público", description: error.message, variant: "destructive" }); return; }
    const url = `${window.location.origin}/relatorios/${data.share_token}`;
    setShareUrl(url);
    queryClient.invalidateQueries({ queryKey: ["lead-report-pages", workspace.id, accountId] });
    toast({ title: "Relatório publicado", description: "O link compartilhável foi criado e salvo no histórico." });
  }
  async function copy(value = shareUrl) { if (!value) return; await navigator.clipboard.writeText(value); toast({ title: "Link copiado" }); }
  async function removeReport(id: string) {
    if (!window.confirm("Excluir este relatório compartilhável? O link deixará de funcionar.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("lead_report_pages").delete().eq("id", id);
    setDeletingId(null);
    if (error) { toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" }); return; }
    await queryClient.invalidateQueries({ queryKey: ["lead-report-pages", workspace?.id, accountId] });
    toast({ title: "Relatório excluído" });
  }

  return <>
    <section className="gd-panel overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-border p-4 2xl:flex-row 2xl:items-center">
        <div><h2 className="flex items-center gap-2 font-black"><Presentation className="h-4 w-4 text-primary" />Estúdio do relatório de leads</h2><p className="mt-1 text-[10px] text-muted-foreground">Escolha período e métricas, gere uma página premium e compartilhe um link independente.</p></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,320px)_minmax(280px,auto)_auto_auto] 2xl:ml-auto">
          <Select value={accountId} onValueChange={onAccountChange}><SelectTrigger className="h-10 min-w-0 bg-background"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger><SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <MetaDateRangePicker preset={preset} onPresetChange={setPreset} customRange={customRange} onCustomRangeChange={setCustomRange} startDate={startDate} endDate={endDate} applyPresetOnClick className="h-10 min-w-0" />
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          <Button variant="outline" className="h-10" onClick={() => inputRef.current?.click()}><ImageUp className="mr-2 h-4 w-4" />Banner</Button>
          <Button className="gold-action h-10" disabled={saving || analysisLoading || !selected.length || accountId === "all"} onClick={generate}><Sparkles className="mr-2 h-4 w-4" />{saving ? "Publicando…" : analysisLoading ? "Analisando 2 meses…" : "Gerar página"}</Button>
        </div>
      </header>
      <div className="p-4">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">Métricas do relatório</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground"><BarChart3 className="h-4 w-4 text-primary" />{analysisLoading ? "Consolidando os dois últimos meses com Meta, conversas, RD e vendas…" : analysis ? `Análise executiva pronta: ${format(new Date(`${analysis.analysisFrom}T12:00:00`), "dd/MM/yyyy")} a ${format(new Date(`${analysis.analysisTo}T12:00:00`), "dd/MM/yyyy")}.` : "Selecione uma conta para comparar os dois últimos meses."}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{METRICS.map((metric) => <button key={metric.id} type="button" title={metric.description} onClick={() => toggle(metric.id)} className={cn("flex min-w-0 items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold transition", selected.includes(metric.id) ? "border-primary/55 bg-primary/10 text-foreground shadow-[0_0_22px_-15px_hsl(var(--primary))]" : "border-border text-muted-foreground hover:bg-muted/35")}><span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded border", selected.includes(metric.id) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{selected.includes(metric.id) && <Check className="h-3 w-3" />}</span><span className="truncate">{metric.label}</span></button>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{selected.map((id) => <PreviewMetric key={id} id={id} totals={totals} />)}</div>
        {history.data?.length ? <div className="mt-5 border-t border-border pt-4"><h3 className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">Histórico compartilhável</h3><div className="flex gap-2 overflow-x-auto pb-1">{history.data.map((item) => { const url = `${window.location.origin}/relatorios/${item.share_token}`; return <div key={item.id} className="min-w-[230px] rounded-xl border border-border bg-background/45 p-3"><b className="block truncate text-xs">{item.title}</b><small className="mt-1 block text-muted-foreground">{format(new Date(`${item.date_from}T12:00:00`), "dd/MM")}–{format(new Date(`${item.date_to}T12:00:00`), "dd/MM/yyyy")}</small><div className="mt-3 flex gap-1"><Button size="sm" variant="outline" className="h-7" title="Copiar link" onClick={() => copy(url)}><Copy className="h-3 w-3" /></Button><Button size="sm" variant="outline" className="h-7" title="Abrir relatório" onClick={() => window.open(url, "_blank")}><ExternalLink className="h-3 w-3" /></Button><Button size="sm" variant="outline" className="h-7 text-destructive hover:text-destructive" title="Excluir relatório" disabled={deletingId === item.id} onClick={() => removeReport(item.id)}><Trash2 className="h-3 w-3" /></Button></div></div>; })}</div></div> : null}
      </div>
    </section>
    {presenting && <ReportPresentation report={snapshot} onClose={() => setPresenting(false)} shareUrl={shareUrl} onCopy={() => copy()} />}
  </>;
}

export function ReportPresentation({ report, onClose, shareUrl, onCopy }: { report: ReportSnapshot; onClose?: () => void; shareUrl?: string; onCopy?: () => void }) {
  const { totals, daily, weekly, metrics } = report;
  const analysis = report.analysis;
  const brandName = report.branding?.name || "Growdash";
  return <div className={cn(onClose && "fixed inset-0 z-[200]", "min-h-screen overflow-y-auto bg-[#050505] text-white")}>
    <div className="relative min-h-[380px] overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#181105] via-black to-[#2b1f08]">
      {report.banner && <img src={report.banner} alt="Banner da marca" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/45 to-black/15" />
      <div className="absolute left-4 top-4 z-10 flex gap-2">{onClose && <Button variant="outline" className="border-white/20 bg-black/45 text-white hover:bg-black/65" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>}{shareUrl && onCopy && <Button variant="outline" className="border-white/20 bg-black/45 text-white hover:bg-black/65" onClick={onCopy}><Link2 className="mr-2 h-4 w-4" />Copiar link</Button>}</div>
      <div className="relative z-[1] mx-auto flex min-h-[380px] max-w-[1800px] items-end px-5 pb-12 sm:px-10"><div><span className="text-[10px] font-black uppercase tracking-[.3em] text-[#d8b65c]">{brandName} · Pouso confirmado</span><h1 className="mt-3 max-w-5xl text-3xl font-black sm:text-5xl">{report.accountName}</h1><p className="mt-3 text-sm text-white/65">Meta Ads × RD Station · {format(new Date(`${report.dateFrom}T12:00:00`), "dd/MM/yyyy")} a {format(new Date(`${report.dateTo}T12:00:00`), "dd/MM/yyyy")}</p></div></div>
    </div>
    <main className="mx-auto max-w-[1800px] space-y-8 px-5 py-10 sm:px-10">
      <section><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-black">Resumo executivo</h2><p className="mt-1 text-xs text-white/45">Métricas do intervalo publicado, com leads e conversas separadas no detalhamento.</p></div>{analysis && <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-300">Dados reais · 2 meses</span>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{metrics.map((id) => <ReportMetric key={id} id={id} totals={totals} />)}</div></section>
      {analysis ? <TwoMonthExecutive analysis={analysis} /> : <>
      <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="flex items-center gap-2 font-black"><BarChart3 className="h-4 w-4 text-[#d8b65c]" />Leads e investimento por dia</h2><div className="mt-6 flex min-h-[260px] items-end gap-2 overflow-x-auto border-b border-white/15 pb-1">{daily.length ? daily.map((row) => { const max = Math.max(1, ...daily.map((item) => item.leads)); return <div key={row.date} className="group flex min-w-10 flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-12 rounded-t bg-gradient-to-t from-[#73500f] via-[#b98a29] to-[#f0dfa4] transition group-hover:brightness-125" style={{ height: `${Math.max(4, row.leads / max * 220)}px` }} title={`${integer.format(row.leads)} leads · ${currency.format(row.spend)}`} /><span className="text-[8px] text-white/45">{format(new Date(`${row.date}T12:00:00`), "dd/MM")}</span></div>; }) : <div className="grid w-full place-items-center text-sm text-white/40">Sem dados diários no período</div>}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-black">Leitura automática</h2><div className="mt-5 space-y-3 text-xs leading-relaxed text-white/65"><p>• Foram registrados <b className="text-white">{integer.format(totals.leads)} leads</b> com CPL de <b className="text-white">{currency.format(totals.cpl)}</b>.</p><p>• O RD recebeu <b className="text-white">{integer.format(totals.rd)}</b> negócios e marcou <b className="text-white">{integer.format(totals.sales)}</b> venda(s).</p><p>• A cobertura RD/Meta é <b className="text-white">{totals.leads ? (totals.rd / totals.leads * 100).toFixed(1) : "0.0"}%</b>; diferenças pedem revisão de UTM, período e atribuição.</p><p>• ROAS atribuído: <b className="text-white">{totals.roas.toFixed(2)}x</b>.</p></div></div></section>
      <section><h2 className="mb-4 text-lg font-black">Consolidado semanal</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{weekly.length ? weekly.map((row) => <article key={row.week} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><span className="text-[9px] font-black uppercase tracking-[.16em] text-[#d8b65c]">Semana de {format(new Date(`${row.week}T12:00:00`), "dd/MM")}</span><div className="mt-4 grid grid-cols-2 gap-4 text-xs"><span><small className="block text-white/45">Leads</small><b className="mt-1 block text-lg">{integer.format(row.leads)}</b></span><span><small className="block text-white/45">Investimento</small><b className="mt-1 block text-lg">{currency.format(row.spend)}</b></span><span><small className="block text-white/45">CPL</small><b>{currency.format(row.leads ? row.spend / row.leads : 0)}</b></span><span><small className="block text-white/45">Dias</small><b>{integer.format(row.days)}</b></span></div></article>) : <div className="rounded-2xl border border-white/10 p-5 text-sm text-white/40">Sem consolidado semanal no período.</div>}</div></section>
      </>}
      <footer className="border-t border-white/10 py-6 text-center text-[10px] font-bold uppercase tracking-[.18em] text-white/40">{report.branding?.signature || "Growdash · Torre de Controle do Crescimento"}</footer>
    </main>
  </div>;
}

function TwoMonthExecutive({ analysis }: { analysis: TwoMonthAnalysis }) {
  const { currentMonth, previousMonth } = analysis;
  const maxWeeklyLeads = Math.max(1, ...analysis.weeklyComparison.map((row) => row.metrics.leads));
  const comparisonRows = analysis.metricComparisons.filter((item) =>
    ["spend", "leads", "conversations", "cpl", "ctr", "cpm", "rd", "sales", "revenue", "roas"].includes(item.id),
  );
  const funnel: Array<[string, number]> = [
    ["Impressões", currentMonth.metrics.impressions],
    ["Cliques", currentMonth.metrics.clicks],
    ["Leads + conversas", currentMonth.metrics.leads],
    ["Negócios RD", currentMonth.metrics.rd],
    ["Vendas", currentMonth.metrics.sales],
  ];

  return <>
    <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <article className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-black"><BarChart3 className="h-4 w-4 text-[#d8b65c]" />Mês atual × mês anterior</h2>
            <p className="mt-1 text-[11px] text-white/45">{currentMonth.isPartial ? `Mês atual parcial · ${currentMonth.daysWithData} dia(s) com dados` : "Comparação de meses completos"}</p>
          </div>
          <span className="text-[10px] text-white/45">{format(new Date(`${previousMonth.from}T12:00:00`), "dd/MM")}–{format(new Date(`${currentMonth.to}T12:00:00`), "dd/MM/yyyy")}</span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[.12em] text-white/40"><tr><th className="pb-3">Métrica</th><th className="pb-3 text-right">Atual</th><th className="pb-3 text-right">Anterior</th><th className="pb-3 text-right">Variação</th></tr></thead>
            <tbody>{comparisonRows.map((item) => <tr key={item.id} className="border-t border-white/10">
              <td className="py-3 font-bold">{item.label}</td>
              <td className="py-3 text-right">{formatAnalysisMetric(item.id, item.current)}</td>
              <td className="py-3 text-right text-white/55">{formatAnalysisMetric(item.id, item.previous)}</td>
              <td className={cn("py-3 text-right font-black", item.assessment === "positive" ? "text-emerald-300" : item.assessment === "negative" ? "text-rose-300" : "text-white/45")}>
                {item.variationPercent == null ? "Sem base" : <span className="inline-flex items-center justify-end gap-1">{item.assessment === "positive" ? <ArrowUpRight className="h-3.5 w-3.5" /> : item.assessment === "negative" ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}{item.variationPercent > 0 ? "+" : ""}{item.variationPercent}%</span>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
        <h2 className="font-black">Funil executivo do mês</h2>
        <p className="mt-1 text-[11px] text-white/45">Do alcance da mídia até a receita confirmada.</p>
        <div className="mt-5 space-y-3">{funnel.map(([label, value]) => <div key={label}>
          <div className="flex items-center justify-between gap-2 text-xs"><span className="text-white/60">{label}</span><b>{integer.format(value)}</b></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#8c6418] via-[#d8b65c] to-[#f0dfa4]" style={{ width: `${Math.max(4, value / Math.max(1, funnel[0][1]) * 100)}%` }} /></div>
        </div>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
          <span><small className="block text-white/45">CPL atual</small><b className="mt-1 block text-base">{currency.format(currentMonth.metrics.cpl)}</b></span>
          <span><small className="block text-white/45">ROAS atual</small><b className="mt-1 block text-base">{currentMonth.metrics.roas.toFixed(2)}x</b></span>
          <span><small className="block text-white/45">Cobertura RD</small><b className="mt-1 block text-base">{currentMonth.metrics.coverage.toFixed(1)}%</b></span>
          <span><small className="block text-white/45">Resultado</small><b className="mt-1 block text-base">{currency.format(currentMonth.metrics.profit)}</b></span>
        </div>
      </article>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-black">Comparação semanal</h2><p className="mt-1 text-[11px] text-white/45">Barras por leads totais; tabela com custo e retorno para localizar a virada de performance.</p></div>
        <div className="flex gap-3 text-[10px] text-white/50"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#d8b65c]" />Mês anterior</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />Mês atual</span></div>
      </div>
      <div className="mt-6 flex min-h-[230px] items-end gap-2 overflow-x-auto border-b border-white/15 pb-1">
        {analysis.weeklyComparison.length ? analysis.weeklyComparison.map((row) => <div key={row.week} className="group flex min-w-16 flex-1 flex-col items-center justify-end gap-2">
          <div className={cn("w-full max-w-16 rounded-t transition group-hover:brightness-125", row.month === "current" ? "bg-gradient-to-t from-sky-700 to-sky-300" : "bg-gradient-to-t from-[#73500f] via-[#b98a29] to-[#f0dfa4]")} style={{ height: `${Math.max(6, row.metrics.leads / maxWeeklyLeads * 190)}px` }} title={`${integer.format(row.metrics.leads)} leads · ${currency.format(row.metrics.spend)} · CPL ${currency.format(row.metrics.cpl)}`} />
          <span className="text-[8px] text-white/45">{format(new Date(`${row.week}T12:00:00`), "dd/MM")}</span><span className="text-[9px] font-bold text-white/70">{integer.format(row.metrics.leads)}</span>
        </div>) : <div className="grid w-full place-items-center text-sm text-white/40">Sem dados semanais nos dois meses.</div>}
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[11px]">
          <thead className="text-[10px] uppercase tracking-[.12em] text-white/40"><tr><th className="pb-3">Semana</th><th className="pb-3 text-right">Investimento</th><th className="pb-3 text-right">Leads</th><th className="pb-3 text-right">Conversas</th><th className="pb-3 text-right">CPL</th><th className="pb-3 text-right">Vendas</th><th className="pb-3 text-right">Receita</th><th className="pb-3 text-right">ROAS</th></tr></thead>
          <tbody>{analysis.weeklyComparison.map((row) => <tr key={`table-${row.week}`} className="border-t border-white/10">
            <td className="py-3 font-bold"><span className={cn("mr-2 inline-block h-2 w-2 rounded-full", row.month === "current" ? "bg-sky-400" : "bg-[#d8b65c]")} />{format(new Date(`${row.week}T12:00:00`), "dd/MM")}–{format(new Date(`${row.to}T12:00:00`), "dd/MM")}</td>
            <td className="py-3 text-right">{currency.format(row.metrics.spend)}</td><td className="py-3 text-right">{integer.format(row.metrics.leads)}</td><td className="py-3 text-right">{integer.format(row.metrics.conversations)}</td><td className="py-3 text-right">{currency.format(row.metrics.cpl)}</td><td className="py-3 text-right">{integer.format(row.metrics.sales)}</td><td className="py-3 text-right">{currency.format(row.metrics.revenue)}</td><td className="py-3 text-right">{row.metrics.roas.toFixed(2)}x</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <RecommendationGrid title="O que deu certo" icon={<TrendingUp className="h-4 w-4" />} tone="success" items={analysis.wins} empty="Nenhum ganho consistente foi identificado com a amostra disponível." />
    <RecommendationGrid title="O que piorou" icon={<TrendingDown className="h-4 w-4" />} tone="danger" items={analysis.risks} empty="Nenhum risco adicional foi detectado na comparação." />
    <RecommendationGrid title="O que fazer agora" icon={<Lightbulb className="h-4 w-4" />} tone="gold" items={analysis.actions} empty="Sem ação recomendada." />
  </>;
}

function RecommendationGrid({ title, icon, tone, items, empty }: { title: string; icon: ReactNode; tone: "success" | "danger" | "gold"; items: TwoMonthAnalysis["wins"]; empty: string }) {
  const frame = tone === "success" ? "border-emerald-400/20 bg-emerald-400/[.05]" : tone === "danger" ? "border-rose-400/20 bg-rose-400/[.05]" : "border-[#d8b65c]/25 bg-[#d8b65c]/[.05]";
  const textTone = tone === "success" ? "text-emerald-300" : tone === "danger" ? "text-rose-300" : "text-[#f0dfa4]";
  return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
    <h2 className={cn("flex items-center gap-2 font-black", textTone)}>{icon}{title}</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2">{items.length ? items.map((item) => <article key={`${title}-${item.title}`} className={cn("rounded-xl border p-4", frame)}>
      <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-black text-white">{item.title}</h3><span className={cn("rounded-full border border-current/25 px-2 py-1 text-[9px] font-black uppercase", textTone)}>{item.priority}</span></div>
      <p className="mt-3 text-xs leading-relaxed text-white/65"><b className="text-white">Evidência:</b> {item.evidence}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/80"><b className="text-white">Direcionamento:</b> {item.recommendation}</p>
    </article>) : <div className="rounded-xl border border-white/10 p-4 text-xs text-white/45">{empty}</div>}</div>
  </section>;
}

function formatAnalysisMetric(id: TwoMonthAnalysis["metricComparisons"][number]["id"], value: number) {
  if (["spend", "cpl", "cpc", "cpm", "revenue", "cac", "profit"].includes(id)) return currency.format(value);
  if (["ctr", "conversionRate", "coverage"].includes(id)) return `${value.toFixed(2)}%`;
  if (id === "roas") return `${value.toFixed(2)}x`;
  return integer.format(value);
}

function calculate(insights: InsightRow[], deals: RDDealLite[], saleRows: Sale[], conversations = 0): ReportTotals {
  const spend = insights.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const leads = insights.reduce((sum, row) => sum + Number(row.leads || 0), 0) + conversations;
  const impressions = insights.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const clicks = insights.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const reach = insights.reduce((sum, row) => sum + Number(row.reach || 0), 0);
  const confirmed = aggregateSales(saleRows);
  const sales = confirmed.totalQuantity;
  const revenue = confirmed.totalNet;

  return {
    spend,
    leads,
    conversations,
    cpl: leads ? spend / leads : 0,
    impressions,
    reach,
    frequency: reach ? impressions / reach : 0,
    clicks,
    cpc: clicks ? spend / clicks : 0,
    ctr: impressions ? clicks / impressions * 100 : 0,
    cpm: impressions ? spend / impressions * 1000 : 0,
    conversionRate: clicks ? leads / clicks * 100 : 0,
    rd: deals.length,
    sales,
    revenue,
    cac: sales ? spend / sales : 0,
    roas: spend ? revenue / spend : 0,
    profit: revenue - spend,
    coverage: leads ? deals.length / leads * 100 : 0,
  };
}
function dailyRows(insights: InsightRow[]) { const map = new Map<string, { date: string; leads: number; spend: number }>(); insights.forEach((r) => { if (!r.date) return; const row = map.get(r.date) || { date: r.date, leads: 0, spend: 0 }; row.leads += Number(r.leads || 0); row.spend += Number(r.spend || 0); map.set(r.date, row); }); return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)); }
function weeklyRows(daily: ReturnType<typeof dailyRows>) { const map = new Map<string, { week: string; leads: number; spend: number; days: number }>(); daily.forEach((day) => { const week = format(startOfWeek(new Date(`${day.date}T12:00:00`), { weekStartsOn: 1 }), "yyyy-MM-dd"); const row = map.get(week) || { week, leads: 0, spend: 0, days: 0 }; row.leads += day.leads; row.spend += day.spend; row.days += 1; map.set(week, row); }); return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week)); }
function formatMetricValue(id: MetricId, value: number) {
  if (["spend", "cpl", "cpc", "cpm", "revenue", "cac", "profit"].includes(id)) return currency.format(value);
  if (["ctr", "conversionRate", "coverage"].includes(id)) return `${value.toFixed(2)}%`;
  if (["roas", "frequency"].includes(id)) return `${value.toFixed(2)}x`;
  return integer.format(value);
}

function PreviewMetric({ id, totals }: { id: MetricId; totals: ReportTotals }) {
  const metric = METRICS.find((item) => item.id === id);
  return <article title={metric?.description} className="min-w-0 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/[.045] p-4 shadow-[0_18px_55px_-45px_hsl(var(--primary))]">
    <span className="block truncate text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">{metric?.label || id}</span>
    <b className="mt-2 block truncate text-xl text-foreground">{formatMetricValue(id, totals[id])}</b>
  </article>;
}

function ReportMetric({ id, totals }: { id: MetricId; totals: ReportTotals }) {
  const metric = METRICS.find((item) => item.id === id);
  return <article title={metric?.description} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.07] to-white/[.025] p-5 shadow-2xl">
    <span className="text-[9px] font-black uppercase tracking-[.18em] text-white/45">{metric?.label || id}</span>
    <b className="mt-3 block text-2xl">{formatMetricValue(id, totals[id])}</b>
  </article>;
}
