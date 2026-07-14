import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAlerts, useMarkAlertRead } from "@/hooks/useAlerts";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaignDiagnostics, type CampaignDiagnostic } from "@/hooks/useCampaignDiagnostics";
import { useLastTopUp } from "@/hooks/useCampaignTargets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSeverityColor, getSeverityIcon } from "@/lib/metrics";
import { Bell, Check, AlertTriangle, AlertCircle, Info, ChevronDown, Wallet, ArrowUpCircle } from "lucide-react";
import { format, parseISO, nextMonday, differenceInDays, isMonday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";

function LastTopUpInline({ accountId }: { accountId: string }) {
  const { data } = useLastTopUp(accountId);
  if (!data) return <span className="text-[11px] text-muted-foreground italic">Nenhum aporte registrado</span>;
  return (
    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
      <ArrowUpCircle className="h-3 w-3 text-emerald-500" />
      Último aporte: <strong className="text-foreground">R$ {Number(data.delta).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> em <strong className="text-foreground">{format(parseISO(data.event_at),"dd/MM/yyyy",{locale:ptBR})}</strong>
    </span>
  );
}

type CampaignHealth = CampaignDiagnostic;

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { data: dbAlerts = [] } = useAlerts(false);
  const markRead = useMarkAlertRead();
  const { data: adAccounts = [] } = useAdAccounts();
  const { data: campaignHealthData = [] } = useCampaignDiagnostics();

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const criticalCampaigns = useMemo(() => campaignHealthData.filter((c) => c.status === "critical"), [campaignHealthData]);
  const warningCampaigns = useMemo(() => campaignHealthData.filter((c) => c.status === "warning"), [campaignHealthData]);
  const observationCampaigns = useMemo(() => campaignHealthData.filter((c) => c.status === "observation"), [campaignHealthData]);
  const initialCampaigns = useMemo(() => campaignHealthData.filter((c) => c.status === "initial"), [campaignHealthData]);
  const healthyCampaigns = useMemo(() => campaignHealthData.filter((c) => c.status === "healthy"), [campaignHealthData]);
  const inactiveCampaigns = useMemo(() => campaignHealthData.filter((c) => c.status === "inactive"), [campaignHealthData]);

  // Budget analysis per BM
  const { data: dailySpendByAccount = [] } = useQuery({
    queryKey: ["daily_spend_by_account"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("insights")
        .select(`spend, date, ads!inner(adsets!inner(campaigns!inner(ad_account_id)))`)
        .gte("date", sevenDaysAgo);
      if (error) throw error;

      const byAccount: Record<string, { dates: Record<string, number> }> = {};
      for (const row of data || []) {
        const accId = (row as any).ads?.adsets?.campaigns?.ad_account_id;
        if (!accId) continue;
        if (!byAccount[accId]) byAccount[accId] = { dates: {} };
        const d = (row as any).date;
        byAccount[accId].dates[d] = (byAccount[accId].dates[d] || 0) + ((row as any).spend ?? 0);
      }

      return Object.entries(byAccount).map(([accountId, info]) => {
        const dailySpends = Object.values(info.dates);
        const avgDailySpend = dailySpends.length > 0 ? dailySpends.reduce((a, b) => a + b, 0) / dailySpends.length : 0;
        return { accountId, avgDailySpend };
      });
    },
  });

  const budgetAnalysis = useMemo(() => {
    const today = new Date();
    const monday = isMonday(today) ? new Date(today.getTime() + 7 * 86400000) : nextMonday(today);
    const daysUntilMonday = differenceInDays(monday, today);

    return adAccounts
      .filter((acc) => acc.daily_budget != null || acc.remaining_balance != null)
      .map((acc) => {
        const spendData = dailySpendByAccount.find((s) => s.accountId === acc.id);
        const avgDailySpend = spendData?.avgDailySpend ?? 0;
        const dailyBudget = acc.daily_budget ? Number(acc.daily_budget) : null;
        const balance = acc.remaining_balance ? Number(acc.remaining_balance) : null;

        const isOverBudget = dailyBudget != null && avgDailySpend > dailyBudget;
        const projectedSpendUntilMonday = avgDailySpend * daysUntilMonday;
        const balanceLastsUntilMonday = balance != null ? balance >= projectedSpendUntilMonday : null;
        const daysBalanceLasts = balance != null && avgDailySpend > 0 ? Math.floor(balance / avgDailySpend) : null;

        let severity: "critical" | "warning" | "info" = "info";
        const reasons: string[] = [];
        let summary = "";

        if (isOverBudget) {
          severity = "critical";
          reasons.push(`Gasto médio diário (R$ ${avgDailySpend.toFixed(2)}) ultrapassa o orçamento definido (R$ ${dailyBudget!.toFixed(2)})`);
        }

        if (balance != null && balanceLastsUntilMonday === false) {
          severity = "critical";
          reasons.push(`Saldo de R$ ${balance.toFixed(2)} não vai durar até segunda-feira (precisa de R$ ${projectedSpendUntilMonday.toFixed(2)})`);
          if (daysBalanceLasts != null) {
            reasons.push(`O saldo dura apenas mais ${daysBalanceLasts} dia(s) com base no gasto médio diário`);
          }
        }

        if (severity === "info" && balance != null && daysBalanceLasts != null && daysBalanceLasts <= 10) {
          severity = "warning";
          reasons.push(`Saldo restante para apenas ${daysBalanceLasts} dias — considere reabastecer em breve`);
        }

        if (severity === "critical") {
          summary = `⚠️ A conta "${acc.name}" está em situação crítica de orçamento. ${reasons[0]}. Recomenda-se reabastecer o saldo antes de segunda-feira.`;
        } else if (severity === "warning") {
          summary = `A conta "${acc.name}" precisa de atenção. ${reasons[0]}.`;
        } else {
          if (dailyBudget != null) reasons.push(`Gasto médio diário (R$ ${avgDailySpend.toFixed(2)}) está dentro do orçamento (R$ ${dailyBudget.toFixed(2)})`);
          if (balance != null && daysBalanceLasts != null) reasons.push(`Saldo suficiente para ${daysBalanceLasts} dias`);
          summary = `A conta "${acc.name}" está com orçamento saudável.`;
        }

        return {
          id: acc.id, name: acc.name, dailyBudget, balance, avgDailySpend,
          projectedSpendUntilMonday, balanceLastsUntilMonday, daysBalanceLasts,
          daysUntilMonday, severity, reasons, summary,
        };
      });
  }, [adAccounts, dailySpendByAccount]);

  // Budget alerts for alert history
  const budgetAlerts = useMemo(() => {
    return budgetAnalysis.map((b) => ({
      id: `budget-${b.id}`,
      severity: b.severity,
      message: `Orçamento: ${b.name}`,
      summary: b.summary,
      reasons: b.reasons,
      accountName: b.name,
      alert_type: b.severity === "critical" ? "Orçamento Crítico" : b.severity === "warning" ? "Orçamento em Atenção" : "Orçamento OK",
      is_read: false,
      isGenerated: true,
    }));
  }, [budgetAnalysis]);

  const generatedAlerts = useMemo(() => {
    return campaignHealthData
      .filter((c) => c.status === "critical" || c.status === "warning" || c.status === "observation")
      .map((c) => {
        const severity = c.status === "critical" ? "critical" : c.status === "warning" ? "warning" : "info";
        const labelMap: Record<string, string> = {
          critical: "Campanha Crítica",
          warning: "Campanha em Atenção",
          observation: "Campanha em Observação",
        };
        return {
          id: `gen-${c.id}`,
          severity, message: c.name, summary: c.summary, reasons: c.reasons,
          accountName: c.accountName,
          alert_type: labelMap[c.status] || "Campanha",
          is_read: false, isGenerated: true,
        };
      });
  }, [campaignHealthData]);

  const allAlerts = useMemo(() => {
    const fromDb = dbAlerts.map((a) => ({ ...a, summary: "", reasons: [] as string[], accountName: "", isGenerated: false }));
    return [...budgetAlerts, ...generatedAlerts, ...fromDb];
  }, [budgetAlerts, generatedAlerts, dbAlerts]);

  const filtered = useMemo(() => {
    if (severityFilter === "all") return allAlerts;
    return allAlerts.filter((a) => a.severity === severityFilter);
  }, [allAlerts, severityFilter]);

  const CampaignStatusSection = ({ title, icon, campaigns, borderClass }: { title: string; icon: React.ReactNode; campaigns: CampaignHealth[]; borderClass: string }) => {
    if (campaigns.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">{campaigns.length}</Badge>
        </div>
        <div className="grid gap-2">
          {campaigns.map((c) => {
            const badgeMap: Record<string, { label: string; color: string }> = {
              critical: { label: "Crítico", color: "border-red-500/30 text-red-600" },
              warning: { label: "Atenção", color: "border-amber-500/30 text-amber-600" },
              observation: { label: "Observação", color: "border-blue-500/30 text-blue-600" },
              initial: { label: "Estado inicial", color: "border-violet-500/30 text-violet-600" },
              healthy: { label: "Saudável", color: "border-emerald-500/30 text-emerald-600" },
              inactive: { label: "Inativa", color: "border-muted-foreground/30 text-muted-foreground" },
            };
            const badge = badgeMap[c.status] || badgeMap.healthy;
            const isExpanded = expandedCards.has(c.id);
            const ageStr = c.isActive
              ? c.hoursActive < 48
                ? `Ativa há ${Math.round(c.hoursActive)}h`
                : `Ativa há ${c.daysActive.toFixed(1)}d`
              : "Inativa";
            const since = c.lastActivatedAt
              ? format(parseISO(c.lastActivatedAt), "dd/MM HH:mm", { locale: ptBR })
              : c.cycleStartDate
              ? format(parseISO(c.cycleStartDate), "dd/MM", { locale: ptBR })
              : null;
            return (
              <div key={c.id} className={`rounded-lg border p-3 md:p-4 overflow-hidden min-w-0 transition-all duration-300 hover:shadow-md ${borderClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Conta: {c.accountName} · Alvo CPL: R$ {c.effectiveTargetCpl.toFixed(2)} · {ageStr}
                      {since ? ` · desde ${since}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${badge.color}`}>{badge.label}</Badge>
                </div>

                {c.status === "critical" && (c.worstAd || c.worstAdset) && (
                  <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-700 dark:text-red-400 space-y-0.5">
                    {c.worstAdset && <div>🚨 Conjunto a revisar: <strong>{c.worstAdset.name}</strong> · CPL R$ {isFinite(c.worstAdset.cpl) ? c.worstAdset.cpl.toFixed(2) : "—"} · gasto R$ {c.worstAdset.spend.toFixed(2)}</div>}
                    {c.worstAd && <div>🎯 Anúncio a revisar: <strong>{c.worstAd.name}</strong> · CPL R$ {isFinite(c.worstAd.cpl) ? c.worstAd.cpl.toFixed(2) : "—"} · gasto R$ {c.worstAd.spend.toFixed(2)}</div>}
                  </div>
                )}

                {/* Metrics: grid on mobile, inline on desktop */}
                <div className="hidden md:flex items-center gap-3 text-xs mt-2">
                  <div className="text-right">
                    <p className="text-muted-foreground">Investido</p>
                    <p className="font-semibold tabular-nums"><AnimatedNumber value={c.spend} prefix="R$ " decimals={2} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Leads</p>
                    <p className="font-semibold tabular-nums"><AnimatedNumber value={c.leads} decimals={0} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">CPL</p>
                    <p className="font-semibold tabular-nums"><AnimatedNumber value={c.cpl} prefix="R$ " decimals={2} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">CTR</p>
                    <p className="font-semibold tabular-nums"><AnimatedNumber value={c.ctr} suffix="%" decimals={2} /></p>
                  </div>
                </div>

                {/* Mobile: Ver detalhes button */}
                <div className="md:hidden mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs h-8 px-2"
                    onClick={() => toggleExpand(c.id)}
                  >
                    <span>Ver detalhes</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </Button>

                  {isExpanded && (
                    <div className="mt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-background/50 p-2">
                          <p className="text-muted-foreground">Investido</p>
                          <p className="font-semibold tabular-nums"><AnimatedNumber value={c.spend} prefix="R$ " decimals={2} /></p>
                        </div>
                        <div className="rounded-md bg-background/50 p-2">
                          <p className="text-muted-foreground">Leads</p>
                          <p className="font-semibold tabular-nums"><AnimatedNumber value={c.leads} decimals={0} /></p>
                        </div>
                        <div className="rounded-md bg-background/50 p-2">
                          <p className="text-muted-foreground">CPL</p>
                          <p className="font-semibold tabular-nums"><AnimatedNumber value={c.cpl} prefix="R$ " decimals={2} /></p>
                        </div>
                        <div className="rounded-md bg-background/50 p-2">
                          <p className="text-muted-foreground">CTR</p>
                          <p className="font-semibold tabular-nums"><AnimatedNumber value={c.ctr} suffix="%" decimals={2} /></p>
                        </div>
                      </div>
                      {/* Diagnostic on mobile */}
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs leading-relaxed">{c.summary}</p>
                        {c.reasons.length > 1 && (
                          <ul className="mt-2 space-y-1">
                            {c.reasons.map((r, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="mt-0.5">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop: always show diagnostic */}
                <div className="hidden md:block mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs leading-relaxed">{c.summary}</p>
                  {c.reasons.length > 1 && (
                    <ul className="mt-2 space-y-1">
                      {c.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <MotionPage className="space-y-6 min-w-0 overflow-hidden">
      <MotionItem>
        <h1 className="text-2xl font-bold">Alertas</h1>
        <p className="text-sm text-muted-foreground mt-1">Status das campanhas e alertas automáticos</p>
      </MotionItem>

      {/* Campaign Health Status */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Status das Campanhas</h2>
        {campaignHealthData.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Info className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma campanha com dados encontrada</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <CampaignStatusSection
              title="Crítico"
              icon={<AlertCircle className="h-4 w-4 text-red-500" />}
              campaigns={criticalCampaigns}
              borderClass="border-red-500/20 bg-red-500/5"
            />
            <CampaignStatusSection
              title="Atenção"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              campaigns={warningCampaigns}
              borderClass="border-amber-500/20 bg-amber-500/5"
            />
            <CampaignStatusSection
              title="Observação"
              icon={<Info className="h-4 w-4 text-blue-500" />}
              campaigns={observationCampaigns}
              borderClass="border-blue-500/20 bg-blue-500/5"
            />
            <CampaignStatusSection
              title="Estado inicial"
              icon={<Info className="h-4 w-4 text-violet-500" />}
              campaigns={initialCampaigns}
              borderClass="border-violet-500/20 bg-violet-500/5"
            />
            <CampaignStatusSection
              title="Saudável"
              icon={<Check className="h-4 w-4 text-emerald-500" />}
              campaigns={healthyCampaigns}
              borderClass="border-emerald-500/20 bg-emerald-500/5"
            />
            <CampaignStatusSection
              title="Inativas"
              icon={<Info className="h-4 w-4 text-muted-foreground" />}
              campaigns={inactiveCampaigns}
              borderClass="border-muted-foreground/20 bg-muted/20"
            />
          </div>
        )}
      </div>

      {/* Budget Analysis */}
      {budgetAnalysis.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Análise de Orçamento por Conta</h2>
          </div>
          <div className="grid gap-2">
            {budgetAnalysis.map((b) => {
              const borderClass = b.severity === "critical" ? "border-red-500/20 bg-red-500/5" : b.severity === "warning" ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5";
              const severityIcon = b.severity === "critical" ? <AlertCircle className="h-4 w-4 text-red-500" /> : b.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <Check className="h-4 w-4 text-emerald-500" />;
              const isExpanded = expandedCards.has(`budget-${b.id}`);
              return (
                <div key={b.id} className={`rounded-lg border p-3 md:p-4 overflow-hidden min-w-0 transition-all duration-300 hover:shadow-md ${borderClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {severityIcon}
                        <p className="font-medium text-sm truncate">{b.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {b.severity === "critical" ? "Crítico" : b.severity === "warning" ? "Atenção" : "OK"}
                    </Badge>
                  </div>

                  <div className="hidden md:grid md:grid-cols-4 gap-3 text-xs mt-3">
                    {b.dailyBudget != null && (
                      <div>
                        <p className="text-muted-foreground">Orçamento/dia</p>
                        <p className="font-semibold tabular-nums"><AnimatedNumber value={b.dailyBudget} prefix="R$ " decimals={2} /></p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Gasto médio/dia</p>
                      <p className="font-semibold tabular-nums"><AnimatedNumber value={b.avgDailySpend} prefix="R$ " decimals={2} /></p>
                    </div>
                    {b.balance != null && (
                      <div>
                        <p className="text-muted-foreground">Saldo restante</p>
                        <p className="font-semibold tabular-nums"><AnimatedNumber value={b.balance} prefix="R$ " decimals={2} /></p>
                      </div>
                    )}
                    {b.daysBalanceLasts != null && (
                      <div>
                        <p className="text-muted-foreground">Saldo dura</p>
                        <p className="font-semibold tabular-nums"><AnimatedNumber value={b.daysBalanceLasts} decimals={0} suffix=" dia(s)" /></p>
                      </div>
                    )}
                  </div>

                  {/* Desktop summary */}
                  <div className="hidden md:block mt-3 pt-3 border-t border-border/50 space-y-1.5">
                    <LastTopUpInline accountId={b.id} />
                    <p className="text-xs leading-relaxed">{b.summary}</p>
                    {b.reasons.length > 1 && (
                      <ul className="mt-2 space-y-1">
                        {b.reasons.map((r, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="mt-0.5">•</span><span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Mobile expandable */}
                  <div className="md:hidden mt-2">
                    <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 px-2" onClick={() => toggleExpand(`budget-${b.id}`)}>
                      <span>Ver detalhes</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </Button>
                    {isExpanded && (
                      <div className="mt-2 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {b.dailyBudget != null && (
                            <div className="rounded-md bg-background/50 p-2">
                              <p className="text-muted-foreground">Orçamento/dia</p>
                              <p className="font-semibold tabular-nums"><AnimatedNumber value={b.dailyBudget} prefix="R$ " decimals={2} /></p>
                            </div>
                          )}
                          <div className="rounded-md bg-background/50 p-2">
                            <p className="text-muted-foreground">Gasto médio/dia</p>
                            <p className="font-semibold tabular-nums"><AnimatedNumber value={b.avgDailySpend} prefix="R$ " decimals={2} /></p>
                          </div>
                          {b.balance != null && (
                            <div className="rounded-md bg-background/50 p-2">
                              <p className="text-muted-foreground">Saldo restante</p>
                              <p className="font-semibold tabular-nums"><AnimatedNumber value={b.balance} prefix="R$ " decimals={2} /></p>
                            </div>
                          )}
                          {b.daysBalanceLasts != null && (
                            <div className="rounded-md bg-background/50 p-2">
                              <p className="text-muted-foreground">Saldo dura</p>
                              <p className="font-semibold tabular-nums"><AnimatedNumber value={b.daysBalanceLasts} decimals={0} suffix=" dia(s)" /></p>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs leading-relaxed">{b.summary}</p>
                          {b.reasons.length > 1 && (
                            <ul className="mt-2 space-y-1">
                              {b.reasons.map((r, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="mt-0.5">•</span><span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alert History */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Histórico de Alertas</h2>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-card">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="critical">🔴 Crítico</SelectItem>
              <SelectItem value="warning">🟡 Atenção</SelectItem>
              <SelectItem value="info">🟢 Informativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum alerta encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-3 md:p-4 transition-opacity ${getSeverityColor(alert.severity)} ${alert.is_read ? "opacity-60" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-lg shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">{alert.message}</p>
                      {alert.isGenerated && alert.accountName && (
                        <p className="text-xs text-muted-foreground">Conta: {alert.accountName}</p>
                      )}
                      <p className="text-xs opacity-70 mt-0.5">
                        {alert.alert_type}
                        {"created_at" in alert && alert.created_at && !alert.isGenerated && (
                          <> · {format(parseISO(alert.created_at as string), "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
                        )}
                      </p>
                      {alert.summary && (
                        <p className="text-xs mt-2 leading-relaxed opacity-80">{alert.summary}</p>
                      )}
                      {alert.reasons && alert.reasons.length > 1 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {alert.reasons.map((r: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {!alert.is_read && !alert.isGenerated && (
                    <Button variant="ghost" size="sm" className="shrink-0 self-start" onClick={() => markRead.mutate(alert.id)}>
                      <Check className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Marcar lido</span>
                      <span className="sm:hidden">Lido</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MotionPage>
  );
}
