import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Realtime database writes keep visible data current. The external Meta/RD
// reconciliation is deliberately less frequent so it does not monopolise the
// browser whenever someone changes tabs or returns to the application.
// The sync function fetches deltas, so a short watermark window keeps the CRM
// close to RD without re-running a full historical reconciliation.
const REFRESH_INTERVAL_MS = 10 * 60_000;
const LOCAL_DEDUP_WINDOW_MS = 9 * 60_000;
const STORAGE_PREFIX = "growdash:last-background-sync";
// A Meta/RD sync can write several related rows in rapid succession. Waiting
// for a quiet window prevents each write from reloading the same heavy traffic
// queries and making every tab appear to refresh continuously.
const REALTIME_UI_BATCH_MS = 1_000;

const LIVE_TABLES = [
  "ad_accounts", "campaigns", "adsets", "ads", "insights", "insights_hourly",
  "rd_deals", "sales", "alerts", "social_media", "social_insights_daily",
  "financial_entries", "kanban_boards", "kanban_cards", "workspace_files",
] as const;

// A realtime write must refresh live data, but invalidating every cached query
// makes expensive route modules re-render together and can freeze navigation.
// Keep the list explicit and restricted to data fed by the realtime tables.
const LIVE_QUERY_PREFIXES = new Set([
  "ad_accounts", "campaigns", "campaigns_full", "meta-adsets-independent", "meta-ads-independent",
  "insights", "insights_hourly", "daily_spend_by_account", "daily_budget_active_by_account",
  "rd_deals", "rd_crm_deals", "rd_deals_period", "rd_won_deals_period", "rd_funnel_stages",
  "sales", "alerts", "social_accounts", "social_media", "social_insights_daily",
  "financial-entries", "financial-history", "kanban_boards", "kanban_board_details", "workspace-files",
]);

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
  const inFlight = useRef<Promise<void> | null>(null);
  const initialGlobalSync = useRef(true);
  const invalidateTimer = useRef<number | null>(null);
  const [state, setState] = useState<SyncState>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const scope = `${adAccountId || adAccountIds?.slice().sort().join(",") || "all"}:${campaignIds?.slice().sort().join(",") || "all-campaigns"}:${funnelIds?.slice().sort().join(",") || "all-funnels"}:${startDate?.toISOString().slice(0, 10) || "today"}:${endDate?.toISOString().slice(0, 10) || "today"}:${timezone || "account"}:${attributionWindow || "account_default"}`;

  const invalidateLiveQueries = useCallback(() => {
    if (invalidateTimer.current) window.clearTimeout(invalidateTimer.current);
    invalidateTimer.current = window.setTimeout(() => {
      // Only queries derived from realtime tables become stale. This preserves
      // cached permission/layout/module data while a person changes pages.
      void queryClient.invalidateQueries({
        predicate: (query) => LIVE_QUERY_PREFIXES.has(String(query.queryKey[0])),
      });
      setLastUpdatedAt(new Date());
    }, REALTIME_UI_BATCH_MS);
  }, [queryClient]);

  const refresh = useCallback(async (force = false) => {
    if (!enabled || !navigator.onLine || document.visibilityState === "hidden") return;
    if (inFlight.current) return inFlight.current;

    const storageKey = `${STORAGE_PREFIX}:${scope}`;
    const previousAttempt = Number(window.localStorage.getItem(storageKey) || 0);
    if (!force && Date.now() - previousAttempt < LOCAL_DEDUP_WINDOW_MS) return;
    window.localStorage.setItem(storageKey, String(Date.now()));

    const task = (async () => {
      setState("refreshing");
      // The selected slice must be refreshed first. A global reconciliation
      // can include many accounts/funnels and may legitimately outlive the
      // browser request timeout; it must never prevent the selected cards
      // from being populated. Once the selected slice returns, start the
      // global pass in the background on the first entry.
      const global = initialGlobalSync.current;
      initialGlobalSync.current = false;
      const selectedBody = {
        adAccountId,
        adAccountIds,
        campaignIds,
        funnelIds,
        startDate: startDate?.toISOString().slice(0, 10),
        endDate: endDate?.toISOString().slice(0, 10),
        timezone,
        attributionWindow,
        includeMeta: true,
        includeRD: true,
        includeBalance: true,
        realtime: true,
        force,
      };
      const { data, error } = await supabase.functions.invoke("controlled-realtime-sync", {
        body: selectedBody,
      });
      const metaStatus = String(data?.meta_status || data?.results?.find?.((result: any) => result?.provider === "meta")?.status || data?.status || "success");
      if (error || data?.error || ["failed", "error"].includes(metaStatus)) {
        throw error || new Error(data?.error || "A atualização em segundo plano falhou.");
      }
      // The controlled endpoint aggregates Meta, RD and balance for audit
      // purposes. A pending RD page or balance refresh must not mark the Meta
      // KPI snapshot as failed; use the provider-specific status instead.
      const auxiliaryWarnings = Array.isArray(data?.warnings)
        ? data.warnings.map((warning: unknown) => String(warning)).join(" · ")
        : "";
      setSyncError(auxiliaryWarnings || null);
      if (data?.synced_at) setLastSyncAt(new Date(data.synced_at));
      setLastUpdatedAt(new Date());
      setState(metaStatus === "partial" ? "partial" : ["failed", "error"].includes(metaStatus) ? "error" : "fresh");
      if (["failed", "partial", "error"].includes(metaStatus)) {
        setSyncError("Sincronização parcial dos KPIs principais; o último snapshot válido foi preservado.");
      }
      invalidateLiveQueries();

      if (global) {
        // Do not await this request. It is deliberately global and is only
        // responsible for warming every account/funnel for the next visit.
        // The selected response above remains the source of the current UI.
        void supabase.functions.invoke("controlled-realtime-sync", {
          body: {
            ...selectedBody,
            adAccountId: undefined,
            adAccountIds: undefined,
            funnelIds: undefined,
          },
        }).then(({ data: globalData, error: globalError }) => {
          if (globalError || globalData?.error) {
            console.warn("[near-realtime-sync] global reconciliation", globalError || globalData?.error);
            return;
          }
          invalidateLiveQueries();
        }).catch((globalError) => {
          console.warn("[near-realtime-sync] global reconciliation", globalError);
        });
      }
    })().catch((error) => {
      // Falha silenciosa: o histórico armazenado permanece visível e uma nova
      // tentativa ocorrerá ao recuperar foco ou no próximo ciclo.
      console.warn("[near-realtime-sync]", error);
      setSyncError(error instanceof Error ? error.message : String(error));
      setState("error");
    }).finally(() => {
      inFlight.current = null;
    });

    inFlight.current = task;
    return task;
  }, [adAccountId, adAccountIds, attributionWindow, campaignIds, endDate, enabled, funnelIds, invalidateLiveQueries, scope, startDate, timezone]);

  useEffect(() => {
    if (!enabled) return;
    // Revalida assim que a tela entra. O React Query mantém o último snapshot
    // visível enquanto esta chamada acontece em segundo plano.
    // Cada entrada/recarregamento solicita uma nova tentativa do escopo atual.
    // O lock persistido no backend continua impedindo duplicidade entre abas.
    const initial = window.setTimeout(() => void refresh(true), 0);
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

  return { state, lastUpdatedAt, lastSyncAt, syncError, refresh };
}
