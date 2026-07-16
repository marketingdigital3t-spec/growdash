import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCampaigns(adAccountId?: string) {
  return useQuery({
    queryKey: ["campaigns", adAccountId],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select("id, name, ad_account_id, status, objective, created_at")
        .order("created_at", { ascending: false });

      if (adAccountId) {
        query = query.eq("ad_account_id", adAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
