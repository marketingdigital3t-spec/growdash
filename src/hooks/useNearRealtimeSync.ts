import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Realtime database writes keep visible data current. The external Meta/RD
// reconciliation is deliberately less frequent so it does not monopolise the
// browser whenever someone changes tabs or returns to the application.
const REFRESH_INTERVAL_MS = 5 * 60_000;
const LOCAL_DEDUP_WINDOW_MS = 4 * 60_000;
const STORAGE_PREFIX = "growdash:last-background-sync";
// A Meta/RD sync can write several related rows in rapid succession. Waiting
// for a quiet window prevents each write from reloading the same heavy traffic
// queries and making every tab appear to refresh continuously.
const REALTIME_UI_BATCH_MS = 15_000;

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

type SyncState = "idle" | "refreshing" | "fresh" | "error";

interface Params {
  adAccountId?: string;
  enabled?: boolean;
}

/**
 * Stale-while-revalidate para Meta Ads + RD Station.
 *
 * As telas leem primeiro o último snapshot local (histórico já sincronizado).
 * A rotina externa só consulta o delta do dia corrente em segundo plano; cada
 * gravação no banco é recebida em realtime e agrupada por no máximo um segundo.
 * Assim, os KPIs permanecem visíveis e mudam sem um loader central nem novo
 * backfill do histórico a cada navegação.
 */
export function useNearRealtimeSync({ adAccountId, enabled = true }: Params = {}) {
  const queryClient = useQueryClient();
  const inFlight = useRef<Promise<void> | null>(null);
  const invalidateTimer = useRef<number | null>(null);
  const [state, setState] = useState<SyncState>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const scope = adAccountId || "all";

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
      const { data, error } = await supabase.functions.invoke("controlled-realtime-sync", {
        body: {
          adAccountId,
          includeMeta: true,
          includeRD: true,
          includeBalance: true,
          realtime: true,
          force,
        },
      });
      if (error || data?.error || data?.success === false) {
        throw error || new Error(data?.error || "A atualização em segundo plano falhou.");
      }
      setLastUpdatedAt(new Date());
      setState("fresh");
      invalidateLiveQueries();
    })().catch((error) => {
      // Falha silenciosa: o histórico armazenado permanece visível e uma nova
      // tentativa ocorrerá ao recuperar foco ou no próximo ciclo.
      console.warn("[near-realtime-sync]", error);
      setState("error");
    }).finally(() => {
      inFlight.current = null;
    });

    inFlight.current = task;
    return task;
  }, [adAccountId, enabled, invalidateLiveQueries, scope]);

  useEffect(() => {
    if (!enabled) return;
    // A primeira pintura deve mostrar o cache local. A sincronização com Meta/RD
    // só entra depois que a tela já ficou utilizável.
    const initial = window.setTimeout(() => void refresh(false), 4_000);
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

  return { state, lastUpdatedAt, refresh };
}
