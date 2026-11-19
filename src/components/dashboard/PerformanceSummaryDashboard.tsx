import { useMemo } from "react";
import {
  Handshake,
  MessageCircle,
  MessageSquareText,
  ShoppingCart,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
  Filter,
  Coins,
} from "lucide-react";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { formatCurrency, formatInteger } from "@/lib/format/formatPtBr";
import { bucketRDStage, RDStageBucket } from "@/lib/rdStageBuckets";

export interface PerformanceSummaryDashboardProps {
  accountTitle?: string;
  totalSpend: number;
  salesCount: number;
  totalLeads: number;
  deals?: Array<{
    id?: string;
    rd_stage_name?: string | null;
    stage_bucket?: string | null;
    win?: boolean;
    lost_reason?: string | null;
  }>;
  className?: string;
  onSyncRD?: () => void;
  syncingRD?: boolean;
  rdSyncStatus?: "idle" | "success" | "partial" | "error";
  rdSyncSummary?: { deals?: number; created?: number; updated?: number; error?: string } | null;
}

type PipelineStage = {
  id: string;
  label: string;
  count: number;
  Icon: typeof UserPlus;
  className: string;
};

const STAGE_CONFIG: Record<RDStageBucket, { Icon: typeof UserPlus; className: string }> = {
  "novo-lead": { Icon: UserPlus, className: "bg-[#0b2344] border-sky-500/35" },
  "sem-conversa": { Icon: MessageSquareText, className: "bg-[#0d2d55] border-sky-500/40" },
  conversa: { Icon: MessageCircle, className: "bg-[#103c70] border-sky-400/45" },
  oportunidade: { Icon: Handshake, className: "bg-[#154e82] border-cyan-400/50" },
  vendas: { Icon: ShoppingCart, className: "bg-[#185c91] border-cyan-300/55" },
  perdidas: { Icon: XCircle, className: "bg-[#203b5d] border-slate-400/35" },
  "etapa-propria": { Icon: Filter, className: "bg-[#2a4a6e] border-emerald-500/35" },
};

const BUCKET_LABELS: Record<RDStageBucket, string> = {
  "novo-lead": "Novo Lead",
  "sem-conversa": "Sem Conversa",
  conversa: "Conversa",
  oportunidade: "Oportunidade",
  vendas: "Vendas",
  perdidas: "Perdidas",
  "etapa-propria": "Etapa própria",
};

const ORDER: RDStageBucket[] = [
  "novo-lead",
  "sem-conversa",
  "conversa",
  "oportunidade",
  "vendas",
  "perdidas",
  "etapa-propria",
];

function getPipelineStages(deals: PerformanceSummaryDashboardProps["deals"], salesCount: number): PipelineStage[] {
  const counts: Record<string, number> = {};

  for (const deal of deals || []) {
    const { bucket, label } = bucketRDStage({
      stageName: deal.rd_stage_name || deal.stage_bucket || "",
      won: Boolean(deal.win),
      lost: Boolean(deal.lost_reason),
    });
    counts[label] = (counts[label] || 0) + 1;
  }

  if (!deals?.length) {
    counts[BUCKET_LABELS.vendas] = (counts[BUCKET_LABELS.vendas] || 0) + salesCount;
  }

  return ORDER.map((bucket) => {
    const label = BUCKET_LABELS[bucket];
    const count = counts[label] || 0;
    const config = STAGE_CONFIG[bucket];
    return { id: bucket, label, count, Icon: config?.Icon ?? UserPlus, className: config?.className ?? "border-primary/20" };
  });
}

export function PerformanceSummaryDashboard({
  accountTitle = "Conta selecionada",
  totalSpend,
  salesCount,
  totalLeads,
  deals = [],
  className = "",
  onSyncRD,
  syncingRD = false,
  rdSyncStatus = "idle",
  rdSyncSummary = null,
}: PerformanceSummaryDashboardProps) {
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const cac = salesCount > 0 ? totalSpend / salesCount : 0;
  const conversionRate = totalLeads > 0 ? (salesCount / totalLeads) * 100 : 0;
  const pipelineStages = useMemo(() => getPipelineStages(deals, salesCount), [deals, salesCount]);

  const metrics = [
    { label: "Investimento total", value: formatCurrency(totalSpend), icon: Coins, emphasis: true },
    { label: "Leads", value: formatInteger(totalLeads), icon: Users },
    { label: "CPL", value: formatCurrency(cpl), icon: Target },
    { label: "Vendas", value: formatInteger(salesCount), icon: ShoppingCart },
    { label: "CAC", value: formatCurrency(cac), icon: Target },
    { label: "Taxa de conversão", value: `${conversionRate.toFixed(2).replace(".", ",")}%`, icon: TrendingUp },
  ];

  return (
    <section className={`w-full min-w-0 ${className}`} aria-label="Resumo de performance">
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-[#07172f]/96 via-[#040e20]/96 to-[#020712]/98 p-4 shadow-[0_20px_50px_-20px_rgba(0,100,255,0.3)] backdrop-blur-2xl sm:p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-400/40 bg-sky-950/60 text-sky-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                Resumo de Performance <span className="font-light text-slate-500">|</span> <span className="text-sky-400">{accountTitle}</span>
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">Investimento, leads, vendas e eficiência do pipeline.</p>
            </div>
          </div>
          {onSyncRD && (
            <button
              type="button"
              onClick={onSyncRD}
              disabled={syncingRD}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-[#0a2548] px-3.5 py-2 text-xs font-black text-sky-200 shadow-sm transition hover:bg-[#0d3160] hover:text-white disabled:opacity-50"
            >
              <Coins className={`h-3.5 w-3.5 ${syncingRD ? "animate-spin text-sky-400" : "text-sky-400"}`} />
              {syncingRD ? "Sincronizando RD…" : "Atualizar RD"}
            </button>
          )}
          {rdSyncStatus !== "idle" && (
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-tighter ${
              rdSyncStatus === "success"
                ? "border-emerald-500/35 bg-emerald-950/40 text-emerald-300"
                : rdSyncStatus === "partial"
                ? "border-amber-500/35 bg-amber-950/40 text-amber-300"
                : "border-rose-500/35 bg-rose-950/40 text-rose-300"
            }`}>
              {rdSyncStatus === "success" ? <CheckCircle2 className="h-3 w-3" /> : rdSyncStatus === "partial" ? <AlertTriangle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {rdSyncStatus === "success"
                ? `Sincronizado: ${rdSyncSummary?.deals ?? 0} negócios`
                : rdSyncStatus === "partial"
                ? `Sincronização parcial: ${rdSyncSummary?.deals ?? 0} negócios`
                : `Falha ao sincronizar: ${rdSyncSummary?.error || "erro desconhecido"}`}
            </span>
          )}
        </header>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {metrics.map(({ label, value, icon: Icon, emphasis }) => (
            <article key={label} className={`min-w-0 rounded-xl border p-2.5 sm:p-3 ${emphasis ? "border-sky-400/60 bg-[#0b2a54]" : "border-primary/20 bg-[#07172f]/80"}`}>
              <div className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-sky-400 sm:h-4 sm:w-4" />
                <span className="truncate" title={label}>{label}</span>
              </div>
              <strong className="mt-2 block truncate text-base font-black tabular-nums text-white sm:text-lg lg:text-xl" title={value}>{value}</strong>
            </article>
          ))}
        </div>

        {/* 2. PIPELINE / FUNIL DE LEADS VERTICAL EM FORMATO DE FUNIL REAL (TRAPÉZIO DECRESCENTE) */}
        <div className="mt-6 rounded-xl border border-primary/20 bg-[#07172f]/75 p-5 sm:p-7">
          <div className="mb-6 flex min-w-0 items-center justify-between border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2.5">
              <Filter className="h-6 w-6 shrink-0 text-sky-400 stroke-[2.5]" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-black tracking-tight text-white sm:text-lg">
                  Pipeline / Funil de leads
                </h2>
              </div>
            </div>
            <span className="h-[2px] w-24 bg-gradient-to-r from-emerald-400 to-sky-400 rounded-full" />
          </div>

          {/* Etapas empilhadas verticalmente com largura decrescente em trapézio real */}
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2 py-2">
            {pipelineStages.map(({ id, label, count, Icon, className: stageClass }, idx) => {
              // Escala de larguras decrescentes em trapézio: 100% -> 92% -> 84% -> 76% -> 68% -> 60%
              const widths = ["w-full", "w-[92%]", "w-[84%]", "w-[76%]", "w-[68%]", "w-[60%]"];
              const widthClass = widths[idx] || "w-[60%]";

              return (
                <article
                  key={id}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-5 py-3 shadow-md transition hover:scale-[1.01] ${widthClass} ${stageClass}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-sky-300" />
                    <span className="truncate text-xs font-black uppercase tracking-wider text-white sm:text-sm">
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 border-l border-white/20 pl-4">
                    <strong className="text-lg font-black tabular-nums text-white sm:text-xl lg:text-2xl">
                      {formatInteger(count)}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="mt-5 border-t border-white/10 pt-3 text-center text-[10px] italic text-slate-500">
          Dados reais consolidados da campanha e do CRM para a conta selecionada.
        </footer>
      </div>
    </section>
  );
}
