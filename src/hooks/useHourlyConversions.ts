import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { useDashboard, type DashboardContextValue } from "@/contexts/DashboardContext";
import { useCanonicalLeadsByAccountDate } from "@/hooks/useCanonicalLeadsByAccountDate";

export const WEEKDAY_LABELS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type DashboardAdAccount = DashboardContextValue["adAccounts"][number];
type RawHourlyRow = {
  ad_account_id: string;
  campaign_id: string | null;
  ad_id: string | null;
  date: string;
  hour: number;
  leads: number;
  clicks: number;
  spend: number;
};

/**
 * Returns hourly + weekday + period aggregates of LEADS for Meta Ads optimization.
 *
 * Meta-only and consistent for every account (do NOT include RD):
 *   - `insights` is the canonical daily total (same Meta conversion rule as the dashboard KPI)
 *   - `insights_hourly` is used only as the hour/day distribution shape
 *   - each account/day is normalized to the canonical daily total, so raw hourly rows can never inflate counts
 *
 * Esses gráficos servem para otimização de campanhas (dia/horário de veiculação),
 * portanto refletem apenas conversões atribuídas ao Meta.
 */
export function useHourlyConversions() {
  const { startDate, endDate, adAccountId, adAccounts, isLoading: dashboardLoading } = useDashboard();
  const { targetByAccountDate: canonicalTargets, isLoading: canonicalLoading } = useCanonicalLeadsByAccountDate();
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const scopedIds: string[] = (adAccounts || [])
    .filter((a: DashboardAdAccount) => (adAccountId ? a.id === adAccountId : true))
    .map((a: DashboardAdAccount) => a.id);
  const scopedIdsKey = [...scopedIds].sort().join(",");

  const PAGE = 1000;

  // `insights_hourly` vem em nível de anúncio/hora e pode conter mais linhas que o total diário.
  // Por isso ele é usado apenas como distribuição; o total vem de `insights`.
  const hourlyQ = useQuery({
    queryKey: ["hourly_insights_distribution", adAccountId ?? "all", scopedIdsKey, start, end],
    queryFn: async () => {
      let q = (supabase as any)
        .from("insights_hourly")
        .select("ad_account_id, campaign_id, ad_id, date, hour, leads, clicks, spend")
        .gte("date", start)
        .lte("date", end);
      if (adAccountId) q = q.eq("ad_account_id", adAccountId);
      else if (scopedIds.length > 0) q = q.in("ad_account_id", scopedIds);
      let all: RawHourlyRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as RawHourlyRow[];
        all = all.concat(rows);
        if (rows.length < PAGE) break;
      }
      return all;
    },
  });

  const aggregates = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, leads: 0 }));
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, label: WEEKDAY_LABELS[i], short: WEEKDAY_SHORT[i], leads: 0 }));
    let manha = 0, tarde = 0, noite = 0;
    const perAccountSource: Record<string, "hourly" | "uniform" | "none"> = {};
    const hourlyRows = hourlyQ.data || [];
    const accountIds = scopedIdsKey ? scopedIdsKey.split(",") : [];
    for (const id of accountIds) perAccountSource[id] = "none";

    // 1) Canonical daily totals come from the SAME rule as the dashboard KPI "Leads"
    //    (FORMS → lead_grouped, LP → account_lp_config.action_type), via
    //    useCanonicalLeadsByAccountDate. Hourly rows are only used as distribution shape.
    const targetByAccountDate = canonicalTargets;

    // 2) Hourly is used ONLY as a distribution shape (weights), never as a total.
    type HourlyRow = { ad_account_id: string; date: string; hour: number; leads: number; clicks: number; spend: number };
    const rowsByAccountDate = new Map<string, HourlyRow[]>();
    // Consolidate by (account, date, hour) to avoid multi-ad inflation when summing weights.
    const consolidator = new Map<string, HourlyRow>();
    for (const r of hourlyRows) {
      if (!r.ad_account_id || !r.date) continue;
      const hour = Number(r.hour);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      const key = `${r.ad_account_id}|${r.date}|${hour}`;
      const cur = consolidator.get(key);
      if (cur) {
        cur.leads += Number(r.leads || 0);
        cur.clicks += Number(r.clicks || 0);
        cur.spend += Number(r.spend || 0);
      } else {
        consolidator.set(key, {
          ad_account_id: r.ad_account_id,
          date: r.date,
          hour,
          leads: Number(r.leads || 0),
          clicks: Number(r.clicks || 0),
          spend: Number(r.spend || 0),
        });
      }
    }
    for (const row of consolidator.values()) {
      const k = `${row.ad_account_id}|${row.date}`;
      const arr = rowsByAccountDate.get(k) || [];
      arr.push(row);
      rowsByAccountDate.set(k, arr);
    }

    const bucketN = (h: number, n: number) => {
      if (h >= 6 && h < 12) manha += n;
      else if (h >= 12 && h < 18) tarde += n;
      else noite += n;
    };

    const applyHour = (accountId: string, dateStr: string, hour: number, value: number, source: "hourly" | "uniform") => {
      if (value <= 0) return;
      byHour[hour].leads += value;
      bucketN(hour, value);
      const d = parseISO(dateStr);
      const js = d.getDay();
      const idx = js === 0 ? 6 : js - 1;
      byWeekday[idx].leads += value;
      if (perAccountSource[accountId] !== "hourly") perAccountSource[accountId] = source;
    };

    const distributeInteger = (
      accountId: string,
      dateStr: string,
      target: number,
      rows: HourlyRow[] | null,
    ) => {
      const roundedTarget = Math.max(0, Math.round(target));
      if (roundedTarget === 0) return;

      // Choose weights: prefer hourly leads → clicks → spend → uniform across 24h.
      let weights: number[];
      let hours: number[];
      let source: "hourly" | "uniform" = "hourly";
      if (rows && rows.length > 0) {
        const leadW = rows.reduce((s, r) => s + Math.max(0, r.leads), 0);
        const clickW = rows.reduce((s, r) => s + Math.max(0, r.clicks), 0);
        const spendW = rows.reduce((s, r) => s + Math.max(0, r.spend), 0);
        const pick = (r: HourlyRow) =>
          leadW > 0 ? Math.max(0, r.leads)
            : clickW > 0 ? Math.max(0, r.clicks)
              : spendW > 0 ? Math.max(0, r.spend)
                : 1;
        weights = rows.map(pick);
        hours = rows.map((r) => r.hour);
        if (leadW + clickW + spendW === 0) source = "uniform";
      } else {
        // No hourly shape: distribute uniformly across all 24 hours so total still matches KPI.
        hours = Array.from({ length: 24 }, (_, h) => h);
        weights = Array.from({ length: 24 }, () => 1);
        source = "uniform";
      }

      const totalWeight = weights.reduce((s, n) => s + n, 0) || hours.length;
      const allocations = hours.map((h, idx) => {
        const raw = (roundedTarget * weights[idx]) / totalWeight;
        const base = Math.floor(raw);
        return { hour: h, value: base, remainder: raw - base };
      });
      let remaining = roundedTarget - allocations.reduce((s, a) => s + a.value, 0);
      allocations.sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < allocations.length && remaining > 0; i++, remaining--) allocations[i].value += 1;

      for (const a of allocations) applyHour(accountId, dateStr, a.hour, a.value, source);
    };

    // 3) Iterate over EVERY (account, date) that has KPI > 0 — guarantees sum === canonical KPI.
    for (const [accountDateKey, target] of targetByAccountDate) {
      if (target <= 0) continue;
      const [accountId, dateStr] = accountDateKey.split("|");
      const rows = rowsByAccountDate.get(accountDateKey) || null;
      distributeInteger(accountId, dateStr, target, rows);
    }

    const total = manha + tarde + noite;
    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

    if (typeof window !== "undefined" && window.localStorage?.getItem("debug_leads")) {
      const kpiTotal = Array.from(targetByAccountDate.values()).reduce((s, n) => s + Math.round(Math.max(0, n)), 0);
      console.debug("[useHourlyConversions:normalized-meta]", {
        perAccountSource,
        chartTotal: total,
        kpiTotal,
        match: total === kpiTotal,
        byPeriod: { manha, tarde, noite },
      });
    }

    return {
      byHour,
      byWeekday,
      perAccountSource,
      source: "normalized-meta" as const,
      byPeriod: {
        manha: { leads: manha, pct: pct(manha) },
        tarde: { leads: tarde, pct: pct(tarde) },
        noite: { leads: noite, pct: pct(noite) },
        total,
      },
    };
  }, [hourlyQ.data, canonicalTargets, scopedIdsKey]);

  return {
    ...aggregates,
    isLoading: Boolean(dashboardLoading || hourlyQ.isLoading || canonicalLoading),
  };
}

