import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface BudgetHistoryDay {
  date: string; // yyyy-MM-dd
  spend: number;
  topUps: number;
  balance: number | null;
}

export interface BudgetHistoryTopUp {
  date: string; // yyyy-MM-dd
  amount: number;
  newBalance: number | null;
  paymentMethod?: string | null;
  status?: string | null;
  reference?: string | null;
}

export interface BudgetHistory {
  topUps: BudgetHistoryTopUp[];
  days: BudgetHistoryDay[];
  totals: {
    topUpSum: number;
    spendSum: number;
    finalBalance: number | null;
    openingBalance: number | null;
    currentBalance: number | null;
  };
}

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function eachDay(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= stop) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function useBudgetHistory(adAccountId?: string, startDate?: Date, endDate?: Date) {
  return useQuery<BudgetHistory>({
    queryKey: ["budget_history", adAccountId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!adAccountId && !!startDate && !!endDate,
    queryFn: async () => {
      const start = startDate!;
      const end = endDate!;
      const startISO = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString();
      const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).toISOString();

      // 1) Saldo atual da conta (Meta) — âncora confiável
      const { data: acc } = await (supabase as any)
        .from("ad_accounts")
        .select("remaining_balance")
        .eq("id", adAccountId!)
        .maybeSingle();
      const currentBalance = acc?.remaining_balance != null ? Number(acc.remaining_balance) : null;

      // 2) Transações reais (Meta Billing) — fonte de verdade para aportes
      const { data: txs, error: txErr } = await (supabase as any)
        .from("account_transactions")
        .select("id, time, amount, status, payment_method, reference")
        .eq("ad_account_id", adAccountId!)
        .gte("time", startISO)
        .lte("time", endISO)
        .order("time", { ascending: true });
      if (txErr) throw txErr;

      // 3) Transações posteriores ao período (para ancorar do "hoje" → fim do período)
      const { data: txsAfter } = await (supabase as any)
        .from("account_transactions")
        .select("time, amount, status")
        .eq("ad_account_id", adAccountId!)
        .gt("time", endISO)
        .order("time", { ascending: true });

      // 4) Daily spend via ads → insights
      const { data: camps } = await (supabase as any)
        .from("campaigns")
        .select("id")
        .eq("ad_account_id", adAccountId!);
      const campIds = (camps ?? []).map((c) => c.id);
      let adIds: string[] = [];
      if (campIds.length > 0) {
        const { data: adsetsData } = await (supabase as any)
          .from("adsets")
          .select("id, campaign_id")
          .in("campaign_id", campIds);
        const adsetIds = (adsetsData ?? []).map((a) => a.id);
        if (adsetIds.length > 0) {
          const { data: adsData } = await (supabase as any)
            .from("ads")
            .select("id, adset_id")
            .in("adset_id", adsetIds);
          adIds = (adsData ?? []).map((a) => a.id);
        }
      }

      const startDateOnly = ymd(start);
      const endDateOnly = ymd(end);
      const todayOnly = ymd(new Date());
      const spendByDate = new Map<string, number>();
      if (adIds.length > 0) {
        const chunkSize = 200;
        // Buscar gasto do início do período até hoje (precisamos do gasto pós-período p/ ancorar)
        const fetchEnd = todayOnly > endDateOnly ? todayOnly : endDateOnly;
        for (let i = 0; i < adIds.length; i += chunkSize) {
          const chunk = adIds.slice(i, i + chunkSize);
          const { data: ins, error: insErr } = await (supabase as any)
            .from("insights")
            .select("date, spend")
            .in("ad_id", chunk)
            .gte("date", startDateOnly)
            .lte("date", fetchEnd);
          if (insErr) throw insErr;
          for (const r of ins ?? []) {
            const k = r.date as string;
            spendByDate.set(k, (spendByDate.get(k) ?? 0) + Number(r.spend ?? 0));
          }
        }
      }

      // 5) Aportes do período (filtrando status válido)
      const successStatuses = new Set([
        "paid", "success", "successful", "completed", "com_fundos", "with_funds",
      ]);
      const isValidStatus = (s?: string | null) => {
        if (!s) return true; // se Meta não retornar status, assumimos válido
        const v = String(s).toLowerCase();
        return successStatuses.has(v) || v.includes("paid") || v.includes("fund");
      };

      const topUps: BudgetHistoryTopUp[] = [];
      const topUpsByDate = new Map<string, number>();
      for (const t of txs ?? []) {
        const amount = Number(t.amount ?? 0);
        if (!isFinite(amount) || amount <= 0) continue;
        if (!isValidStatus(t.status)) continue;
        const d = ymd(new Date(t.time as string));
        topUps.push({
          date: d,
          amount,
          newBalance: null,
          paymentMethod: t.payment_method ?? null,
          status: t.status ?? null,
          reference: t.reference ?? null,
        });
        topUpsByDate.set(d, (topUpsByDate.get(d) ?? 0) + amount);
      }

      // 6) Reconstrução ancorada em currentBalance:
      //    balance(end) = currentBalance + spend[end+1..today] - topUps[end+1..today]
      //    depois iteramos de trás pra frente no período: balance(D-1) = balance(D) - topUps(D) + spend(D)
      let finalBalanceAnchor: number | null = null;
      if (currentBalance != null) {
        let after = currentBalance;
        // Somar spend pós-período
        for (const [d, sp] of spendByDate) {
          if (d > endDateOnly) after += sp; // gasto reduz saldo → para "voltar" no tempo, somamos
        }
        // Subtrair aportes pós-período
        for (const t of txsAfter ?? []) {
          const amt = Number(t.amount ?? 0);
          if (!isFinite(amt) || amt <= 0) continue;
          if (!isValidStatus(t.status as any)) continue;
          after -= amt;
        }
        finalBalanceAnchor = after;
      }

      const allDays = eachDay(start, end);
      const days: BudgetHistoryDay[] = allDays.map((d) => ({
        date: d,
        spend: spendByDate.get(d) ?? 0,
        topUps: topUpsByDate.get(d) ?? 0,
        balance: null,
      }));

      // Preenche saldo de trás pra frente
      if (finalBalanceAnchor != null && days.length > 0) {
        days[days.length - 1].balance = finalBalanceAnchor;
        for (let i = days.length - 2; i >= 0; i--) {
          const next = days[i + 1];
          // balance(D) = balance(D+1) - topUps(D+1) + spend(D+1)
          days[i].balance = (next.balance ?? 0) - next.topUps + next.spend;
        }
      } else {
        // Fallback: opening balance via account_balance_events anterior
        const { data: prior } = await (supabase as any)
          .from("account_balance_events")
          .select("new_balance, event_at")
          .eq("ad_account_id", adAccountId!)
          .lt("event_at", startISO)
          .order("event_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const openingBalance = prior?.new_balance != null ? Number(prior.new_balance) : null;
        let running = openingBalance;
        for (const day of days) {
          if (running != null) running = running + day.topUps - day.spend;
          day.balance = running;
        }
      }

      const topUpSum = topUps.reduce((s, t) => s + t.amount, 0);
      const spendSum = days.reduce((s, d) => s + d.spend, 0);
      const finalBalance = days.length > 0 ? days[days.length - 1].balance : finalBalanceAnchor;
      const openingBalance = days.length > 0 && days[0].balance != null
        ? days[0].balance - days[0].topUps + days[0].spend
        : null;

      return {
        topUps,
        days,
        totals: { topUpSum, spendSum, finalBalance, openingBalance, currentBalance },
      };
    },
  });
}
