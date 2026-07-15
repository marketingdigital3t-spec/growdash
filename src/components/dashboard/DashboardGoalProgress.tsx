import { ArrowUpRight, Settings2, Target } from "lucide-react";
import { Link } from "react-router-dom";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  realized: number;
  target: number;
  accountLabel: string;
  schemaReady: boolean;
  loading?: boolean;
}

export function DashboardGoalProgress({ realized, target, accountLabel, schemaReady, loading }: Props) {
  const percentage = target > 0 ? realized / target * 100 : 0;
  const remaining = Math.max(target - realized, 0);
  return <section className="overflow-hidden rounded-xl border border-[#4a3513] bg-[#0d0c0b] text-white shadow-[0_8px_28px_rgba(0,0,0,.2)]">
    <div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Target className="h-4 w-4" /></span><div className="min-w-0 grow"><p className="truncate text-[10px] font-black uppercase tracking-[.12em] text-primary" title={accountLabel}>{accountLabel}</p><p className="text-xs text-white/70">{loading ? "Calculando meta…" : target > 0 ? percentage >= 100 ? "Meta superada — excelente ritmo" : "Você está avançando para bater a meta" : "Defina a meta mensal nas Configurações"}</p></div>{target > 0 && <div className="shrink-0 text-right"><b className="block text-sm text-primary">{percentage.toFixed(1)}%</b><span className="text-[9px] text-white/45">{remaining > 0 ? `${brl.format(remaining)} restantes` : `${brl.format(realized - target)} acima`}</span></div>}</div>
      <div className="relative h-2.5 overflow-hidden rounded-full border border-white/5 bg-white/[.07]">{target > 0 && <div className="gold-meter h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }} />}</div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-[10px]"><span className="text-white/55">Realizado <b className="text-white">{brl.format(realized)}</b></span><span className="text-white/55">Meta <b className="text-white">{target > 0 ? brl.format(target) : "Não configurada"}</b></span>{(!schemaReady || target <= 0) && <Link to="/configuracoes#sales-goals" className="inline-flex items-center gap-1 font-black text-primary hover:underline"><Settings2 className="h-3 w-3" />Configurar metas<ArrowUpRight className="h-3 w-3" /></Link>}</div>
    </div>
  </section>;
}

