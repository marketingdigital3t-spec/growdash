import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  Instagram,
  MessageCircle,
  Radio,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "executive" | "operations";

const kpis = [
  {
    label: "CPL geral",
    value: "R$ 2,98",
    detail: "snapshot informado",
    tone: "gold",
    icon: Target,
  },
  {
    label: "CAC geral",
    value: "R$ 226,66",
    detail: "base a confirmar",
    tone: "green",
    icon: CircleDollarSign,
  },
  {
    label: "CPL · aluno · out/26",
    value: "R$ 8,31",
    detail: "−31,5% vs. setembro",
    tone: "blue",
    icon: UsersRound,
  },
  {
    label: "CAC · aluno · out/26",
    value: "R$ 1.246,46",
    detail: "3,35× vs. setembro",
    tone: "red",
    icon: BarChart3,
  },
] as const;

const campaignRows = [
  { name: "Tráfego direto · WhatsApp", channel: "WhatsApp", goal: "Contato imediato", status: "Em teste", tone: "blue" },
  { name: "Tráfego direto · Formulário → WhatsApp", channel: "Formulário", goal: "Qualificar antes do contato", status: "Próximo teste", tone: "gold" },
  { name: "Tráfego direto · Link da bio → WhatsApp", channel: "Orgânico / bio", goal: "Capturar público quente", status: "Prioridade", tone: "green" },
] as const;

const decisions = [
  "Confirmar a base do CAC: R$ 226,66, R$ 272 ou outro valor.",
  "Definir o corte financeiro: R$ 5 mil, R$ 10 mil ou outra regra.",
  "Validar se a automação continuará filtrando leads abaixo da faixa escolhida.",
  "Separar paciente modelo (SP/TO) de aluno (Brasil) no acompanhamento.",
];

function MetricCard({ metric }: { metric: typeof kpis[number] }) {
  const Icon = metric.icon;
  return (
    <article className="month-closing-kpi rounded-2xl border border-white/10 bg-white/[.055] p-4 shadow-[0_14px_34px_rgba(0,0,0,.18)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          "grid h-9 w-9 place-items-center rounded-xl border",
          metric.tone === "gold" && "border-amber-300/25 bg-amber-300/10 text-amber-300",
          metric.tone === "green" && "border-emerald-300/25 bg-emerald-300/10 text-emerald-300",
          metric.tone === "blue" && "border-sky-300/25 bg-sky-300/10 text-sky-300",
          metric.tone === "red" && "border-rose-300/25 bg-rose-300/10 text-rose-300",
        )}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-white/45">KPI</span>
      </div>
      <p className="mt-5 text-xs font-semibold text-white/58">{metric.label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-white sm:text-[1.75rem]">{metric.value}</p>
      <p className="mt-2 text-[11px] font-medium text-white/45">{metric.detail}</p>
    </article>
  );
}

function ComparisonBar({ label, september, october, max, formatter }: { label: string; september: number; october: number; max: number; formatter: (value: number) => string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-white/78">{label}</span>
        <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[10px] font-black text-rose-200">{label === "CAC" ? "3,35× maior" : "31,5% menor"}</span>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-[84px_1fr_88px] items-center gap-2 text-xs">
          <span className="font-semibold text-white/50">Set/26</span>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.max(8, (september / max) * 100)}%` }} /></div>
          <span className="text-right font-black text-white/76">{formatter(september)}</span>
        </div>
        <div className="grid grid-cols-[84px_1fr_88px] items-center gap-2 text-xs">
          <span className="font-semibold text-white/50">Out/26</span>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.max(8, (october / max) * 100)}%` }} /></div>
          <span className="text-right font-black text-white/76">{formatter(october)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MonthClosingPage() {
  const [view, setView] = useState<ViewMode>("executive");
  const comparisons = useMemo(() => ({ cplMax: 12.13, cacMax: 1246.46 }), []);

  return (
    <div className="month-closing-page mx-auto max-w-[1540px] pb-8">
      <section className="relative overflow-hidden rounded-[28px] border border-[#b88a38]/35 bg-[#101319] px-5 py-6 text-white shadow-[0_22px_60px_rgba(0,0,0,.24)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#dca84a]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#e4b95f]">
                <span>Growdash · fechamento mensal</span>
                <span className="h-1 w-1 rounded-full bg-white/35" />
                <span className="text-white/45">Ranielly</span>
              </div>
              <h1 className="mt-4 text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">CPL caiu. CAC subiu.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/62 sm:text-base">O mês trouxe mais volume de leads, mas a conversão comercial perdeu eficiência. O próximo ciclo precisa medir qualidade, maturação e origem — não apenas o custo do lead.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.055] px-3 py-2.5 text-xs text-white/65">
              <CalendarDays className="h-4 w-4 text-[#e4b95f]" />
              <span>Setembro × Outubro 2026</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={() => setView("executive")} className={cn("rounded-full px-3.5 py-2 text-xs font-black transition", view === "executive" ? "bg-[#e4b95f] text-[#19130a]" : "border border-white/10 bg-white/[.04] text-white/65 hover:bg-white/10")}>Visão executiva</button>
            <button type="button" onClick={() => setView("operations")} className={cn("rounded-full px-3.5 py-2 text-xs font-black transition", view === "operations" ? "bg-[#e4b95f] text-[#19130a]" : "border border-white/10 bg-white/[.04] text-white/65 hover:bg-white/10")}>Plano operacional</button>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-white/40"><Radio className="h-3.5 w-3.5" />Snapshot da reunião · dados a validar</span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
        {kpis.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      {view === "executive" ? (
        <>
          <section className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
            <article className="month-closing-surface rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Eficiência · aluno</p>
                  <h2 className="mt-1 text-xl font-black">Mais leads, menos vendas por real</h2>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">A retirada da lógica condicional baixou o CPL, mas o CAC ficou 3,35× maior. A leitura precisa considerar a maturação média de uma semana e a nova régua comercial.</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-rose-300/30 bg-rose-300/10 px-2.5 py-1 text-[10px] font-black text-rose-700 dark:text-rose-200"><ArrowUpRight className="h-3.5 w-3.5" />CAC +235,5%</span>
              </div>
              <div className="mt-7 grid gap-7 sm:grid-cols-2">
                <ComparisonBar label="CPL" september={12.13} october={8.31} max={comparisons.cplMax} formatter={(value) => `R$ ${value.toFixed(2).replace(".", ",")}`} />
                <ComparisonBar label="CAC" september={371.54} october={1246.46} max={comparisons.cacMax} formatter={(value) => `R$ ${value.toFixed(2).replace(".", ",")}`} />
              </div>
              <div className="mt-7 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-3">
                <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Set/26</p><p className="mt-1 text-sm font-black">Condicional + WhatsApp</p></div>
                <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Out/26</p><p className="mt-1 text-sm font-black">Sem condicional</p></div>
                <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Leitura</p><p className="mt-1 text-sm font-black text-primary">Qualidade virou o gargalo</p></div>
              </div>
            </article>

            <article className="month-closing-surface relative overflow-hidden rounded-2xl border border-[#b88a38]/35 bg-gradient-to-br from-[#1e1a12] via-[#181817] to-[#111317] p-5 text-white sm:p-6">
              <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#e4b95f]/16 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[#e4b95f]"><Instagram className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[.16em]">Oportunidade prioritária</p></div>
                <h2 className="mt-4 text-2xl font-black leading-tight">Link da bio é o canal mais quente</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/60">A hipótese é que quem chega pelo perfil já conhece a doutora e tem mais consciência de investimento. O próximo passo é registrar essa origem no RD e comparar oportunidade e venda.</p>
                <div className="mt-6 space-y-3">
                  {["Registrar canal + campanha + conjunto + anúncio", "Separar link da bio de tráfego pago", "Comparar taxa de oportunidade e fechamento"].map((item) => <div key={item} className="flex items-start gap-2 text-xs font-semibold text-white/75"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#e4b95f]" />{item}</div>)}
                </div>
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
            <article className="month-closing-surface rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Reativação</p><h2 className="mt-1 text-xl font-black">Final de mês</h2></div><MessageCircle className="h-5 w-5 text-primary" /></div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Reimpactar leads perdidos com uma ação específica do mês e medir o resultado separado do restante da operação.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/70 bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Verba de referência</p><p className="mt-1 text-xl font-black">R$ 100</p></div>
                <div className="rounded-xl border border-border/70 bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">CPL referência</p><p className="mt-1 text-xl font-black">R$ 10</p></div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-[11px] font-medium leading-relaxed text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />Valores apresentados como referência da reunião; confirmar período e conversão antes de escalar.</p>
            </article>

            <article className="month-closing-surface rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Mix de aquisição</p><h2 className="mt-1 text-xl font-black">Campanhas para o próximo ciclo</h2></div><Filter className="h-5 w-5 text-primary" /></div>
              <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead><tr className="border-b border-border/70 text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground"><th className="pb-3 pr-4">Campanha</th><th className="pb-3 pr-4">Canal</th><th className="pb-3 pr-4">Objetivo</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-border/60">{campaignRows.map((row) => <tr key={row.name} className="text-xs"><td className="py-3 pr-4 font-bold">{row.name}</td><td className="py-3 pr-4 text-muted-foreground">{row.channel}</td><td className="py-3 pr-4 text-muted-foreground">{row.goal}</td><td className="py-3"><span className={cn("rounded-full px-2 py-1 text-[10px] font-black", row.tone === "green" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", row.tone === "blue" && "bg-sky-500/10 text-sky-700 dark:text-sky-300", row.tone === "gold" && "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>{row.status}</span></td></tr>)}</tbody></table></div>
            </article>
          </section>
        </>
      ) : (
        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="month-closing-surface rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Execução</p><h2 className="mt-1 text-xl font-black">Plano operacional</h2></div><Sparkles className="h-5 w-5 text-primary" /></div>
            <div className="mt-5 space-y-3">{["Testar formulário sem desqualificar automaticamente", "Perguntar capacidade de investimento e priorizar o atendimento", "Registrar origem completa no RD e no resumo do WhatsApp", "Manter leads sem capacidade imediata em acompanhamento", "Separar paciente modelo (SP/TO) de aluno (Brasil)"].map((item, index) => <div key={item} className="flex gap-3 rounded-xl border border-border/70 bg-muted/25 p-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-black text-primary">{index + 1}</span><p className="text-sm font-semibold leading-relaxed">{item}</p></div>)}</div>
          </article>
          <article className="month-closing-surface rounded-2xl border border-amber-300/30 bg-amber-50/50 p-5 dark:bg-amber-950/20 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700 dark:text-amber-300">Decisões pendentes</p><h2 className="mt-1 text-xl font-black">Antes de escalar</h2></div><AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" /></div>
            <div className="mt-5 space-y-3">{decisions.map((decision) => <div key={decision} className="flex items-start gap-2 text-sm font-semibold leading-relaxed"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-600" />{decision}</div>)}</div>
            <div className="mt-6 rounded-xl border border-amber-300/35 bg-white/50 p-4 text-xs font-medium leading-relaxed text-amber-950/75 dark:bg-black/10 dark:text-amber-100/75"><strong className="font-black">Mensagem para a reunião:</strong> o próximo ganho não é gerar mais leads; é gerar leads rastreáveis, compatíveis com a oferta e acompanhados até a maturação da venda.</div>
          </article>
        </section>
      )}

      <footer className="mt-5 flex flex-col gap-2 border-t border-border/60 px-1 pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5"><ArrowDownRight className="h-3.5 w-3.5 text-primary" />Fonte: alinhamento de tráfego · Ranielly</span>
        <span>Dados de reunião · validar antes de usar como resultado oficial</span>
      </footer>
    </div>
  );
}

