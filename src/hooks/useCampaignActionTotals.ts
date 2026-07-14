import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignActionTotal {
  action_type: string;
  total: number;
  total_value: number;
}

/** Soma todos os action_types do Meta para uma campanha (via insight_actions ↔ ads ↔ adsets ↔ campaign). */
export function useCampaignActionTotals(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign-action-totals", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<CampaignActionTotal[]> => {
      // 1) ads dessa campanha
      const { data: adsetRows, error: aErr } = await supabase
        .from("adsets")
        .select("id")
        .eq("campaign_id", campaignId!);
      if (aErr) throw aErr;
      const adsetIds = (adsetRows || []).map((r: any) => r.id);
      if (adsetIds.length === 0) return [];
      const { data: adsRows, error: a2Err } = await supabase
        .from("ads")
        .select("id")
        .in("adset_id", adsetIds);
      if (a2Err) throw a2Err;
      const adIds = (adsRows || []).map((r: any) => r.id);
      if (adIds.length === 0) return [];

      // 2) somar actions
      const map = new Map<string, { total: number; total_value: number }>();
      // paginate to avoid 1000 limit
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("insight_actions" as any)
          .select("action_type, value, value_amount")
          .in("ad_id", adIds)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as any[];
        for (const r of rows) {
          const ex = map.get(r.action_type) || { total: 0, total_value: 0 };
          ex.total += Number(r.value || 0);
          ex.total_value += Number(r.value_amount || 0);
          map.set(r.action_type, ex);
        }
        if (rows.length < PAGE) break;
      }
      return Array.from(map.entries())
        .map(([action_type, v]) => ({ action_type, ...v }))
        .sort((a, b) => b.total - a.total);
    },
  });
}
