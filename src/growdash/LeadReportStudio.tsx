import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek } from "date-fns";
import { ArrowLeft, BarChart3, Check, Copy, ExternalLink, ImageUp, Link2, Presentation, Sparkles, Trash2 } from "lucide-react";
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

type InsightRow = { date?: string | null; spend?: number | null; leads?: number | null; impressions?: number | null; clicks?: number | null; reach?: number | null; cpm?: number | null; frequency?: number | null; conversion_rate?: number | null };
export type MetricId = "spend" | "leads" | "conversations" | "cpl" | "impressions" | "reach" | "frequency" | "clicks" | "cpc" | "ctr" | "cpm" | "conversionRate" | "rd" | "sales" | "revenue" | "cac" | "roas" | "profit" | "coverage";
export type ReportTotals = Record<MetricId, number>;
export type ReportSnapshot = { title: string; accountName: string; dateFrom: string; dateTo: string; metrics: MetricId[]; banner?: string; totals: ReportTotals; daily: Array<{ date: string; leads: number; spend: number }>; weekly: Array<{ week: string; leads: number; spend: number; days: number }> };

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
  const adIds = useMemo(() => Array.from(new Set(filteredInsights.map((row: any) => row.ad_id).filter(Boolean))), [filteredInsights]);
  const adAccountByAdId = useMemo(() => Object.fromEntries(filteredInsights.map((row: any) => [row.ad_id, row.ad_account_id])), [filteredInsights]);
  const { data: actionData } = useActionTotalsByAds(adIds, startDate, endDate, adAccountByAdId);
  const conversations = actionData?.totals?.["onsite_conversion.messaging_conversation_started_7d"] || 0;
  const totals = useMemo(() => calculate(filteredInsights, filteredDeals, filteredSales, conversations), [conversations, filteredDeals, filteredInsights, filteredSales]);
  const daily = useMemo(() => dailyRows(filteredInsights), [filteredInsights]);
  const weekly = useMemo(() => weeklyRows(daily), [daily]);
  const snapshot = useMemo<ReportSnapshot>(() => ({ title: `Relatório de performance — ${accountName || "Conta selecionada"}`, accountName: accountName || "Conta selecionada", dateFrom: reportFrom, dateTo: reportTo, metrics: selected, banner, totals, daily, weekly }), [accountName, banner, daily, reportFrom, reportTo, selected, totals, weekly]);

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
          <Button className="gold-action h-10" disabled={saving || !selected.length || accountId === "all"} onClick={generate}><Sparkles className="mr-2 h-4 w-4" />{saving ? "Publicando…" : "Gerar página"}</Button>
        </div>
      </header>
      <div className="p-4">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">Métricas do relatório</h3>
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
  return <div className={cn(onClose && "fixed inset-0 z-[200]", "min-h-screen overflow-y-auto bg-[#050505] text-white")}>
    <div className="relative min-h-[380px] overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#181105] via-black to-[#2b1f08]">
      {report.banner && <img src={report.banner} alt="Banner da marca" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/45 to-black/15" />
      <div className="absolute left-4 top-4 z-10 flex gap-2">{onClose && <Button variant="outline" className="border-white/20 bg-black/45 text-white hover:bg-black/65" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>}{shareUrl && onCopy && <Button variant="outline" className="border-white/20 bg-black/45 text-white hover:bg-black/65" onClick={onCopy}><Link2 className="mr-2 h-4 w-4" />Copiar link</Button>}</div>
      <div className="relative z-[1] mx-auto flex min-h-[380px] max-w-[1800px] items-end px-5 pb-12 sm:px-10"><div><span className="text-[10px] font-black uppercase tracking-[.3em] text-[#d8b65c]">Growdash Original Report</span><h1 className="mt-3 max-w-5xl text-3xl font-black sm:text-5xl">{report.accountName}</h1><p className="mt-3 text-sm text-white/65">Meta Ads × RD Station · {format(new Date(`${report.dateFrom}T12:00:00`), "dd/MM/yyyy")} a {format(new Date(`${report.dateTo}T12:00:00`), "dd/MM/yyyy")}</p></div></div>
    </div>
    <main className="mx-auto max-w-[1800px] space-y-8 px-5 py-10 sm:px-10">
      <section><h2 className="mb-4 text-lg font-black">Resumo executivo</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics.map((id) => <ReportMetric key={id} id={id} totals={totals} />)}</div></section>
      <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="flex items-center gap-2 font-black"><BarChart3 className="h-4 w-4 text-[#d8b65c]" />Leads e investimento por dia</h2><div className="mt-6 flex min-h-[260px] items-end gap-2 overflow-x-auto border-b border-white/15 pb-1">{daily.length ? daily.map((row) => { const max = Math.max(1, ...daily.map((item) => item.leads)); return <div key={row.date} className="group flex min-w-10 flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-12 rounded-t bg-gradient-to-t from-[#73500f] via-[#b98a29] to-[#f0dfa4] transition group-hover:brightness-125" style={{ height: `${Math.max(4, row.leads / max * 220)}px` }} title={`${integer.format(row.leads)} leads · ${currency.format(row.spend)}`} /><span className="text-[8px] text-white/45">{format(new Date(`${row.date}T12:00:00`), "dd/MM")}</span></div>; }) : <div className="grid w-full place-items-center text-sm text-white/40">Sem dados diários no período</div>}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-black">Leitura automática</h2><div className="mt-5 space-y-3 text-xs leading-relaxed text-white/65"><p>• Foram registrados <b className="text-white">{integer.format(totals.leads)} leads</b> com CPL de <b className="text-white">{currency.format(totals.cpl)}</b>.</p><p>• O RD recebeu <b className="text-white">{integer.format(totals.rd)}</b> negócios e marcou <b className="text-white">{integer.format(totals.sales)}</b> venda(s).</p><p>• A cobertura RD/Meta é <b className="text-white">{totals.leads ? (totals.rd / totals.leads * 100).toFixed(1) : "0.0"}%</b>; diferenças pedem revisão de UTM, período e atribuição.</p><p>• ROAS atribuído: <b className="text-white">{totals.roas.toFixed(2)}x</b>.</p></div></div></section>
      <section><h2 className="mb-4 text-lg font-black">Consolidado semanal</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{weekly.length ? weekly.map((row) => <article key={row.week} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><span className="text-[9px] font-black uppercase tracking-[.16em] text-[#d8b65c]">Semana de {format(new Date(`${row.week}T12:00:00`), "dd/MM")}</span><div className="mt-4 grid grid-cols-2 gap-4 text-xs"><span><small className="block text-white/45">Leads</small><b className="mt-1 block text-lg">{integer.format(row.leads)}</b></span><span><small className="block text-white/45">Investimento</small><b className="mt-1 block text-lg">{currency.format(row.spend)}</b></span><span><small className="block text-white/45">CPL</small><b>{currency.format(row.leads ? row.spend / row.leads : 0)}</b></span><span><small className="block text-white/45">Dias</small><b>{integer.format(row.days)}</b></span></div></article>) : <div className="rounded-2xl border border-white/10 p-5 text-sm text-white/40">Sem consolidado semanal no período.</div>}</div></section>
    </main>
  </div>;
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
