import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity, AlertTriangle, BarChart3, Bot, BrainCircuit, CheckCircle2, ClipboardCheck,
  Copy, Gauge, Loader2, MessageCircle, RefreshCw, Send, ShieldAlert, Sparkles,
  Target, TrendingUp, Video, WalletCards,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIntelligenceCenter } from "@/hooks/useIntelligenceCenter";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { metricsByDay, type DataStateKind, type UnifiedMetrics } from "@/lib/intelligenceMetrics";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/growdash/shared";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const tabs = [
  ["summary", "Resumo", BrainCircuit], ["anomalies", "Anomalias", ShieldAlert], ["budget", "Orçamento", WalletCards],
  ["reconciliation", "Reconciliação", ClipboardCheck], ["creative", "Criativos", Video], ["simulator", "Simulador", Gauge],
  ["playbooks", "Playbooks", Target], ["agents", "Agentes", Bot], ["forecast", "Previsões", TrendingUp], ["whatsapp", "WhatsApp", MessageCircle],
] as const;

const metricMeta: Array<[keyof UnifiedMetrics, string, (value: number) => string]> = [
  ["spend", "Investimento", money.format], ["impressions", "Impressões", integer.format], ["clicks", "Cliques", integer.format],
  ["leads", "Leads Meta", integer.format], ["rdLeads", "Leads RD", integer.format], ["sales", "Vendas", integer.format],
  ["cpl", "CPL", money.format], ["ctr", "CTR", (v) => `${decimal.format(v)}%`], ["cpm", "CPM", money.format],
  ["roas", "ROAS", (v) => `${decimal.format(v)}x`], ["frequency", "Frequência", decimal.format], ["revenue", "Receita", money.format],
];

function IntelligenceState({ state, onRetry }: { state: DataStateKind; onRetry: () => void }) {
  if (state === "ready" || state === "stale") return null;
  const content = state === "loading"
    ? [Loader2, "Carregando dados conciliados", "O histórico salvo aparece primeiro; a atualização ocorre em segundo plano."]
    : state === "error"
      ? [AlertTriangle, "Falha ao consultar uma das fontes", "Abra Saúde dos Dados para ver a conta, etapa e mensagem original."]
      : state === "empty"
        ? [Activity, "Nenhuma fonte configurada", "Conecte uma conta Meta Ads e o RD Station para iniciar a inteligência."]
        : [BarChart3, "Nenhum dado real no período", "A fonte está configurada, mas não retornou métricas para os filtros atuais."];
  const Icon = content[0] as typeof Activity;
  return <div className="gd-panel grid min-h-52 place-items-center p-6 text-center"><div><Icon className={cn("mx-auto h-8 w-8 text-primary", state === "loading" && "animate-spin")} /><h2 className="mt-3 font-black">{content[1] as string}</h2><p className="mt-1 max-w-lg text-sm text-muted-foreground">{content[2] as string}</p>{state === "error" && <button className="gd-button mt-4" onClick={onRetry}>Tentar novamente</button>}</div></div>;
}

function MetricGrid({ metrics }: { metrics: UnifiedMetrics }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{metricMeta.map(([key, label, formatter]) => <article key={key} className="gd-panel cursor-default p-4" title={`Métrica ${label}, calculada pelo contrato unificado da Growdash.`}><span className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">{label}</span><strong className="mt-2 block truncate text-xl tabular-nums">{formatter(metrics[key])}</strong><small className="mt-1 block text-[10px] text-muted-foreground">Fonte reconciliada</small></article>)}</div>;
}

function buildExecutiveText(name: string, metrics: UnifiedMetrics, anomalies: number) {
  const direction = metrics.roas > 1 ? "retorno positivo" : metrics.revenue > 0 ? "retorno abaixo do investimento" : "receita ainda não atribuída";
  return `${name}: ${money.format(metrics.spend)} investidos, ${integer.format(metrics.leads)} leads Meta, ${integer.format(metrics.rdLeads)} leads RD e ${integer.format(metrics.sales)} vendas. CPL ${money.format(metrics.cpl)}, CTR ${decimal.format(metrics.ctr)}%, ROAS ${decimal.format(metrics.roas)}x (${direction}). ${anomalies ? `${anomalies} desvio(s) precisam de ação.` : "Nenhuma anomalia relevante foi detectada na janela atual."}`;
}

export default function IntelligenceCenterPage() {
  const intelligence = useIntelligenceCenter();
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("summary");
  const [investment, setInvestment] = useState(10_000);
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [phone, setPhone] = useState("");
  const [reportTime, setReportTime] = useState("08:00");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const daily = useMemo(() => metricsByDay(intelligence.insights).map((row) => ({ date: format(new Date(`${row.date}T12:00:00`), "dd/MM"), cpl: row.metrics.cpl, ctr: row.metrics.ctr, spend: row.metrics.spend, leads: row.metrics.leads })), [intelligence.insights]);
  const executiveText = generatedSummary || buildExecutiveText(intelligence.context.name, intelligence.metrics, intelligence.anomalies.length);
  const selectedForecasts = useMemo(() => {
    const base = intelligence.forecasts.find((item) => item.key === "probable")?.investment || 1;
    return intelligence.forecasts.map((item) => ({ ...item, investment: investment * (item.investment / base), leads: item.leads * investment / base, sales: item.sales * investment / base, revenue: item.revenue * investment / base, cac: item.cac }));
  }, [intelligence.forecasts, investment]);

  const copySummary = async () => { await navigator.clipboard.writeText(executiveText); toast.success("Resumo executivo copiado"); };
  const generateSummary = async () => {
    if (intelligence.context.id === "all") return toast.warning("Selecione uma conta para gerar um resumo auditável por fuso e atribuição.");
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-intelligence-snapshot", {
        body: { account_id: intelligence.context.id, date: format(intelligence.filters.endDate, "yyyy-MM-dd") },
      });
      if (error) throw error;
      setGeneratedSummary(data?.executive_summary || "");
      toast.success("Resumo diário gerado e armazenado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o resumo");
    } finally {
      setGeneratingSummary(false);
    }
  };
  const saveWhatsappSchedule = async () => {
    const phoneE164 = `+${phone.replace(/\D/g, "")}`;
    if (!/^\+\d{10,15}$/.test(phoneE164)) return toast.error("Informe o telefone com DDI e DDD.");
    if (!workspace?.id || !user?.id || intelligence.context.id === "all") return toast.warning("Selecione uma conta específica antes de agendar.");
    setSavingSchedule(true);
    try {
      const { error } = await supabase.from("whatsapp_report_schedules").insert({
        workspace_id: workspace.id,
        ad_account_id: intelligence.context.id,
        created_by: user.id,
        phone_e164: phoneE164,
        report_time: reportTime,
        timezone: intelligence.context.timezone,
        metrics: ["spend", "leads", "cpl", "ctr", "cpm", "roas", "frequency"],
        next_run_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      if (error) throw error;
      toast.success("Relatório diário agendado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o agendamento");
    } finally {
      setSavingSchedule(false);
    }
  };
  return <div className="mx-auto w-full max-w-[1920px] space-y-4">
    <PageHeading eyebrow="Intelligence OS" title="Central de Inteligência" description="Meta Ads, RD Station, vendas e financeiro sob o mesmo contrato de métricas, fuso e atribuição." actions={<div className="flex flex-wrap gap-2"><button className="gd-button" onClick={() => intelligence.refetch()} disabled={intelligence.isFetching}><RefreshCw className={cn("h-4 w-4", intelligence.isFetching && "animate-spin")} /> Atualizar</button><button className="gd-button" onClick={generateSummary} disabled={generatingSummary}><Sparkles className={cn("h-4 w-4", generatingSummary && "animate-pulse")} /> Gerar com IA</button><button className="gold-action" onClick={copySummary}><Copy className="h-4 w-4" /> Copiar resumo</button></div>} />
    <section className="gd-panel flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0"><b className="block truncate">{intelligence.context.name}</b><span className="text-xs text-muted-foreground">Fuso: {intelligence.context.timezone} · Atribuição: {intelligence.context.attributionWindow}</span></div>
      <div className="flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-border px-3 py-1.5">Meta: {intelligence.context.lastSyncAt ? format(new Date(intelligence.context.lastSyncAt), "dd/MM HH:mm") : "nunca"}</span><span className={cn("rounded-full border px-3 py-1.5", intelligence.context.oauthStatus === "healthy" ? "border-emerald-500/35 text-emerald-400" : "border-amber-500/35 text-amber-400")}>OAuth: {intelligence.context.oauthStatus}</span>{intelligence.dataState === "stale" && <span className="rounded-full border border-amber-500/35 px-3 py-1.5 text-amber-400">Histórico visível · atualizando</span>}</div>
    </section>
    <nav className="growdash-scrollbar-hidden flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1" aria-label="Módulos de inteligência">{tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-black", tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    <IntelligenceState state={intelligence.dataState} onRetry={() => intelligence.refetch()} />
    {(intelligence.dataState === "ready" || intelligence.dataState === "stale") && <>
      {tab === "summary" && <div className="space-y-4"><MetricGrid metrics={intelligence.metrics} /><section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><article className="gd-panel p-5"><div className="flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" /><h2 className="font-black">Resumo executivo diário</h2></div><p className="mt-4 text-sm leading-7 text-foreground/90">{executiveText}</p><div className="mt-4 rounded-xl border border-border bg-muted/35 p-3 text-xs text-muted-foreground">A análise respeita a conta, o período, o fuso e a janela de atribuição exibidos acima. Nenhum número ausente é inventado.</div></article><article className="gd-panel min-h-64 p-5"><h2 className="font-black">Tendência de CPL</h2><ResponsiveContainer width="100%" height={210}><LineChart data={daily}><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Line type="monotone" dataKey="cpl" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></article></section></div>}
      {tab === "anomalies" && <section className="grid gap-3 xl:grid-cols-2">{intelligence.anomalies.length ? intelligence.anomalies.map((item) => <article key={`${item.metric}-${item.title}`} className={cn("gd-panel border-l-4 p-5", item.severity === "critical" ? "border-l-red-500" : "border-l-amber-400")}><span className="text-[10px] font-black uppercase text-muted-foreground">{item.severity}</span><h2 className="mt-1 font-black">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.message}</p><p className="mt-4 rounded-lg bg-muted/45 p-3 text-xs"><b>Ação recomendada:</b> {item.action}</p></article>) : <article className="gd-panel p-6 xl:col-span-2"><CheckCircle2 className="h-7 w-7 text-emerald-400" /><h2 className="mt-3 font-black">Sem desvios relevantes</h2><p className="text-sm text-muted-foreground">CPL, CTR, CPM e frequência estão dentro da variação configurada.</p></article>}</section>}
      {tab === "budget" && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{[["Orçamento diário", money.format(intelligence.pacing.dailyBudget)], ["Gasto médio/dia", money.format(intelligence.pacing.averageDailySpend)], ["Projeção mensal", money.format(intelligence.pacing.projectedMonthSpend)], ["Saldo", money.format(intelligence.pacing.remainingBalance)], ["Autonomia", `${decimal.format(intelligence.pacing.autonomyDays)} dias`], ["Aporte sugerido", money.format(intelligence.pacing.recommendedRecharge)]].map(([label, value]) => <article key={label} className="gd-panel p-4"><span className="text-[10px] font-black uppercase text-muted-foreground">{label}</span><strong className="mt-2 block text-lg">{value}</strong></article>)}</div><article className="gd-panel p-5"><h2 className="font-black">Pacing e continuidade</h2><div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", intelligence.pacing.status === "critical" ? "bg-red-500" : intelligence.pacing.status === "attention" ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${Math.min(100, Math.max(5, intelligence.pacing.autonomyDays / 7 * 100))}%` }} /></div><p className="mt-3 text-sm text-muted-foreground">Situação {intelligence.pacing.status}. O aporte recomendado cobre aproximadamente sete dias no ritmo atual.</p></article></div>}
      {tab === "reconciliation" && <div className="space-y-4"><MetricGrid metrics={intelligence.metrics} /><section className="gd-panel p-5"><h2 className="font-black">Meta × RD × vendas</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><Comparison label="Cobertura RD" value={`${decimal.format(intelligence.metrics.rdCoverage)}%`} detail={`${integer.format(intelligence.metrics.rdLeads)} RD / ${integer.format(intelligence.metrics.leads)} Meta`} /><Comparison label="Qualificação" value={integer.format(intelligence.metrics.qualifiedLeads)} detail="negócios qualificados" /><Comparison label="Conversão em venda" value={`${decimal.format(intelligence.metrics.conversionRate)}%`} detail={`${integer.format(intelligence.metrics.sales)} venda(s)`} /></div><p className="mt-4 text-xs text-muted-foreground">Diferenças podem ocorrer por janela de atribuição, UTMs, fuso ou preenchimento do CRM. A Growdash mantém a origem explícita.</p></section></div>}
      {tab === "creative" && <section className="space-y-3">{intelligence.creativeFatigue.slice(0, 20).map((creative) => <article key={creative.adId} className="gd-panel grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_120px]"><div className="min-w-0"><b className="block truncate">{creative.name}</b><span className={cn("text-xs", creative.needsReplacement ? "text-red-400" : "text-emerald-400")}>{creative.needsReplacement ? "Substituição recomendada" : "Sem fadiga crítica"}</span></div><Value label="Fadiga" value={`${decimal.format(creative.fatigueScore)}%`} /><Value label="Frequência" value={decimal.format(creative.frequency)} /><Value label="CTR" value={`${decimal.format(creative.ctr)}%`} /></article>)}</section>}
      {tab === "simulator" && <div className="space-y-4"><section className="gd-panel p-5"><label className="text-sm font-black" htmlFor="scale-investment">Investimento a simular</label><div className="mt-3 flex items-center gap-3"><input id="scale-investment" type="range" min="1000" max="200000" step="1000" value={investment} onChange={(event) => setInvestment(Number(event.target.value))} className="w-full accent-[hsl(var(--primary))]" /><strong className="w-36 text-right">{money.format(investment)}</strong></div></section><div className="grid gap-4 xl:grid-cols-3">{selectedForecasts.map((scenario) => <article key={scenario.key} className={cn("gd-panel p-5", scenario.key === "probable" && "border-primary/55")}><span className="text-[10px] font-black uppercase text-primary">{scenario.label}</span><h2 className="mt-2 text-2xl font-black">{money.format(scenario.revenue)}</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><Value label="Investimento" value={money.format(scenario.investment)} /><Value label="Leads" value={integer.format(scenario.leads)} /><Value label="Vendas" value={decimal.format(scenario.sales)} /><Value label="CAC" value={money.format(scenario.cac)} /></dl></article>)}</div></div>}
      {tab === "playbooks" && <section className="grid gap-3 xl:grid-cols-2">{intelligence.playbooks.length ? intelligence.playbooks.map((playbook, index) => <article key={`${playbook.title}-${index}`} className="gd-panel p-5"><span className="text-[10px] font-black uppercase text-primary">{playbook.severity}</span><h2 className="mt-1 font-black">{playbook.title}</h2><p className="mt-2 text-xs text-muted-foreground">Gatilho: {playbook.trigger}</p><ol className="mt-4 space-y-2">{playbook.actions.map((action, actionIndex) => <li key={action} className="flex gap-2 text-sm"><span className="text-primary">{actionIndex + 1}.</span>{action}</li>)}</ol></article>) : <article className="gd-panel p-6 xl:col-span-2">Nenhum playbook emergencial necessário.</article>}</section>}
      {tab === "agents" && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[["Atlas", "Tráfego e escala", "CPL, CTR, CPM e pacing"], ["Nina", "Funil e CRM", "RD, cobertura e gargalos"], ["Milo", "Criativos", "Fadiga e substituição"], ["Luna", "Receita", "CAC, ROAS e previsão"]].map(([name, specialty, scope]) => <article key={name} className="gd-panel p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="h-5 w-5" /></span><h2 className="mt-4 font-black">{name}</h2><p className="text-sm text-primary">{specialty}</p><p className="mt-2 text-xs text-muted-foreground">{scope} · {intelligence.context.name}</p><a href="/agentes" className="gd-button mt-4 inline-flex">Abrir escritório</a></article>)}</section>}
      {tab === "forecast" && <div className="grid gap-4 xl:grid-cols-3">{intelligence.forecasts.map((scenario) => <article key={scenario.key} className="gd-panel p-5"><span className="text-[10px] font-black uppercase text-primary">{scenario.label}</span><h2 className="mt-2 text-2xl font-black">{money.format(scenario.revenue)}</h2><div className="mt-4 grid grid-cols-2 gap-3"><Value label="Investimento" value={money.format(scenario.investment)} /><Value label="Leads" value={integer.format(scenario.leads)} /><Value label="Vendas" value={decimal.format(scenario.sales)} /><Value label="CAC" value={money.format(scenario.cac)} /></div></article>)}</div>}
      {tab === "whatsapp" && <section className="grid gap-4 xl:grid-cols-[1fr_.75fr]"><article className="gd-panel p-5"><div className="flex items-center gap-2 text-primary"><MessageCircle className="h-5 w-5" /><h2 className="font-black">Relatório automático</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" placeholder="+55 11 99999-9999" /></label><label className="text-xs font-bold">Horário<input type="time" value={reportTime} onChange={(event) => setReportTime(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label></div><div className="mt-4 flex flex-wrap gap-2">{["Investimento", "Leads", "CPL", "CTR", "CPM", "ROAS", "Frequência"].map((item) => <label key={item} className="rounded-full border border-border px-3 py-2 text-xs"><input type="checkbox" defaultChecked className="mr-2 accent-[hsl(var(--primary))]" />{item}</label>)}</div><button className="gold-action mt-5" onClick={saveWhatsappSchedule} disabled={savingSchedule}><Send className={cn("h-4 w-4", savingSchedule && "animate-pulse")} /> Salvar agendamento</button><p className="mt-3 text-xs text-muted-foreground">A entrega usa o provedor configurado no backend e mantém telefone, conta e workspace isolados por RLS.</p></article><article className="gd-panel p-5"><h2 className="font-black">Prévia</h2><p className="mt-4 whitespace-pre-line rounded-xl bg-muted/35 p-4 text-sm leading-6">{executiveText}{"\n\n"}Ações: {intelligence.playbooks.slice(0, 2).map((item) => item.title).join("; ") || "manter acompanhamento"}.</p></article></section>}
    </>}
  </div>;
}

function Comparison({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="rounded-xl border border-border bg-muted/30 p-4"><span className="text-[10px] font-black uppercase text-muted-foreground">{label}</span><strong className="mt-2 block text-xl">{value}</strong><small className="text-muted-foreground">{detail}</small></article>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt className="text-[9px] font-black uppercase text-muted-foreground">{label}</dt><dd className="mt-1 font-black tabular-nums">{value}</dd></div>; }
