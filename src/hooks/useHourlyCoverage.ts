import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useDashboard, type DashboardContextValue } from "@/contexts/DashboardContext";

export type MissingReason = "token_expired" | "no_delivery" | "never_synced" | "lead_event_not_configured";

export interface MissingAccount {
  id: string;
  name: string;
  reason: MissingReason;
}

export interface HourlyCoverage {
  status: "ok" | "partial" | "empty";
  missingAccounts: MissingAccount[];
  isLoading: boolean;
}

type DashboardAdAccount = DashboardContextValue["adAccounts"][number];
type HourlyCoverageRow = { ad_account_id: string; leads: number; clicks: number; spend: number };
type AccountRefRow = { ad_account_id: string };

/**
 * For each account in the current dashboard scope, determines whether
 * `insights_hourly` has an hourly distribution shape in the global filter range.
 * The charts normalize totals from canonical daily insights, so clicks/spend rows
 * are enough even when raw hourly lead events are zero.
 */
export function useHourlyCoverage(): HourlyCoverage {
  const { startDate, endDate, adAccountId, adAccounts } = useDashboard();
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const scopedAccounts = (adAccounts || []).filter((a: DashboardAdAccount) =>
    adAccountId ? a.id === adAccountId : true
  );
  const scopedIds = scopedAccounts.map((a: DashboardAdAccount) => a.id);

  const q = useQuery({
    queryKey: ["insights_hourly_coverage", scopedIds.sort().join(","), start, end],
    enabled: scopedIds.length > 0,
    queryFn: async () => {
      // Per-account rows + distribution signal in window
      const { data: inWindow } = await supabase
        .from("insights_hourly")
        .select("ad_account_id, leads, clicks, spend")
        .in("ad_account_id", scopedIds)
        .gte("date", start)
        .lte("date", end);
      // Per-account presence anywhere
      const { data: anywhere } = await supabase
        .from("insights_hourly")
        .select("ad_account_id")
        .in("ad_account_id", scopedIds)
        .limit(1000);
      // LP config presence per account
      const { data: lpRows } = await supabase
        .from("account_lp_config")
        .select("ad_account_id, action_type")
        .in("ad_account_id", scopedIds);

      const rowsByAcct = new Map<string, { rows: number; leads: number; activity: number }>();
      for (const r of (inWindow || []) as HourlyCoverageRow[]) {
        const cur = rowsByAcct.get(r.ad_account_id) || { rows: 0, leads: 0, activity: 0 };
        cur.rows += 1;
        cur.leads += Number(r.leads || 0);
        cur.activity += Number(r.leads || 0) + Number(r.clicks || 0) + Number(r.spend || 0);
        rowsByAcct.set(r.ad_account_id, cur);
      }
      const everSet = new Set(((anywhere || []) as AccountRefRow[]).map((r) => r.ad_account_id));
      const lpSet = new Set(((lpRows || []) as Array<AccountRefRow & { action_type: string | null }>).filter((r) => r.action_type).map((r) => r.ad_account_id));

      const missing: MissingAccount[] = [];
      for (const a of scopedAccounts) {
        const stat = rowsByAcct.get(a.id);
        if (stat && stat.activity > 0) continue; // healthy: distribution exists for normalized charts
        let reason: MissingReason;
        if (stat && stat.rows > 0 && stat.leads === 0) {
          // Has rows but no signal to distribute leads by hour.
          reason = lpSet.has(a.id) ? "no_delivery" : "lead_event_not_configured";
        } else if (!everSet.has(a.id)) {
          reason = "never_synced";
        } else {
          reason = "no_delivery";
        }
        missing.push({ id: a.id, name: a.name, reason });
      }

      const status: HourlyCoverage["status"] =
        missing.length === 0 ? "ok" : missing.length === scopedAccounts.length ? "empty" : "partial";

      return { status, missingAccounts: missing };
    },
  });

  return {
    status: q.data?.status ?? "ok",
    missingAccounts: q.data?.missingAccounts ?? [],
    isLoading: q.isLoading,
  };
}
