import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { businessDateKey } from "@/lib/businessDate";
import { shouldInvalidateLiveQuery } from "@/lib/liveQueryInvalidation";
import { withInFlightScope } from "@/lib/inFlightByScope";
import { withRequestTimeout } from "@/lib/resilience";
import { describeSyncFailure } from "@/lib/syncStatus";
import { backgroundSyncStatus, shouldForceSyncForContextChange, SYNC_UI_DEADLINE_MS, type SyncContext } from "@/lib/nearRealtimeSyncPolicy";

// Realtime database writes keep visible data current. The external Meta/RD
// reconciliation is deliberately less frequent so it does not monopolise the
// browser whenever someone changes tabs or returns to the application.
// The sync function fetches deltas, so a short watermark window keeps the CRM
// close to RD without re-running a full historical reconciliation.
// Provider reconciliation is intentionally quarter-hourly. Realtime database
// events keep already-persisted rows current between cycles without starting
// another Meta/RD request for every UI update.
export const BACKGROUND_SYNC_INTERVAL_MS = 15 * 60_000;
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
// The interface has a five-second response budget. This is only the visual
// deadline: the provider request keeps running and its eventual persisted
// snapshot is picked up by Realtime/React Query. A slow provider must not keep
// the toolbar locked while a previously confirmed snapshot remains usable.
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
type SyncState = "idle" | "refreshing" | "background" | "fresh" | "partial" | "error";

interface Params {
  adAccountId?: string;
  adAccountIds?: string[];
  campaignIds?: string[];
  funnelIds?: string[];
  timezone?: string;
  attributionWindow?: string;
  startDate?: Date;
  endDate?: Date;
  /** Route/query identity. Changing tabs must refresh the selected scope. */
  navigationKey?: string;
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
export function useNearRealtimeSync({ adAccountId, adAccountIds, campaignIds, funnelIds, timezone, attributionWindow, startDate, endDate, navigationKey = "", enabled = true }: Params = {}) {
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
  const refreshRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const previousContext = useRef<SyncContext | null>(null);

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
        const metaRequest = supabase.functions.invoke("controlled-realtime-sync", { body: selectedBody });
        let data: any = null;
        let metaError: unknown = null;
        let metaTimedOut = false;
        try {
          const result = await withRequestTimeout(
            metaRequest,
            SYNC_UI_DEADLINE_MS,
          );
          data = result.data;
          metaError = result.error;
        } catch (error) {
          if (error instanceof Error && /tempo|timeout|excedido/i.test(error.message)) {
            metaTimedOut = true;
            if (isCurrentScope()) {
              setSyncError(backgroundSyncStatus().message);
              setLastUpdatedAt(new Date());
              setState(backgroundSyncStatus().state);
            }
            // Do not cancel the Edge Function. It may still persist a valid
            // snapshot after the five-second UI deadline.
            void metaRequest.then(({ data: lateData, error: lateError }) => {
              if (lateError || lateData?.error || ["failed", "error"].includes(String(lateData?.meta_status || lateData?.status || ""))) {
                if (isCurrentScope()) {
                  setSyncError("Meta não concluiu a atualização. O último snapshot válido permanece visível.");
                  setState(hasCachedSnapshot() ? "partial" : "error");
                }
                return;
              }
              if (isCurrentScope()) {
                setSyncError(null);
                if (lateData?.synced_at) setLastSyncAt(new Date(lateData.synced_at));
                setLastUpdatedAt(new Date());
                setState(String(lateData?.meta_status || lateData?.status || "success") === "partial" ? "partial" : "fresh");
              }
              invalidateLiveQueries();
            }).catch((lateError) => {
              console.warn("[near-realtime-sync] Meta reconciliation after UI deadline", lateError);
              if (isCurrentScope()) {
                setSyncError("Meta não concluiu a atualização. O último snapshot válido permanece visível.");
                setState(hasCachedSnapshot() ? "partial" : "error");
              }
            });
          } else {
            metaError = error;
          }
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
        if (isCurrentScope() && !metaTimedOut) {
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

  // Keep the timer attached to the current callback without restarting it on
  // every render when a parent supplies a new array reference.
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const context: SyncContext = { scope, navigationKey };
    const forceContextSync = shouldForceSyncForContextChange(previousContext.current, context);
    previousContext.current = context;
    // Revalida uma vez ao entrar no escopo. O React Query mantém o último
    // snapshot visível enquanto esta chamada acontece em segundo plano; novas
    // reconciliações automáticas acontecem somente no ciclo de quinze minutos.
    // O lock persistido no backend continua impedindo duplicidade entre abas.
    const initial = window.setTimeout(() => void refreshRef.current?.(forceContextSync), forceContextSync ? 0 : INITIAL_SYNC_DELAY_MS);
    const interval = window.setInterval(() => void refreshRef.current?.(false), BACKGROUND_SYNC_INTERVAL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [enabled, invalidateLiveQueries, navigationKey, scope]);

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
