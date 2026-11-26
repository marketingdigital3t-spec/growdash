import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UtmField = "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" | "ad_id";
export type MatchStrategy = "exact" | "normalized" | "contains";

export interface AccountUtmMapping {
  id: string;
  ad_account_id: string;
  campaign_utm: UtmField;
  adset_utm: UtmField;
  creative_utm: UtmField;
  platform_utm: UtmField;
  match_strategy: MatchStrategy;
}

export const DEFAULT_MAPPING = {
  campaign_utm: "utm_campaign" as UtmField,
  adset_utm: "utm_term" as UtmField,
  creative_utm: "utm_content" as UtmField,
  platform_utm: "utm_source" as UtmField,
  match_strategy: "normalized" as MatchStrategy,
};

export function useAccountUtmMappings() {
  return useQuery({
    queryKey: ["account_utm_mapping"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_utm_mapping").select("*");
      if (error) throw error;
      return (data ?? []) as AccountUtmMapping[];
    },
  });
}

export function useAccountUtmMappingMap() {
  const q = useAccountUtmMappings();
  const map = new Map<string, AccountUtmMapping>();
  (q.data ?? []).forEach((m) => map.set(m.ad_account_id, m));
  return { map, isLoading: q.isLoading };
}

export function useUpsertAccountUtmMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<AccountUtmMapping> & { ad_account_id: string }) => {
      const { error } = await supabase
        .from("account_utm_mapping")
        .upsert({ ...DEFAULT_MAPPING, ...input }, { onConflict: "ad_account_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account_utm_mapping"] }),
  });
}
