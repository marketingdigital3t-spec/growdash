import { useMemo } from "react";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { aggregateMetaTrafficMetrics, type MetaTrafficMetrics, type MetaTrafficScope } from "@/lib/metaTraffic";
import { useMetaBreakdowns } from "@/hooks/useMetaBreakdowns";
import { parseBusinessDate } from "@/lib/businessDate";
import { metaMetricContract, type MetaMetricContract } from "@/lib/analyticsContract";

export function useMetaTrafficMetrics(scope: MetaTrafficScope, enabled = true): { data: MetaTrafficMetrics; metrics: MetaMetricContract; isLoading: boolean; insightsLoading: boolean; actionsLoading: boolean; isError: boolean; error: unknown; refetch: () => Promise<void> } {
  const accounts = useAdAccounts();
  const accountIds = scope.adAccountIds.filter(Boolean);
  const scopedAccounts = (accounts.data || []).filter((account) => accountIds.length === 0 || accountIds.includes(account.id));
  const accountWindows = Array.from(new Set(scopedAccounts.map((account) => account.attribution_window || "account_default")));
  const attributionWindow = scope.attributionWindow || (accountWindows.length === 1 ? accountWindows[0] : "account_default");
  const attributionWindowsByAccount = useMemo(
    () => Object.fromEntries(scopedAccounts.map((account) => [account.id, scope.attributionWindow || account.attribution_window || "account_default"])),
    [scope.attributionWindow, scopedAccounts],
  );
  const insights = useInsights({
    adAccountId: accountIds.length === 1 ? accountIds[0] : undefined,
    adAccountIds: accountIds.length > 1 ? accountIds : undefined,
    campaignIds: scope.campaignIds,
    attributionWindow,
    attributionWindowsByAccount,
    startDate: parseBusinessDate(scope.startDate, scope.timezone),
    endDate: parseBusinessDate(scope.endDate, scope.timezone),
    enabled: enabled && accountIds.length > 0,
  });
  const rows = useMemo(() => insights.data || [], [insights.data]);
  const adIds = useMemo(() => Array.from(new Set(rows.map((row) => row.ad_id).filter(Boolean))), [rows]);
  const adAccountByAdId = useMemo(() => Object.fromEntries(rows.map((row) => [row.ad_id, row.ad_account_id])), [rows]);
  const actions = useActionTotalsByAds(adIds, parseBusinessDate(scope.startDate, scope.timezone), parseBusinessDate(scope.endDate, scope.timezone), adAccountByAdId, { adAccountIds: accountIds, campaignIds: scope.campaignIds, attributionWindow, attributionWindowsByAccount });
  const campaignIds = useMemo(() => Array.from(new Set((scope.campaignIds?.length ? scope.campaignIds : rows.map((row) => row.campaign_id).filter(Boolean)) as string[])), [rows, scope.campaignIds]);
  const breakdowns = useMetaBreakdowns(campaignIds, scope.startDate, scope.endDate, enabled && accountIds.length > 0);
  // Consolidated freshness is bounded by the oldest selected account, not the
  // newest one. Otherwise one recently synced account masks a stale account.
  const syncedAt = scopedAccounts.map((account) => account.last_sync_success_at).filter(Boolean).sort()[0] || null;
  const errors = useMemo(
    () => [insights.error, actions.error, accounts.error, breakdowns.error].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error)),
    [accounts.error, actions.error, breakdowns.error, insights.error],
  );
  const isLoading = insights.isLoading || actions.isLoading || accounts.isLoading || breakdowns.isLoading;
  const data = useMemo(() => {
    const base = aggregateMetaTrafficMetrics(rows, {
      ...actions.data,
      actionsAvailable: !actions.isLoading && !actions.isError,
      actionsErrorReason: actions.error instanceof Error ? actions.error.message : actions.error ? String(actions.error) : null,
      breakdowns: breakdowns.data,
    }, syncedAt, errors, Date.now(), { attributionWindow, timezone: scope.timezone || scopedAccounts[0]?.timezone_name || null });
    return isLoading ? { ...base, status: "syncing" as const } : base;
  }, [actions.data, actions.error, actions.isError, actions.isLoading, attributionWindow, breakdowns.data, errors, isLoading, rows, scope.timezone, scopedAccounts, syncedAt]);
  const metrics = useMemo(() => metaMetricContract(data), [data]);
  return { data, metrics, isLoading, insightsLoading: insights.isLoading || accounts.isLoading, actionsLoading: actions.isLoading, isError: Boolean(insights.isError || actions.isError || accounts.isError || breakdowns.isError), error: insights.error || actions.error || accounts.error || breakdowns.error, refetch: async () => { await insights.refetch(); await actions.refetch(); await accounts.refetch(); await breakdowns.refetch(); } };
}
