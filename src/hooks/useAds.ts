import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAds(adsetId?: string) {
  return useQuery({
    queryKey: ["ads", adsetId],
    enabled: !!adsetId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ads")
        .select("id, name, adset_id")
        .eq("adset_id", adsetId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
