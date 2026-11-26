import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InsightRow } from "@/hooks/useInsights";

/** Busca o anúncio pelo ID em todo o histórico da conta, sem depender do
 * período atualmente escolhido no calendário. */
export function useLeadAttributionCatalog(adAccountId?: string | null, adIds: string[] = []) {
  const ids = Array.from(new Set(adIds.map(String).filter(Boolean))).sort();
  return useQuery({
    queryKey: ["lead_attribution_catalog", adAccountId ?? "", ids.join(",")],
    enabled: Boolean(adAccountId && ids.length),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights")
        .select("ad_id,adset_id,campaign_id,adset_name,campaign_name,ad_name,ad_account_id")
        .eq("ad_account_id", adAccountId!)
        .in("ad_id", ids)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as InsightRow[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
