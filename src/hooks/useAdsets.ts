import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdsets(campaignId?: string) {
  return useQuery({
    queryKey: ["adsets", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adsets")
        .select("id, name, campaign_id")
        .eq("campaign_id", campaignId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
