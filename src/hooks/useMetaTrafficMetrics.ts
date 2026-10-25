import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { aggregateMetaTrafficMetrics, type MetaTrafficMetrics, type MetaTrafficScope } from "@/lib/metaTraffic";
import { useMetaBreakdowns } from "@/hooks/useMetaBreakdowns";
import { parseBusinessDate } from "@/lib/businessDate";
import { metaMetricContract, type MetaMetricContract } from "@/lib/analyticsContract";
import { buildAttributionWindowsByAccount } from "@/lib/metaAttributionScope";
import { findMetaSyncCoverage, findMetaSyncIssue, type MetaSyncCoverageRow } from "@/lib/metaSyncCoverage";
import { resolveMetaSnapshotDuringRefresh } from "@/lib/metaSnapshot";
import { resolveMetaLoadingState } from "@/lib/metaLoading";
import { withRequestTimeout } from "@/lib/resilience";

export function useMetaTrafficMetrics(scope: MetaTrafficScope, enabled = true): { data: MetaTrafficMetrics; metrics: MetaMetricContract; isLoading: boolean; insightsLoading: boolean; actionsLoading: boolean; isError: boolean; error: unknown; refetch: () => Promise<void> } {
  const accounts = useAdAccounts();
  const accountIds = scope.adAccountIds.filter(Boolean);
  const scopedAccounts = (accounts.data || []).filter((account) => accountIds.length === 0 || accountIds.includes(account.id));
  // `account_default` is an aggregate fallback, not an instruction to replace
  // each account's real setting. This matters in consolidated views where
  // accounts can legitimately use different attribution windows.
  const explicitWindow = scope.attributionWindow && scope.attributionWindow !== "account_default"
    ? scope.attributionWindow
    : undefined;
  const effectiveAccountIds = accountIds.length ? accountIds : scopedAccounts.map((account) => account.id);
  const attributionWindowsByAccount = buildAttributionWindowsByAccount(scopedAccounts, effectiveAccountIds, explicitWindow);
  const syncCoverage = useQuery({
    queryKey: ["meta-action-sync-coverage", effectiveAccountIds.slice().sort(), scope.startDate, scope.endDate, scope.campaignIds?.slice().sort(), attributionWindowsByAccount],
    enabled: enabled && effectiveAccountIds.length > 0 && !accounts.isLoading && !accounts.isError,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout((supabase as any)
        .from("meta_sync_scope_state" as any)
        .select("ad_account_id,campaign_scope,start_date,end_date,covered_start_date,covered_end_date,timezone,attribution_window,status,block_status,last_error,error_code,last_finished_at,updated_at")
        .in("ad_account_id", effectiveAccountIds)
        .lte("start_date", scope.startDate)
        .gte("end_date", scope.endDate), 900);
      if (error) throw error;
      const rows = (data || []) as unknown as MetaSyncCoverageRow[];
      const accountScopes = scopedAccounts.map((account) => ({
        account,
        scope: {
          accountId: account.id,
          timezone: account.timezone_name || scope.timezone || "America/Sao_Paulo",
          attributionWindow: attributionWindowsByAccount[account.id] || "account_default",
        },
      }));
      const gapsFor = (block: string) => accountScopes.filter(({ scope: accountScope }) => !findMetaSyncCoverage(
        rows,
        accountScope,
        scope.startDate,
        scope.endDate,
        scope.campaignIds || [],
        block,
      ));
      const issuesFor = (block: string) => accountScopes.flatMap(({ account, scope: accountScope }) => {
        if (findMetaSyncCoverage(rows, accountScope, scope.startDate, scope.endDate, scope.campaignIds || [], block)) return [];
        const issue = findMetaSyncIssue(rows, accountScope, scope.startDate, scope.endDate, scope.campaignIds || [], block);
        return issue?.last_error ? [{ account, issue, block }] : [];
      });
      return { rows, actionGaps: gapsFor("actions"), insightGaps: gapsFor("insights"), issues: [...issuesFor("insights"), ...issuesFor("actions")] };
    },
    staleTime: 30_000,
    // The selected-scope sync updates Insights first and actions afterward.
    // Keep checking the tiny coverage row while actions are pending/missing so
    // a valid zero is not left as "Indisponível" until navigation or focus.
    refetchInterval: (query) => query.state.data?.actionGaps?.length ? 10_000 : false,
  });
  const accountWindows = Array.from(new Set(Object.values(attributionWindowsByAccount)));
  const attributionWindow = explicitWindow || (accountWindows.length === 1 ? accountWindows[0] : "account_default");
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
  const adsetIdByAdId = useMemo(() => Object.fromEntries(rows.map((row) => [row.ad_id, row.adset_id || null])), [rows]);
  const destinationTypeByAdset = useMemo(() => Object.fromEntries(rows.filter((row) => row.adset_id).map((row) => [String(row.adset_id), row.adset_destination_type || null])), [rows]);
  const actions = useActionTotalsByAds(adIds, parseBusinessDate(scope.startDate, scope.timezone), parseBusinessDate(scope.endDate, scope.timezone), adAccountByAdId, { adAccountIds: accountIds, campaignIds: scope.campaignIds, attributionWindow, attributionWindowsByAccount, adsetIdByAdId, destinationTypeByAdset });
  const campaignIds = useMemo(() => Array.from(new Set((scope.campaignIds?.length ? scope.campaignIds : rows.map((row) => row.campaign_id).filter(Boolean)) as string[])), [rows, scope.campaignIds]);
  const attributionWindowByCampaign = useMemo(() => {
    const windowByAccount = Object.fromEntries(scopedAccounts.map((account) => [account.id, attributionWindowsByAccount[account.id] || "account_default"]));
    return Object.fromEntries(rows.filter((row) => row.campaign_id && row.ad_account_id).map((row) => [String(row.campaign_id), windowByAccount[String(row.ad_account_id)] || attributionWindow]));
  }, [attributionWindow, attributionWindowsByAccount, rows, scopedAccounts]);
  const breakdowns = useMetaBreakdowns(campaignIds, scope.startDate, scope.endDate, enabled && accountIds.length > 0, attributionWindowByCampaign);
  // Consolidated freshness is bounded by the oldest selected account, not the
  // newest one. Otherwise one recently synced account masks a stale account.
  const syncedAt = scopedAccounts.map((account) => account.last_sync_success_at).filter(Boolean).sort()[0] || null;
  const errors = useMemo(
    () => [
      insights.error,
      actions.error,
      accounts.error,
      breakdowns.error,
      syncCoverage.error,
      ...(syncCoverage.data?.issues || []).map(({ account, issue, block }) => `${account.name} · ${block === "insights" ? "Insights" : "ações Meta"}: ${issue.last_error}`),
    ].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error)),
    [accounts.error, actions.error, breakdowns.error, insights.error, syncCoverage.data?.issues, syncCoverage.error],
  );
  // Background polling keeps `isFetching` true while the last confirmed
  // snapshot is still usable. Treat only the first pending request as loading;
  // otherwise the funnel remains stuck on "Sincronizando" forever whenever a
  // coverage gap is being retried.
  const loadingState = resolveMetaLoadingState({
    insightsPending: insights.isPending,
    accountsPending: accounts.isPending,
    coveragePending: syncCoverage.isPending,
    actionsPending: actions.isPending,
    breakdownsPending: breakdowns.isPending,
    hasUsableSnapshot: rows.length > 0,
  });
  const isLoading = loadingState.isLoading;
  const coverageComplete = accounts.isSuccess
    && scopedAccounts.length > 0
    && scopedAccounts.length === effectiveAccountIds.length
    && !syncCoverage.isError
    && (syncCoverage.data?.actionGaps.length === 0);
  const insightCoverageComplete = accounts.isSuccess
    && scopedAccounts.length > 0
    && scopedAccounts.length === effectiveAccountIds.length
    && !syncCoverage.isError
    && (syncCoverage.data?.insightGaps.length === 0);
  // A completed watermark is preferred, but an already persisted, scoped
  // Insights snapshot plus canonical Meta action facts is also sufficient to
  // render the exact same numbers used by Dashboard and Expert. This covers a
  // delayed watermark write without falling back to the legacy insights.leads
  // aggregate or hiding valid data on only one sidebar route.
  const persistedCanonicalScope = rows.length > 0 && (actions.data?.leadActionFactCount || 0) > 0;
  const effectiveInsightScopeConfirmed = insightCoverageComplete || persistedCanonicalScope;
  const actionCoverageReason = syncCoverage.isError
    ? (syncCoverage.error instanceof Error ? syncCoverage.error.message : String(syncCoverage.error))
    : syncCoverage.data?.actionGaps.length
      ? `Ações Meta sem sincronização confirmada para: ${syncCoverage.data.actionGaps.map(({ account }) => account.name).join(", ")}.`
      : !coverageComplete ? "Cobertura de ações Meta ainda não confirmada para todas as contas selecionadas." : null;
  const insightCoverageReason = syncCoverage.isError
    ? (syncCoverage.error instanceof Error ? syncCoverage.error.message : String(syncCoverage.error))
    : syncCoverage.data?.insightGaps.length
      ? `Insights sem sincronização confirmada para: ${syncCoverage.data.insightGaps.map(({ account }) => account.name).join(", ")}.`
      : !insightCoverageComplete ? "Cobertura de Insights ainda não confirmada para todas as contas selecionadas." : null;
  const coverageReason = [insightCoverageReason, actionCoverageReason].filter(Boolean).join(" ") || null;
  const computedData = useMemo(() => {
    const base = aggregateMetaTrafficMetrics(rows, {
      ...actions.data,
      // Persisted canonical lead actions from this exact account/date scope
      // remain useful while a refresh watermark is partial. A real zero still
      // requires confirmed coverage or an actual lead-action fact.
      actionsAvailable: !actions.isLoading && !actions.isError && (coverageComplete || (actions.data?.leadActionFactCount || 0) > 0),
      actionsErrorReason: actions.error instanceof Error ? actions.error.message : actions.error ? String(actions.error) : actionCoverageReason,
      breakdowns: breakdowns.data,
    }, syncedAt, errors, Date.now(), { attributionWindow, timezone: scope.timezone || scopedAccounts[0]?.timezone_name || null, scopeConfirmed: effectiveInsightScopeConfirmed, coverageReason });
    return isLoading ? { ...base, status: "syncing" as const } : base;
  }, [actionCoverageReason, actions.data, actions.error, actions.isError, actions.isLoading, attributionWindow, breakdowns.data, coverageComplete, coverageReason, effectiveInsightScopeConfirmed, errors, isLoading, rows, scope.timezone, scopedAccounts, syncedAt]);
  const snapshotScopeKey = useMemo(() => JSON.stringify({
    accounts: effectiveAccountIds.slice().sort(),
    campaigns: (scope.campaignIds || []).slice().sort(),
    startDate: scope.startDate,
    endDate: scope.endDate,
    attributionWindow,
    timezone: scope.timezone || null,
  }), [attributionWindow, effectiveAccountIds, scope.campaignIds, scope.endDate, scope.startDate, scope.timezone]);
  const lastConfirmedSnapshot = useRef<{ scopeKey: string; data: MetaTrafficMetrics } | null>(null);
  const previousSnapshot = lastConfirmedSnapshot.current;
  const snapshotResolution = resolveMetaSnapshotDuringRefresh({
    current: computedData,
    previous: previousSnapshot?.scopeKey === snapshotScopeKey ? previousSnapshot.data : undefined,
    isRefreshing: isLoading,
    sameScope: previousSnapshot?.scopeKey === snapshotScopeKey,
    previousUsable: Boolean(previousSnapshot?.data.available || previousSnapshot?.data.metricAvailability.spend?.available),
  });
  const data = useMemo(() => snapshotResolution.preserved
    ? { ...snapshotResolution.value, status: "stale" as const }
    : computedData, [computedData, snapshotResolution.preserved, snapshotResolution.value]);
  useEffect(() => {
    if (computedData.available || computedData.metricAvailability.spend?.available) {
      lastConfirmedSnapshot.current = { scopeKey: snapshotScopeKey, data: computedData };
    } else if (lastConfirmedSnapshot.current?.scopeKey !== snapshotScopeKey) {
      lastConfirmedSnapshot.current = null;
    }
  }, [computedData, snapshotScopeKey]);
  const metrics = useMemo(() => metaMetricContract(data), [data]);
  const snapshotPreserved = snapshotResolution.preserved;
  return { data, metrics, isLoading: isLoading && !snapshotPreserved, insightsLoading: (insights.isPending || accounts.isPending) && !snapshotPreserved, actionsLoading: (actions.isPending || syncCoverage.isPending) && !snapshotPreserved, isError: Boolean(insights.isError || actions.isError || accounts.isError || breakdowns.isError || syncCoverage.isError), error: insights.error || actions.error || accounts.error || breakdowns.error || syncCoverage.error, refetch: async () => { await insights.refetch(); await actions.refetch(); await accounts.refetch(); await breakdowns.refetch(); await syncCoverage.refetch(); } };
}
