import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";

interface SyncParams {
  adAccountId?: string;
  adAccountIds?: string[];
  startDate: string;
  endDate: string;
  includeBreakdowns?: boolean;
}

type SyncResponse = {
  success?: boolean;
  synced?: number;
  accounts?: number;
  errors?: string[];
  needs_reauth?: boolean;
  error?: string;
};

async function invokeSyncFunction(name: string, body: Record<string, unknown>): Promise<SyncResponse> {
  let result = await supabase.functions.invoke(name, { body });
  if (result.error) {
    const first = await edgeFunctionErrorDetails(result.error);
    if (first.status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) result = await supabase.functions.invoke(name, { body });
    }
  }
  if (result.error) {
    const details = await edgeFunctionErrorDetails(result.error);
    throw Object.assign(new Error(formatEdgeFunctionError(details)), { details });
  }
  const data = (result.data ?? {}) as SyncResponse;
  if (data.error || data.success === false) {
    throw Object.assign(new Error(data.error || data.errors?.join(" · ") || "A Meta recusou a sincronização."), {
      details: { needsReauth: Boolean(data.needs_reauth) },
    });
  }
  return data;
}

export function useSyncMeta() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncParams) => {
      const body = {
        adAccountId: params.adAccountId,
        adAccountIds: params.adAccountIds,
        startDate: params.startDate,
        endDate: params.endDate,
        includeBreakdowns: params.includeBreakdowns === true,
      };
      // Hourly reconciliation reads the daily rows. Running both in parallel
      // caused races, inflated API usage and occasional non-2xx responses.
      const insights = await invokeSyncFunction("sync-meta-insights", body);
      let hourly: SyncResponse = {};
      let hourlyWarning: string | undefined;
      try {
        hourly = await invokeSyncFunction("sync-meta-hourly", body);
      } catch (error) {
        hourlyWarning = error instanceof Error ? error.message : "Relatório horário pendente.";
      }
      return {
        ...insights,
        synced: Number(insights.synced ?? 0),
        accounts: Number(insights.accounts ?? 0),
        hourly_synced: Number(hourly.synced ?? 0),
        errors: [...(insights.errors ?? []), ...(hourly.errors ?? []), ...(hourlyWarning ? [hourlyWarning] : [])],
      };
    },
    onSuccess: (data) => {
      // Refresh every view that reads the synchronized daily/hourly rows,
      // including the action totals used by Forms/site/conversation KPIs.
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      void queryClient.invalidateQueries({ queryKey: ["insights_hourly"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns_full"] });
      void queryClient.invalidateQueries({ queryKey: ["action-totals-by-ads"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign-breakdown-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign-breakdowns"] });
      void queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      toast({
        title: "Sincronização concluída!",
        description: `${data.synced} registros diários e ${data.hourly_synced} horários em ${data.accounts} conta(s).${data.errors?.length ? ` ⚠️ ${data.errors.length} aviso(s).` : ""}`,
      });
    },
    onError: (e: Error & { details?: { needsReauth?: boolean } }) => {
      toast({
        title: e.details?.needsReauth ? "Reconecte a conta Meta Ads" : "Erro na sincronização",
        description: e.details?.needsReauth ? `${e.message} Abra Integrações → Tráfego pago e reconecte a conta.` : e.message,
        variant: "destructive",
      });
    },
  });
}
