import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { isMonday, nextMonday, differenceInDays } from "date-fns";

export interface BudgetAnalysisItem {
  id: string;
  name: string;
  dailyBudget: number | null;
  dailyBudgetActive: number;
  balance: number | null;
  avgDailySpend: number;
  projectedSpendUntilMonday: number;
  balanceLastsUntilMonday: boolean | null;
  daysBalanceLasts: number | null;
  daysUntilMonday: number;
  severity: "critical" | "warning" | "info";
  reasons: string[];
  summary: string;
}

export function useBudgetAnalysis() {
  const { data: adAccounts = [] } = useAdAccounts();

  const { data: dailySpendByAccount = [] } = useQuery({
    queryKey: ["daily_spend_by_account"],
    queryFn: async () => {
      const { toLocalDateString } = await import("@/lib/dateRange");
      const sevenDaysAgo = toLocalDateString(new Date(Date.now() - 7 * 86400000));

      const { data, error } = await (supabase as any)
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

  const { data: dailyBudgetActiveByAccount = [] } = useQuery({
    queryKey: ["daily_budget_active_by_account"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("adsets")
        .select(`daily_budget, status, campaigns!inner(ad_account_id, status)`)
        .eq("status", "ACTIVE");
      if (error) throw error;
      const byAccount: Record<string, number> = {};
      for (const row of data || []) {
        const camp = (row as any).campaigns;
        if (!camp || camp.status !== "ACTIVE") continue;
        const accId = camp.ad_account_id;
        const db = Number((row as any).daily_budget ?? 0);
        if (!accId || !db) continue;
        byAccount[accId] = (byAccount[accId] || 0) + db;
      }
      return Object.entries(byAccount).map(([accountId, total]) => ({ accountId, total }));
    },
  });

  const analysis = useMemo((): BudgetAnalysisItem[] => {
    const today = new Date();
    const monday = isMonday(today) ? new Date(today.getTime() + 7 * 86400000) : nextMonday(today);
    const daysUntilMon = differenceInDays(monday, today);

    return adAccounts
      .filter((acc) => acc.daily_budget != null || acc.remaining_balance != null)
      .map((acc) => {
        const spendData = dailySpendByAccount.find((s) => s.accountId === acc.id);
        const avgDailySpend = spendData?.avgDailySpend ?? 0;
        const dailyBudget = acc.daily_budget != null ? Number(acc.daily_budget) : null;
        const dailyBudgetActive = dailyBudgetActiveByAccount.find((s) => s.accountId === acc.id)?.total ?? 0;
        const balance = acc.remaining_balance != null ? Number(acc.remaining_balance) : null;

        const isOverBudget = dailyBudget != null && avgDailySpend > dailyBudget;
        const projectedSpendUntilMonday = avgDailySpend * daysUntilMon;
        const balanceLastsUntilMonday = balance != null ? balance >= projectedSpendUntilMonday : null;
        const daysBalanceLasts =
          balance != null
            ? balance === 0
              ? 0
              : avgDailySpend > 0
              ? Math.floor(balance / avgDailySpend)
              : null
            : null;

        let severity: "critical" | "warning" | "info" = "info";
        const reasons: string[] = [];
        let summary = "";

        if (balance != null && balance <= 0) {
          severity = "critical";
          reasons.push(`Saldo zerado (R$ 0,00) — recarga imediata necessária para manter os anúncios no ar`);
        }
        if (isOverBudget) {
          severity = "critical";
          reasons.push(`Gasto médio diário (R$ ${avgDailySpend.toFixed(2)}) ultrapassa o orçamento definido (R$ ${dailyBudget!.toFixed(2)})`);
        }
        if (balance != null && balanceLastsUntilMonday === false) {
          severity = "critical";
          reasons.push(`Saldo de R$ ${balance.toFixed(2)} não vai durar até segunda-feira (precisa de R$ ${projectedSpendUntilMonday.toFixed(2)})`);
          if (daysBalanceLasts != null) reasons.push(`O saldo dura apenas mais ${daysBalanceLasts} dia(s)`);
        }
        if (severity === "info" && balance != null && daysBalanceLasts != null && daysBalanceLasts <= 2) {
          severity = "critical";
          reasons.push(`Saldo restante para apenas ${daysBalanceLasts} dia(s) — recarga urgente!`);
        } else if (severity === "info" && balance != null && daysBalanceLasts != null && daysBalanceLasts <= 4) {
          severity = "warning";
          reasons.push(`Saldo restante para apenas ${daysBalanceLasts} dias`);
        }
        if (balance != null && balance <= 0) {
          summary = `🚨 Conta "${acc.name}" SEM SALDO. Recarregue imediatamente — anúncios podem ser pausados.`;
        } else if (severity === "critical") {
          summary = `⚠️ Conta "${acc.name}" em situação crítica. ${reasons[0]}.`;
        } else if (severity === "warning") {
          summary = `Conta "${acc.name}" precisa de atenção. ${reasons[0]}.`;
        } else {
          if (dailyBudget != null) reasons.push(`Gasto médio (R$ ${avgDailySpend.toFixed(2)}) dentro do orçamento (R$ ${dailyBudget.toFixed(2)})`);
          if (balance != null && daysBalanceLasts != null) reasons.push(`Saldo suficiente para ${daysBalanceLasts} dias`);
          summary = `Conta "${acc.name}" com orçamento saudável.`;
        }

        return {
          id: acc.id, name: acc.name, dailyBudget, dailyBudgetActive, balance, avgDailySpend,
          projectedSpendUntilMonday, balanceLastsUntilMonday, daysBalanceLasts,
          daysUntilMonday: daysUntilMon, severity, reasons, summary,
        };
      });
  }, [adAccounts, dailySpendByAccount, dailyBudgetActiveByAccount]);


  return analysis;
}
