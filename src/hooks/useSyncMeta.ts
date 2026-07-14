import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncParams {
  adAccountId?: string;
  startDate: string;
  endDate: string;
}

export function useSyncMeta() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: SyncParams) => {
      const [insightsRes, hourlyRes] = await Promise.all([
        supabase.functions.invoke("sync-meta-insights", {
          body: { adAccountId: params.adAccountId, startDate: params.startDate, endDate: params.endDate },
        }),
        supabase.functions.invoke("sync-meta-hourly", {
          body: { adAccountId: params.adAccountId, startDate: params.startDate, endDate: params.endDate },
        }),
      ]);
      if (insightsRes.error) throw insightsRes.error;
      if (insightsRes.data?.error && !insightsRes.data?.success) throw new Error(insightsRes.data.error);
      return {
        ...insightsRes.data,
        hourly_synced: hourlyRes.data?.synced ?? 0,
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronização concluída!",
        description: `${data.synced} registros atualizados de ${data.accounts} conta(s).${data.errors ? ` ⚠️ ${data.errors.length} erro(s).` : ""}`,
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
