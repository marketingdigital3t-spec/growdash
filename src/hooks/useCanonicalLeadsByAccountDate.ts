import { useQuery } from "@tanstack/react-query";
import { businessDateKey } from "@/lib/businessDate";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAccountLpConfigs } from "@/hooks/useAccountPixels";
import { aggregateMetaLeadTargets } from "@/lib/metaActionMetrics";

interface ActionRow {
  ad_id: string;
  action_type: string;
  value: number;
  date: string;
  attribution_window?: string | null;
}

/**
 * Uses exactly one global Meta rule per account/day: canonical forms + the
 * configured site-lead event + initiated conversations. Catalog metadata is
 * not required for a valid action fact to contribute.
 *
 * Returns `Map<"accountId|YYYY-MM-DD", number>`.
 *
 * This is the single source of truth for any widget that needs to anchor totals
 * to the dashboard KPI (hourly conversion, weekday distribution, etc.).
 */
export function useCanonicalLeadsByAccountDate() {
  const { insights, startDate, endDate } = useDashboard();
  const { data: lpConfigs = {} } = useAccountLpConfigs();

  const start = businessDateKey(startDate);
  const end = businessDateKey(endDate);

  // Scope to ads present in the current dashboard insights (already filtered by account/period).
  const scopedAdIds = useMemo(() => Array.from(new Set(insights.map((r) => r.ad_id))), [insights]);
  const adIdsKey = scopedAdIds.slice().sort().join(",");

  // ad_id -> { campaign_id, ad_account_id }
  const adMeta = useMemo(() => {
    const m: Record<string, { campaign_id: string | null; ad_account_id: string | null }> = {};
    for (const r of insights) {
      m[r.ad_id] = { campaign_id: r.campaign_id ?? null, ad_account_id: r.ad_account_id ?? null };
    }
    return m;
  }, [insights]);

  // Fetch insight_actions for scoped ads in window
  const actionsQ = useQuery({
    queryKey: ["canonical-leads-actions", adIdsKey, start, end],
    enabled: scopedAdIds.length > 0,
    queryFn: async (): Promise<ActionRow[]> => {
      const CHUNK = 200;
      const PAGE = 1000;
      const all: ActionRow[] = [];
      for (let i = 0; i < scopedAdIds.length; i += CHUNK) {
        const chunk = scopedAdIds.slice(i, i + CHUNK);
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("insight_actions" as any)
            .select("ad_id, action_type, value, date, attribution_window")
            .in("ad_id", chunk)
            .gte("date", start)
            .lte("date", end)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data || []) as unknown as ActionRow[];
          all.push(...rows);
          if (rows.length < PAGE) break;
        }
      }
      return all;
    },
  });

  const result = useMemo(() => {
    const targetByAccountDate = new Map<string, number>();
    const siteActionByAccount = Object.fromEntries(
      Object.entries(lpConfigs as Record<string, { action_type?: string | null }>).map(([accountId, config]) => [accountId, config?.action_type || undefined]),
    );
    const canonical = aggregateMetaLeadTargets(insights, actionsQ.data || [], siteActionByAccount);
    for (const [accountId, days] of Object.entries(canonical.dailyByAccount)) {
      for (const [date, metrics] of Object.entries(days)) {
        if (metrics.total > 0) targetByAccountDate.set(`${accountId}|${date}`, metrics.total);
      }
    }
    return { targetByAccountDate, isLoading: actionsQ.isLoading };
  }, [actionsQ.data, actionsQ.isLoading, insights, lpConfigs]);

  return {
    targetByAccountDate: result.targetByAccountDate,
    isLoading: Boolean(actionsQ.isLoading) || result.isLoading,
  };
}
