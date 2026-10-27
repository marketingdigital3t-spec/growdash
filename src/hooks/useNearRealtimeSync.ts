import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { businessDateKey } from "@/lib/businessDate";
import { shouldInvalidateLiveQuery } from "@/lib/liveQueryInvalidation";
import { withInFlightScope } from "@/lib/inFlightByScope";
import { withRequestTimeout } from "@/lib/resilience";
import { describeSyncFailure } from "@/lib/syncStatus";

// Realtime database writes keep visible data current. The external Meta/RD
// reconciliation is deliberately less frequent so it does not monopolise the
// browser whenever someone changes tabs or returns to the application.
// The sync function fetches deltas, so a short watermark window keeps the CRM
// close to RD without re-running a full historical reconciliation.
const REFRESH_INTERVAL_MS = 60_000;
const LOCAL_DEDUP_WINDOW_MS = 45_000;
const RECENT_SYNC_WINDOW_HOURS = 2;
const STORAGE_PREFIX = "growdash:last-background-sync";
// A Meta/RD sync can write several related rows in rapid succession. Waiting
// for a quiet window prevents each write from reloading the same heavy traffic
// queries and making every tab appear to refresh continuously.
const REALTIME_UI_BATCH_MS = 1_000;
// Let the route paint its persisted snapshot before the first provider
// reconciliation starts. The sync remains automatic, but it no longer
// competes with the initial campaigns/CRM queries on a cold navigation.
const INITIAL_SYNC_DELAY_MS = 2_000;
// The selected Meta snapshot completes in roughly 6–10s in production. Keep
// enough budget for Edge auth, database writes and the network hop so a valid
// completed sync is not reported as a client timeout.
const FAST_SYNC_TIMEOUT_MS = 30_000;
// Bounded RD snapshots have taken 40–55s in production. The client must wait
// longer than that window or it reports a false timeout while the snapshot is
// still being persisted by the coordinator.
const RD_RECONCILIATION_TIMEOUT_MS = 90_000;

const LIVE_TABLES = [
  "ad_accounts", "campaigns", "adsets", "ads", "insights", "insights_hourly",
  "rd_deals", "rd_funnel_stages", "rd_deal_stage_history", "sales", "expert_sales", "alerts", "social_media", "social_insights_daily",
  "financial_entries", "kanban_boards", "kanban_cards", "workspace_files",
] as const;

// A realtime write must refresh live data, but invalidating every cached query
// makes expensive route modules re-render together and can freeze navigation.
// Keep the list explicit and restricted to data fed by the realtime tables.
type SyncState = "idle" | "refreshing" | "fresh" | "partial" | "error";

interface Params {
  adAccountId?: string;
  adAccountIds?: string[];
  campaignIds?: string[];
  funnelIds?: string[];
  timezone?: string;
  attributionWindow?: string;
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean;
}

/**
 * Stale-while-revalidate para Meta Ads + RD Station.
 *
 * As telas leem primeiro o último snapshot local (histórico já sincronizado).
 * A rotina externa consulta o escopo do calendário atual em segundo plano; cada
 * gravação no banco é recebida em realtime e agrupada por no máximo um segundo.
 * Assim, os KPIs permanecem visíveis e mudam sem um loader central nem novo
 * backfill do histórico a cada navegação.
 */
export function useNearRealtimeSync({ adAccountId, adAccountIds, campaignIds, funnelIds, timezone, attributionWindow, startDate, endDate, enabled = true }: Params = {}) {
  const queryClient = useQueryClient();
  const inFlight = useRef(new Map<string, Promise<void>>());
  const invalidateTimer = useRef<number | null>(null);
  const [state, setState] = useState<SyncState>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [rdSyncError, setRdSyncError] = useState<string | null>(null);
  const startDateKey = startDate ? businessDateKey(startDate, timezone || undefined) : "today";
  const endDateKey = endDate ? businessDateKey(endDate, timezone || undefined) : "today";
  const scope = `${adAccountId || adAccountIds?.slice().sort().join(",") || "all"}:${campaignIds?.slice().sort().join(",") || "all-campaigns"}:${funnelIds?.slice().sort().join(",") || "all-funnels"}:${startDateKey}:${endDateKey}:${timezone || "account"}:${attributionWindow || "account_default"}`;
  const activeScope = useRef(scope);
  activeScope.current = scope;

  const invalidateLiveQueries = useCallback(() => {
    if (invalidateTimer.current) window.clearTimeout(invalidateTimer.current);
    invalidateTimer.current = window.setTimeout(() => {
      // Only queries derived from realtime tables become stale. This preserves
      // cached permission/layout/module data while a person changes pages.
      void queryClient.invalidateQueries({
        predicate: (query) => shouldInvalidateLiveQuery(query.queryKey),
      });
      setLastUpdatedAt(new Date());
    }, REALTIME_UI_BATCH_MS);
  }, [queryClient]);

  const refresh = useCallback(async (force = false) => {
    if (!enabled || !navigator.onLine || document.visibilityState === "hidden") return;
    const isCurrentScope = () => activeScope.current === scope;
    const hasCachedSnapshot = () => queryClient.getQueryCache().getAll().some((query) =>
      shouldInvalidateLiveQuery(query.queryKey)
      && query.state.data !== undefined
      && query.state.dataUpdatedAt > 0,
    );

    const storageKey = `${STORAGE_PREFIX}:${scope}`;
    const previousAttempt = Number(window.localStorage.getItem(storageKey) || 0);
    if (!force && Date.now() - previousAttempt < LOCAL_DEDUP_WINDOW_MS) return;
    window.localStorage.setItem(storageKey, String(Date.now()));

    const task = withInFlightScope(inFlight.current, scope, async () => {
      try {
        if (isCurrentScope()) setState("refreshing");
        // Refresh only the selected scope's recent provider window. The
        // persisted snapshot remains the source for the selected historical
        // period; no global or historical reconciliation runs on navigation.
        const selectedBody = {
          adAccountId,
          adAccountIds,
          campaignIds,
          funnelIds,
          startDate: startDate ? startDateKey : undefined,
          endDate: endDate ? endDateKey : undefined,
          timezone,
          attributionWindow,
          includeMeta: true,
          includeRD: false,
          includeBalance: false,
          fast: true,
          // A manual action must reconcile the exact visible calendar. The
          // five-minute worker keeps using the cheaper recent watermark.
          syncMode: force ? "selected_period" as const : "recent_window" as const,
          recentHours: force ? undefined : RECENT_SYNC_WINDOW_HOURS,
          realtime: true,
          force,
        };
        // Meta and RD are independent providers. A slow Meta response must
        // not abort the CRM reconciliation that follows; otherwise a Meta
        // timeout leaves the RD snapshot stale even though its worker could
        // still complete safely in the background.
        let data: any = null;
        let metaError: unknown = null;
        try {
          const result = await withRequestTimeout(
            supabase.functions.invoke("controlled-realtime-sync", { body: selectedBody }),
            FAST_SYNC_TIMEOUT_MS,
          );
          data = result.data;
          metaError = result.error;
        } catch (error) {
          metaError = error;
        }
        const metaStatus = String(data?.meta_status || data?.results?.find?.((result: any) => result?.provider === "meta")?.status || data?.status || "success");
        const metaFailed = Boolean(metaError || data?.error || ["failed", "error"].includes(metaStatus));
        const metaFailureMessage = metaError instanceof Error
          ? metaError.message
          : String(metaError || data?.error || "A atualização em segundo plano falhou.");
        // The controlled endpoint aggregates Meta, RD and balance for audit
        // purposes. A pending RD page or balance refresh must not mark the Meta
        // KPI snapshot as failed; use the provider-specific status instead.
        const auxiliaryWarnings = Array.isArray(data?.warnings)
          ? data.warnings.map((warning: unknown) => String(warning)).join(" · ")
          : "";
        if (isCurrentScope()) {
          const failure = metaFailed
            ? describeSyncFailure({ hasSnapshot: hasCachedSnapshot(), provider: "Meta", message: metaFailureMessage })
            : null;
          setSyncError(failure?.message || auxiliaryWarnings || null);
          if (!metaFailed) setRdSyncError(null);
          if (data?.synced_at) setLastSyncAt(new Date(data.synced_at));
          setLastUpdatedAt(new Date());
          setState(failure?.state || (metaStatus === "partial" ? "partial" : ["failed", "error"].includes(metaStatus) ? "error" : "fresh"));
          if (!failure && ["failed", "partial", "error"].includes(metaStatus)) {
            setSyncError("Sincronização parcial dos KPIs principais; o último snapshot válido foi preservado.");
          }
        }
        invalidateLiveQueries();

        // Lead/form reconciliation is intentionally decoupled from the fast
        // KPI response. It can paginate through Meta without keeping the
        // navigation button disabled; Realtime invalidation refreshes the
        // lead cards as soon as the rows are persisted.
        if (!metaFailed) {
          void supabase.functions.invoke("sync-meta-leads", {
            body: {
              adAccountId,
              adAccountIds,
              ...(force ? { startDate: startDateKey, endDate: endDateKey } : {}),
              ...(force ? {} : { recentStartAt: selectedBody.recentHours ? new Date(Date.now() - selectedBody.recentHours * 3600_000).toISOString() : undefined, recentEndAt: new Date().toISOString() }),
              timezone,
              attributionWindow,
              triggerSource: "near_realtime_background",
            },
          }).catch((leadError) => {
            console.warn("[near-realtime-sync] leads em segundo plano", leadError);
          });
        }

        // RD is intentionally isolated from the selected Meta response. A
        // large CRM funnel must never delay or fail the visible ad snapshot;
        // its recent-window reconciliation still runs silently and Realtime
        // invalidates the CRM queries when rows arrive.
        const rdRefresh = withRequestTimeout(
          supabase.functions.invoke("controlled-realtime-sync", {
            body: {
              ...selectedBody,
              includeMeta: false,
              includeRD: true,
              includeBalance: false,
              fast: false,
            },
          }),
          RD_RECONCILIATION_TIMEOUT_MS,
        ).then(({ data: rdData, error: rdError }) => {
          if (rdError || rdData?.error || rdData?.rd_status === "failed") {
            const message = String(rdError || rdData?.error || "O RD Station não concluiu a sincronização.");
            console.warn("[near-realtime-sync] RD reconciliation", message);
            if (isCurrentScope()) {
              const failure = describeSyncFailure({ hasSnapshot: hasCachedSnapshot(), provider: "RD", message });
              setRdSyncError(failure.message);
              setState((current) => current === "error" ? current : failure.state);
            }
            return;
          }
          if (isCurrentScope()) setRdSyncError(null);
          invalidateLiveQueries();
        }).catch((rdError) => {
          console.warn("[near-realtime-sync] RD reconciliation", rdError);
          if (isCurrentScope()) {
            const message = rdError instanceof Error ? rdError.message : String(rdError);
            const failure = describeSyncFailure({ hasSnapshot: hasCachedSnapshot(), provider: "RD", message });
            setRdSyncError(failure.message);
            setState((current) => current === "error" ? current : failure.state);
          }
        });
        // The selected Meta snapshot is the response that unblocks the UI.
        // RD continues independently and invalidates CRM queries when it
        // finishes, so a large funnel cannot keep the sync button locked.
        void rdRefresh;

      } catch (error) {
        // Falha silenciosa: o histórico armazenado permanece visível e uma nova
        // tentativa ocorrerá ao recuperar foco ou no próximo ciclo.
        console.warn("[near-realtime-sync]", error);
        if (isCurrentScope()) {
          const message = error instanceof Error ? error.message : String(error);
          const failure = describeSyncFailure({ hasSnapshot: hasCachedSnapshot(), provider: "Meta", message });
          setSyncError(failure.message);
          setState(failure.state);
        }
      }
    });
    return task;
  }, [adAccountId, adAccountIds, attributionWindow, campaignIds, endDate, endDateKey, enabled, funnelIds, invalidateLiveQueries, queryClient, scope, startDate, startDateKey, timezone]);

  useEffect(() => {
    if (!enabled) return;
    // Revalida assim que a tela entra. O React Query mantém o último snapshot
    // visível enquanto esta chamada acontece em segundo plano.
    // Cada entrada/recarregamento solicita uma nova tentativa do escopo atual.
    // O lock persistido no backend continua impedindo duplicidade entre abas.
    const initial = window.setTimeout(() => void refresh(false), INITIAL_SYNC_DELAY_MS);
    const interval = window.setInterval(() => void refresh(false), REFRESH_INTERVAL_MS);
    const onFocus = () => void refresh(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, invalidateLiveQueries, refresh]);

  useEffect(() => {
    if (!enabled) return;
    let channel = supabase.channel(`live-data-${scope}-${Math.random().toString(36).slice(2)}`);
    for (const table of LIVE_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidateLiveQueries);
    }
    channel.subscribe();
    return () => {
      if (invalidateTimer.current) window.clearTimeout(invalidateTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, invalidateLiveQueries, scope]);

  return { state, lastUpdatedAt, lastSyncAt, syncError, rdSyncError, refresh };
}
