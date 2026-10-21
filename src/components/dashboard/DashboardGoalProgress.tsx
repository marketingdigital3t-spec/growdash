import { Award, ArrowUpRight, PartyPopper, Settings2, Target } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { goalColorForPercentage, goalPercentage, goalProgress, goalRevenueDisplayState } from "@/lib/monthlyGoal";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  realized: number;
  target: number;
  accountLabel: string;
  schemaReady: boolean;
  loading?: boolean;
  revenueLoading?: boolean;
  revenueError?: boolean;
  revenueSnapshotAvailable?: boolean;
}

function GoalAchievementPopup({ accountLabel, realized, target }: Pick<Props, "accountLabel" | "realized" | "target">) {
  if (target <= 0 || realized < target) return null;

  return <aside role="status" aria-live="polite" className="goal-achievement-popup fixed bottom-5 right-5 z-[70] w-[min(360px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-emerald-300/35 bg-[#101713]/95 p-4 text-white shadow-[0_22px_65px_rgba(0,0,0,.52)] backdrop-blur-xl">
    <div aria-hidden="true" className="goal-confetti">
      {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--confetti-index": index } as CSSProperties} />)}
    </div>
    <div className="relative flex gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/35"><PartyPopper className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">Meta mensal conquistada</p><h2 className="mt-1 text-base font-black">Parabéns! Meta batida.</h2><p className="mt-1 text-xs leading-relaxed text-white/68">{accountLabel}. Você chegou a {brl.format(realized)} de {brl.format(target)} neste mês.</p></div>
    </div>
    <div className="relative mt-3 flex items-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-400/[.08] px-3 py-2 text-[11px] font-semibold text-emerald-100"><Award className="h-3.5 w-3.5 shrink-0" />Acompanhe o excedente até o próximo ciclo mensal.</div>
  </aside>;
}

export function DashboardGoalProgress({ realized, target, accountLabel, schemaReady, loading, revenueLoading = false, revenueError = false, revenueSnapshotAvailable = true }: Props) {
  const percentage = goalPercentage(realized, target);
  const barProgress = goalProgress(realized, target);
  const remaining = Math.max(target - realized, 0);
  const revenueState = goalRevenueDisplayState({ loading: revenueLoading, error: revenueError, snapshot: revenueSnapshotAvailable });
  const revenuePending = revenueState === "pending";
  const revenueUnavailable = revenueState === "unavailable";
  const revenueVisible = revenueState === "ready" || revenueState === "stale";
  return <section className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_8px_28px_rgba(0,0,0,.08)]">
    <div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Target className="h-4 w-4" /></span><div className="min-w-0 grow"><p className="truncate text-[10px] font-black uppercase tracking-[.12em] text-primary" title={accountLabel}>{accountLabel}</p><p className="text-xs text-muted-foreground">{revenueUnavailable ? "Faturamento indisponível" : revenuePending ? "Calculando faturamento…" : revenueError ? "Erro na atualização — último valor preservado" : loading ? "Calculando meta…" : target > 0 ? percentage >= 100 ? "Meta superada — excelente ritmo" : "Você está avançando para bater a meta" : "Defina a meta mensal nas Configurações"}</p></div>{target > 0 && revenueVisible && <div className="shrink-0 text-right"><b className="block text-sm text-primary">{percentage.toFixed(1)}%</b><span className="text-[9px] text-muted-foreground">{remaining > 0 ? `${brl.format(remaining)} restantes` : `${brl.format(realized - target)} acima`}</span></div>}</div>
      <div className="relative h-2.5 overflow-hidden rounded-full border border-border bg-muted" aria-label={revenueUnavailable ? "Faturamento indisponível" : revenuePending ? "Calculando faturamento" : `Progresso da meta: ${percentage.toFixed(1)}%`}>{target > 0 && revenueVisible && <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${barProgress}%`, backgroundColor: goalColorForPercentage(percentage) }} />}</div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-[10px]"><span className="text-muted-foreground">Realizado <b className="text-foreground">{revenueVisible ? brl.format(realized) : "—"}</b></span><span className="text-muted-foreground">Meta <b className="text-foreground">{target > 0 ? brl.format(target) : "Não configurada"}</b></span>{(!schemaReady || target <= 0) && <Link to="/configuracoes#sales-goals" className="inline-flex items-center gap-1 font-black text-primary hover:underline"><Settings2 className="h-3 w-3" />Configurar metas<ArrowUpRight className="h-3 w-3" /></Link>}</div>
    </div>
  </section>;
}

export function TopbarMonthlyGoal({ realized, target, accountLabel, schemaReady, loading, revenueLoading = false, revenueError = false, revenueSnapshotAvailable = true }: Props) {
  const safeRealized = Number.isFinite(realized) ? realized : 0;
  const safeTarget = Number.isFinite(target) ? target : 0;
  const percentage = goalPercentage(safeRealized, safeTarget);
  const barProgress = goalProgress(safeRealized, safeTarget);
  const remaining = Math.max(safeTarget - safeRealized, 0);
  const revenueState = goalRevenueDisplayState({ loading: revenueLoading, error: revenueError, snapshot: revenueSnapshotAvailable });
  const revenuePending = revenueState === "pending";
  const revenueUnavailable = revenueState === "unavailable";
  const revenueVisible = revenueState === "ready" || revenueState === "stale";
  return (
    <section className="min-w-0 grow" aria-label={accountLabel}>
      <div className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5">
        <Target className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 grow">
          <div className="flex min-w-0 items-center justify-between gap-2 text-[9px]">
            <span className="truncate font-black uppercase tracking-[.1em] text-primary" title={accountLabel}>{accountLabel}</span>
            {revenueUnavailable ? <span className="shrink-0 font-black text-white/75">Faturamento indisponível</span> : revenuePending ? <span className="shrink-0 font-black text-white/75">Calculando…</span> : safeTarget > 0 ? <span className="shrink-0 font-black text-white">{percentage.toFixed(1)}%</span> : <Link to="/configuracoes#sales-goals" className="shrink-0 font-black text-primary hover:underline" aria-label="Meta não configurada — configurar meta">Meta não configurada · Configurar</Link>}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-white/10 bg-white/[.08] shadow-inner" aria-label={revenueUnavailable ? "Faturamento indisponível" : revenuePending ? "Calculando faturamento" : `Progresso da meta: ${percentage.toFixed(1)}%`}>
            {safeTarget > 0 && revenueVisible && <div className="h-full rounded-full motion-reduce:transition-none transition-[width,background-color] duration-500 ease-out" style={{ width: `${barProgress}%`, backgroundColor: goalColorForPercentage(percentage) }} />}
          </div>
        </div>
        <div className="hidden shrink-0 text-right text-[9px] sm:block">
          <span className="block text-white/50">{revenueUnavailable ? "Faturamento indisponível" : revenuePending ? "Calculando faturamento…" : revenueError ? "Erro · último valor válido preservado" : loading && safeTarget <= 0 ? "Calculando…" : safeTarget > 0 ? `${brl.format(safeRealized)} de ${brl.format(safeTarget)}` : schemaReady ? "Meta não configurada" : "Migration pendente"}</span>
          {safeTarget > 0 && revenueVisible && <span className="block text-white/75">{remaining > 0 ? `${brl.format(remaining)} restantes` : `${brl.format(safeRealized - safeTarget)} acima`}</span>}
        </div>
      </div>
      {revenueVisible && <GoalAchievementPopup accountLabel={accountLabel} realized={safeRealized} target={safeTarget} />}
    </section>
  );
}
