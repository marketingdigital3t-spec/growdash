import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseControlledRealtimeSyncParams {
  adAccountId?: string;
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
  intervalMs?: number;
}

export type ControlledSyncStatus = "idle" | "syncing" | "success" | "skipped" | "error";

export function useControlledRealtimeSync({
  adAccountId,
  startDate,
  endDate,
  enabled = true,
  intervalMs = 10_000,
}: UseControlledRealtimeSyncParams) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ControlledSyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("Aguardando sincronização");
  const runningRef = useRef(false);

  const body = useMemo(() => ({
    adAccountId,
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
    includeMeta: true,
    includeRD: true,
    includeBalance: true,
    realtime: true,
  }), [adAccountId, endDate, startDate]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let failureCount = 0;

    const invokeControlledSync = async () => {
      const attempts = 2;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke("controlled-realtime-sync", { body });
          if (error) throw error;
          return data;
        } catch (error) {
          lastError = error;
          if (attempt < attempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1_500));
          }
        }
      }

      throw lastError;
    };

    const run = async () => {
      if (runningRef.current || cancelled) return;
      runningRef.current = true;
      setStatus("syncing");

      try {
        const data = await invokeControlledSync();

        const results = Array.isArray((data as any)?.results) ? (data as any).results : [];
        const failed = results.filter((item: any) => item.errors);
        const skipped = results.filter((item: any) => item.skipped);
        const synced = results.reduce((sum: number, item: any) => sum + Number(item.synced || 0), 0);

        if (!cancelled) {
          setLastSyncAt(new Date());
          if (failed.length > 0) {
            setStatus("error");
            setLastMessage(`${failed.length} sincronização(ões) com erro`);
            failureCount += 1;
          } else if (skipped.length === results.length && results.length > 0) {
            setStatus("skipped");
            setLastMessage(skipped[0]?.reason || "Ciclo protegido por intervalo mínimo");
            failureCount = 0;
          } else {
            setStatus("success");
            setLastMessage(`${synced} registro(s) sincronizado(s)`);
            failureCount = 0;
          }
        }

        queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
        queryClient.invalidateQueries({ queryKey: ["insights"] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] });
        queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] });
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        queryClient.invalidateQueries({ queryKey: ["campaigns_full"] });
      } catch (error) {
        if (!cancelled) {
          failureCount += 1;
          setStatus("error");
          const message = (error as Error).message || "";
          setLastMessage(
            message.includes("Failed to send a request")
              ? "Falha ao chamar a função de sincronização"
              : message || "Erro na sincronização controlada",
          );
        }
      } finally {
        runningRef.current = false;
      }
    };

    run();
    const timer = window.setInterval(() => {
      run();
      if (failureCount > 0) {
        window.setTimeout(run, Math.min(2_000 * failureCount, intervalMs));
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [body, enabled, intervalMs, queryClient]);

  return { status, lastSyncAt, lastMessage };
}
