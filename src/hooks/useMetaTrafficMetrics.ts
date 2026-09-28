import { useMemo } from "react";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { aggregateMetaTrafficMetrics, type MetaTrafficMetrics, type MetaTrafficScope } from "@/lib/metaTraffic";

export function useMetaTrafficMetrics(scope: MetaTrafficScope, enabled = true): { data: MetaTrafficMetrics; isLoading: boolean; isError: boolean; error: unknown } {
  const accounts = useAdAccounts(true);
  const accountIds = scope.adAccountIds.filter(Boolean);
  const insights = useInsights({
    adAccountId: accountIds.length === 1 ? accountIds[0] : undefined,
    adAccountIds: accountIds.length > 1 ? accountIds : undefined,
    campaignIds: scope.campaignIds,
    startDate: new Date(`${scope.startDate}T00:00:00`),
    endDate: new Date(`${scope.endDate}T00:00:00`),
    enabled: enabled && accountIds.length > 0,
  });
  const rows = useMemo(() => insights.data || [], [insights.data]);
  const adIds = useMemo(() => Array.from(new Set(rows.map((row) => row.ad_id).filter(Boolean))), [rows]);
  const adAccountByAdId = useMemo(() => Object.fromEntries(rows.map((row) => [row.ad_id, row.ad_account_id])), [rows]);
  const actions = useActionTotalsByAds(adIds, new Date(`${scope.startDate}T00:00:00`), new Date(`${scope.endDate}T00:00:00`), adAccountByAdId, { adAccountIds: accountIds, campaignIds: scope.campaignIds });
  const scopedAccounts = (accounts.data || []).filter((account) => accountIds.length === 0 || accountIds.includes(account.id));
  const syncedAt = scopedAccounts.map((account) => account.last_sync_success_at).filter(Boolean).sort().at(-1) || null;
  const errors = useMemo(
    () => [insights.error, actions.error, accounts.error].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error)),
    [accounts.error, actions.error, insights.error],
  );
  const data = useMemo(() => aggregateMetaTrafficMetrics(rows, actions.data, syncedAt, errors), [actions.data, errors, rows, syncedAt]);
  return { data, isLoading: insights.isLoading || actions.isLoading || accounts.isLoading, isError: Boolean(insights.isError || actions.isError || accounts.isError), error: insights.error || actions.error || accounts.error };
}
