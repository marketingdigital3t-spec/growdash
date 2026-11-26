import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBudgetHistory } from "@/hooks/useBudgetHistory";
import { useNextTopUpEstimate } from "@/hooks/useCampaignTargets";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, CalendarClock, Plus, RefreshCw, TrendingDown, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { AddTopUpDialog } from "./AddTopUpDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  startDate: Date;
  endDate: Date;
}

const fmtBRL = (v: number) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return fmtBRL(v);
};

export function BudgetDetailSheet({ open, onOpenChange, accountId, accountName, startDate, endDate }: Props) {
  const { data, isLoading } = useBudgetHistory(open ? accountId : undefined, startDate, endDate);
  const { data: nextEstimate } = useNextTopUpEstimate(open ? accountId : undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const runSync = async (silent = false) => {
    setSyncing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("sync-meta-transactions", {
        body: { ad_account_id: accountId },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["budget_history"] });
      if (!silent) {
        const n = (res as any)?.upserted ?? 0;
        toast.success(`Aportes sincronizados (${n} transações)`);
      }
    } catch (e: any) {
      if (!silent) toast.error(`Erro ao sincronizar: ${e.message ?? e}`);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync ao abrir o sheet
  useEffect(() => {
    if (open && accountId) {
      runSync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  const topUps = data?.topUps ?? [];
  const days = data?.days ?? [];
  const totals = data?.totals;

  const chartData = days.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "dd/MM"),
    spend: d.spend,
    balance: d.balance,
    topUps: d.topUps,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="h-4 w-4 text-primary shrink-0" />
              <SheetTitle className="text-base truncate">{accountName}</SheetTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5 shrink-0"
              onClick={() => runSync(false)}
              disabled={syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Período: <strong className="text-foreground">{format(startDate, "dd 'de' MMM", { locale: ptBR })}</strong>
            {" — "}
            <strong className="text-foreground">{format(endDate, "dd 'de' MMM yyyy", { locale: ptBR })}</strong>
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              className="grid grid-cols-2 gap-2"
            >
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total aportado</p>
                <p className="text-sm font-semibold text-emerald-500 tabular-nums">
                  {totals ? fmtBRL(totals.topUpSum) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total gasto</p>
                <p className="text-sm font-semibold tabular-nums">
                  {totals ? fmtBRL(totals.spendSum) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo final do período</p>
                <p className="text-sm font-semibold tabular-nums">
                  {totals?.finalBalance != null ? fmtBRL(totals.finalBalance) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo atual (Meta)</p>
                <p className="text-sm font-semibold text-primary tabular-nums">
                  {totals?.currentBalance != null ? fmtBRL(totals.currentBalance) : "—"}
                </p>
              </div>
            </motion.div>

            {/* Aportes list */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                  Aportes no período
                  <Badge variant="outline" className="text-[10px] ml-1">{topUps.length}</Badge>
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Registrar aporte
                </Button>
              </div>

              {isLoading ? (
                <p className="text-xs text-muted-foreground italic">Carregando...</p>
              ) : topUps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed border-border/60 rounded-lg">
                  Nenhum aporte registrado nesse período
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {topUps.map((t, i) => {
                    const prev = i > 0 ? topUps[i - 1] : null;
                    const gapDays = prev ? differenceInCalendarDays(parseISO(t.date), parseISO(prev.date)) : null;
                    return (
                      <motion.li
                        key={`${t.date}-${i}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.03 }}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">
                              {format(parseISO(t.date), "EEE, dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {t.paymentMethod && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                                  {t.paymentMethod}
                                </Badge>
                              )}
                              {t.status && (
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1.5 py-0 h-4 font-normal ${
                                    /paid|success|complet/i.test(t.status)
                                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                      : /fund/i.test(t.status)
                                      ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                                      : ""
                                  }`}
                                >
                                  {/paid/i.test(t.status) ? "Pago" : /fund/i.test(t.status) ? "Com fundos" : t.status}
                                </Badge>
                              )}
                              {gapDays != null && (
                                <span className="text-[10px] text-muted-foreground">+{gapDays}d</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-emerald-500 tabular-nums shrink-0">
                          +{fmtBRL(t.amount)}
                        </p>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </section>


            {/* Chart */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                Investimento diário e aportes
              </h3>
              <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                {days.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-8 text-center">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        interval="preserveStartEnd"
                        minTickGap={20}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => fmtCompact(Number(v))}
                        width={56}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => fmtCompact(Number(v))}
                        width={56}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(label, payload) => {
                          const p = payload?.[0]?.payload;
                          if (!p) return label as string;
                          return format(parseISO(p.date), "EEE, dd 'de' MMM", { locale: ptBR });
                        }}
                        formatter={(value: number | string, name: string) => {
                          const v = Number(value);
                          if (name === "Gasto") return [fmtBRL(v), name];
                          if (name === "Saldo") return [fmtBRL(v), name];
                          if (name === "Aporte") return [`+${fmtBRL(v)}`, name];
                          return [v, name];
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="spend"
                        name="Gasto"
                        fill="hsl(var(--primary))"
                        opacity={0.7}
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="balance"
                        name="Saldo"
                        stroke="hsl(var(--chart-2, var(--primary)))"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      {topUps.map((t, i) => {
                        const lbl = format(parseISO(t.date), "dd/MM");
                        return (
                          <ReferenceLine
                            key={`tu-${i}`}
                            yAxisId="left"
                            x={lbl}
                            stroke="hsl(142 76% 45%)"
                            strokeDasharray="4 3"
                            label={{
                              value: `+${fmtCompact(t.amount)}`,
                              position: "top",
                              fill: "hsl(142 76% 45%)",
                              fontSize: 9,
                            }}
                          />
                        );
                      })}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-primary opacity-70" /> Gasto diário
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-3 bg-primary" /> Saldo estimado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-px border-l border-dashed border-emerald-500" /> Aporte
                </span>
              </div>
            </section>

            {/* Next top-up */}
            {nextEstimate?.hasEnoughHistory && nextEstimate.estimatedDate && (
              <section className="rounded-lg border border-border/60 bg-card/40 p-3 flex items-center gap-2 text-xs">
                <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                <p>
                  Próxima recarga estimada:{" "}
                  <strong className="text-foreground">
                    ~ {format(nextEstimate.estimatedDate, "dd/MM/yyyy", { locale: ptBR })}
                  </strong>
                  {" · "}
                  <strong className="text-foreground">{fmtBRL(nextEstimate.avgAmount)}</strong>
                </p>
              </section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
      <AddTopUpDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        accountId={accountId}
        accountName={accountName}
      />
    </Sheet>
  );
}
