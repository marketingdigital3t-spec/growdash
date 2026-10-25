import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCampaigns(adAccountId?: string, adAccountIds?: string[]) {
  return useQuery({
    queryKey: ["campaigns", adAccountId, adAccountIds?.slice().sort().join(",")],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select("id, name, ad_account_id, status, objective, daily_budget, lifetime_budget, created_at")
        .order("created_at", { ascending: false });

      if (adAccountIds?.length) {
        query = query.in("ad_account_id", adAccountIds);
      } else if (adAccountId) {
        query = query.eq("ad_account_id", adAccountId);
      }

      const PAGE = 1000;
      const all: Array<{
        id: string;
        name: string | null;
        ad_account_id: string;
        status: string | null;
        objective: string | null;
        daily_budget: number | null;
        lifetime_budget: number | null;
        created_at: string | null;
      }> = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        const batch = data || [];
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      return all;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
