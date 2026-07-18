import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REFRESH_INTERVAL_MS = 15 * 60 * 1_000;
const LOCAL_DEDUP_WINDOW_MS = 60_000;
const STORAGE_PREFIX = "growdash:last-background-sync";

type SyncState = "idle" | "refreshing" | "fresh" | "error";

interface Params {
  adAccountId?: string;
  enabled?: boolean;
}

/**
 * Stale-while-revalidate para Meta Ads + RD Station.
 *
 * As telas leem primeiro o banco local (histórico já sincronizado) e esta rotina
 * atualiza apenas o dia corrente em segundo plano. A Edge Function possui uma
 * segunda trava persistida, então várias abas/dispositivos continuam seguros.
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
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
        queryClient.invalidateQueries({ queryKey: ["insights_hourly"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns_full"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-adsets-independent"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-ads-independent"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] }),
        queryClient.invalidateQueries({ queryKey: ["ad_accounts"] }),
      ]);
    }, 350);
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
    const initial = window.setTimeout(() => void refresh(false), 650);
    const interval = window.setInterval(() => void refresh(false), REFRESH_INTERVAL_MS);
    const onFocus = () => {
      invalidateLiveQueries();
      void refresh(false);
    };
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
    const channel = supabase.channel(`live-data-${scope}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "insights" }, invalidateLiveQueries)
      .on("postgres_changes", { event: "*", schema: "public", table: "insights_hourly" }, invalidateLiveQueries)
      .on("postgres_changes", { event: "*", schema: "public", table: "rd_deals" }, invalidateLiveQueries)
      .subscribe();
    return () => {
      if (invalidateTimer.current) window.clearTimeout(invalidateTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, invalidateLiveQueries, scope]);

  return { state, lastUpdatedAt, refresh };
}
