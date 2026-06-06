import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useDashboard } from "@/contexts/DashboardContext";

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

/**
 * For each account in the current dashboard scope, determines whether
 * `insights_hourly` has data in the global filter range and explains why not.
 */
export function useHourlyCoverage(): HourlyCoverage {
  const { startDate, endDate, adAccountId, adAccounts } = useDashboard();
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const scopedAccounts = (adAccounts || []).filter((a: any) =>
    adAccountId ? a.id === adAccountId : true
  );
  const scopedIds = scopedAccounts.map((a: any) => a.id);

  const q = useQuery({
    queryKey: ["insights_hourly_coverage", scopedIds.sort().join(","), start, end],
    enabled: scopedIds.length > 0,
    queryFn: async () => {
      // Per-account rows + leads in window
      const { data: inWindow } = await supabase
        .from("insights_hourly")
        .select("ad_account_id, leads")
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

      const rowsByAcct = new Map<string, { rows: number; leads: number }>();
      for (const r of (inWindow || []) as any[]) {
        const cur = rowsByAcct.get(r.ad_account_id) || { rows: 0, leads: 0 };
        cur.rows += 1;
        cur.leads += Number(r.leads || 0);
        rowsByAcct.set(r.ad_account_id, cur);
      }
      const everSet = new Set((anywhere || []).map((r: any) => r.ad_account_id));
      const lpSet = new Set((lpRows || []).filter((r: any) => r.action_type).map((r: any) => r.ad_account_id));

      const missing: MissingAccount[] = [];
      for (const a of scopedAccounts) {
        const stat = rowsByAcct.get(a.id);
        if (stat && stat.leads > 0) continue; // healthy
        let reason: MissingReason;
        if (stat && stat.rows > 0 && stat.leads === 0) {
          // Has delivery but no leads — likely lead event not configured for this account.
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
