import { CalendarDays, PiggyBank, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WeeklyInvestmentRow } from "@/lib/weeklyTrafficInvestment";

interface Props {
  rows: WeeklyInvestmentRow[];
  /** Texto do switch global de imposto Meta, para deixar a premissa visível. */
  taxNote: string;
  className?: string;
}

const fmtBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Investimento em trafego por semana: quanto foi investido, a meta da
 * semana, o percentual alcancado e quanto foi colocado na conta.
 *
 * Colocado e investido sao numeros diferentes e aparecem lado a lado: o
 * primeiro e o aporte que entrou na conta Meta, o segundo e o gasto real.
 */
export function WeeklyInvestmentPanel({ rows, taxNote, className = "" }: Props) {
  if (!rows.length) {
    return (
      <Card className={cn("gd-panel border-border/60 bg-card/70", className)}>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Sem dados de investimento por semana neste recorte.
        </CardContent>
      </Card>
    );
  }

  const totalInvested = rows.reduce((sum, row) => sum + row.invested, 0);
  const totalDeposited = rows.reduce((sum, row) => sum + row.deposited, 0);
  const totalTarget = rows.find((row) => row.target !== null)?.target ?? null;
  const totalPercentual = totalTarget ? (totalInvested / (totalTarget * rows.length)) * 100 : null;

  return (
    <Card className={cn("gd-panel overflow-hidden border-border/60 bg-card/70 backdrop-blur", className)}>
      <CardContent className="space-y-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-black">Investimento em tráfego por semana</h2>
              <p className="text-[11px] text-muted-foreground">{taxNote}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              Investido <b className="tabular-nums text-foreground">{fmtBRL(totalInvested)}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PiggyBank className="h-3.5 w-3.5 text-primary-soft" />
              Colocado <b className="tabular-nums text-foreground">{fmtBRL(totalDeposited)}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              {totalPercentual === null
                ? "Sem meta"
                : `${totalPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da meta`}
            </span>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-bold">Semana</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Investido</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Bruto</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Colocado</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Meta</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">% da meta</th>
                <th scope="col" className="py-2 text-right font-bold">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const acima = row.difference !== null && row.difference >= 0;
                return (
                  <tr key={row.label} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-foreground">{row.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground">{fmtBRL(row.invested)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{fmtBRL(row.investedRaw)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {fmtBRL(row.deposited)}
                      {row.depositedPending > 0 && (
                        <span className="ml-1 text-[10px] text-amber-500">
                          +{fmtBRL(row.depositedPending)} pend.
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {row.target === null ? "—" : fmtBRL(row.target)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                      {row.goalPercentage === null
                        ? "—"
                        : `${row.goalPercentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        row.difference === null
                          ? "text-muted-foreground"
                          : acima
                            ? "text-emerald-500"
                            : "text-rose-400",
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {row.difference !== null && (acima ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                        {row.difference === null ? "—" : fmtBRL(Math.abs(row.difference))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
