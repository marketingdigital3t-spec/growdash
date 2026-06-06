import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncParams {
  adAccountId?: string;
  startDate: string;
  endDate: string;
}

export function useSyncMeta() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncParams) => {
      const [insightsResult, hourlyResult] = await Promise.allSettled([
        supabase.functions.invoke("sync-meta-insights", {
          body: { adAccountId: params.adAccountId, startDate: params.startDate, endDate: params.endDate },
        }),
        supabase.functions.invoke("sync-meta-hourly", {
          body: { adAccountId: params.adAccountId, startDate: params.startDate, endDate: params.endDate },
        }),
      ]);

      if (insightsResult.status === "rejected") throw insightsResult.reason;
      const insightsRes = insightsResult.value;
      if (insightsRes.error) throw insightsRes.error;
      if (insightsRes.data?.error && !insightsRes.data?.success) throw new Error(insightsRes.data.error);

      const hourlyErrors: string[] = [];
      let hourlySynced = 0;
      if (hourlyResult.status === "fulfilled") {
        if (hourlyResult.value.error) hourlyErrors.push(hourlyResult.value.error.message);
        if (hourlyResult.value.data?.error && !hourlyResult.value.data?.success) hourlyErrors.push(hourlyResult.value.data.error);
        hourlySynced = hourlyResult.value.data?.synced ?? 0;
      } else {
        hourlyErrors.push(hourlyResult.reason?.message || "Falha ao chamar sync-meta-hourly");
      }

      return {
        ...insightsRes.data,
        hourly_synced: hourlySynced,
        errors: [...(insightsRes.data?.errors ?? []), ...hourlyErrors],
      };
    },
    onSuccess: (data) => {
      const errors = Array.isArray(data.errors) ? data.errors.filter(Boolean) : [];
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns_full"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["insight_actions"] });
      queryClient.invalidateQueries({ queryKey: ["campaign_breakdowns"] });
      toast({
        title: "Sincronização concluída!",
        description: `${data.synced} registros atualizados de ${data.accounts} conta(s).${errors.length > 0 ? ` Atenção: ${errors.slice(0, 2).join(" | ")}` : ""}`,
      });
    },
    onError: (e) => {
      toast({
        title: "Erro na sincronização",
        description: (e as Error).message,
        variant: "destructive",
      });
    },
  });
}
