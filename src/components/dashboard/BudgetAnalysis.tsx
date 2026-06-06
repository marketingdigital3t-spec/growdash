import { useState } from "react";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import { useLastTopUp, useNextTopUpEstimate } from "@/hooks/useCampaignTargets";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, AlertTriangle, CheckCircle, ArrowUpCircle, CalendarClock, History } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MotionCard } from "@/components/motion/MotionCard";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BudgetDetailSheet } from "./BudgetDetailSheet";

function LastTopUp({ accountId }: { accountId: string }) {
  const { data } = useLastTopUp(accountId);
  if (!data) {
    return <p className="text-[11px] text-muted-foreground italic">Nenhum aporte registrado ainda</p>;
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <ArrowUpCircle className="h-3 w-3 text-emerald-500" />
      <span>
        Último aporte: <strong className="text-foreground">R$ {Number(data.delta).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        {" "}em <strong className="text-foreground">{format(parseISO(data.event_at), "dd/MM/yyyy", { locale: ptBR })}</strong>
      </span>
    </div>
  );
}

function NextTopUpEstimate({ accountId }: { accountId: string }) {
  const { data } = useNextTopUpEstimate(accountId);
  if (!data || !data.hasEnoughHistory || !data.estimatedDate) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic">
        <CalendarClock className="h-3 w-3" />
        <span>Próxima recarga: histórico insuficiente</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <CalendarClock className="h-3 w-3 text-primary" />
      <span>
        Próxima recarga: <strong className="text-foreground">~ {format(data.estimatedDate, "dd/MM/yyyy", { locale: ptBR })}</strong>
        {" · "}<strong className="text-foreground">R$ {data.avgAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      </span>
    </div>
  );
}

const severityConfig = {
  critical: { icon: <AlertTriangle className="h-4 w-4 text-red-500" />, badge: "Crítico", badgeClass: "bg-red-500/10 text-red-600 border-red-500/20", borderClass: "border-red-500/30" },
  warning: { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, badge: "Atenção", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20", borderClass: "border-amber-500/30" },
  info: { icon: <CheckCircle className="h-4 w-4 text-emerald-500" />, badge: "OK", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", borderClass: "border-emerald-500/30" },
};

export function BudgetAnalysis() {
  const all = useBudgetAnalysis();
  const { adAccountId, startDate, endDate } = useDashboard();
  const [openId, setOpenId] = useState<string | null>(null);

  const analysis = adAccountId ? all.filter((a) => a.id === adAccountId) : all;

  if (analysis.length === 0) return null;

  const isSingle = !!adAccountId;
  const gridClass = isSingle
    ? "grid gap-3 grid-cols-1 max-w-xl"
    : "grid gap-3 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Análise de Orçamento por Conta</h2>
      </div>
      <motion.div
        className={gridClass}
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
        initial="hidden"
        animate="visible"
      >
        {analysis.map((item) => {
          const config = severityConfig[item.severity];
          const isUrgent =
            item.severity === "critical" &&
            ((item.balance != null && item.balance <= 0) ||
              (item.daysBalanceLasts != null && item.daysBalanceLasts <= 2));
          return (
            <motion.div
              key={item.id}
              variants={{
                hidden: { opacity: 0, scale: 0.95 },
                visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
              }}
            >
              <MotionCard>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(item.id);
                    }
                  }}
                  className={`cursor-pointer ${config.borderClass} border transition-colors hover:bg-card/70 ${
                    isUrgent ? "animate-pulse ring-2 ring-red-500/40 shadow-[0_0_24px_-4px_hsl(var(--destructive)/0.5)]" : ""
                  }`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={isUrgent ? "animate-pulse" : ""}>{config.icon}</span>
                        <p className="font-medium text-sm truncate">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label="Ver histórico de aportes"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(item.id);
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <Badge variant="outline" className={`text-[10px] ${config.badgeClass} ${isUrgent ? "animate-pulse" : ""}`}>{config.badge}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Orçamento diário (ativos)</p>
                        <p className="font-semibold tabular-nums">
                          <AnimatedNumber value={item.dailyBudgetActive} prefix="R$ " decimals={2} duration={600} />
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gasto médio/dia</p>
                        <p className="font-semibold tabular-nums">
                          <AnimatedNumber value={item.avgDailySpend} prefix="R$ " decimals={2} duration={600} />
                        </p>
                      </div>
                      {item.balance != null && (
                        <div>
                          <p className="text-muted-foreground">Saldo restante</p>
                          <p className="font-semibold tabular-nums">
                            <AnimatedNumber value={item.balance} prefix="R$ " decimals={2} duration={600} />
                          </p>
                        </div>
                      )}
                      {item.daysBalanceLasts != null && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Saldo dura</p>
                          <p className={`font-semibold tabular-nums ${isUrgent ? "text-red-500" : ""}`}>
                            <AnimatedNumber value={item.daysBalanceLasts} decimals={0} duration={600} suffix=" dia(s)" />
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 border-t border-border/50 space-y-1.5">
                      <NextTopUpEstimate accountId={item.id} />
                      <LastTopUp accountId={item.id} />
                      <p className="text-xs leading-relaxed">{item.summary}</p>
                    </div>
                  </CardContent>
                </Card>
              </MotionCard>
            </motion.div>
          );
        })}
      </motion.div>

      {analysis.map((item) => (
        <BudgetDetailSheet
          key={`sheet-${item.id}`}
          open={openId === item.id}
          onOpenChange={(o) => setOpenId(o ? item.id : null)}
          accountId={item.id}
          accountName={item.name}
          startDate={startDate}
          endDate={endDate}
        />
      ))}
    </div>
  );
}
