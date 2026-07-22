import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export type BreakdownType = "age" | "gender" | "publisher_platform" | "platform_position";

export interface BreakdownSegment {
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
}

export interface CampaignBreakdowns {
  age: BreakdownSegment[];
  gender: BreakdownSegment[];
  publisher_platform: BreakdownSegment[];
  platform_position: BreakdownSegment[];
}

function aggregate(rows: any[]): BreakdownSegment[] {
  const map = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();
  for (const r of rows) {
    const key = String(r.segment_key);
    const ex = map.get(key) || { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    ex.spend += Number(r.spend || 0);
    ex.impressions += Number(r.impressions || 0);
    ex.clicks += Number(r.clicks || 0);
    ex.leads += Number(r.leads || 0);
    map.set(key, ex);
  }
  return Array.from(map.entries()).map(([key, v]) => ({
    key,
    ...v,
    cpl: v.leads > 0 ? v.spend / v.leads : 0,
    ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
  }));
}

export function useCampaignBreakdowns(campaignId?: string, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["campaign-breakdowns", campaignId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!campaignId,
    queryFn: async (): Promise<CampaignBreakdowns> => {
      let q = (supabase as any)
        .from("insights_breakdowns" as any)
        .select("breakdown_type, segment_key, spend, impressions, clicks, leads, date")
        .eq("campaign_id", campaignId!);
      if (startDate) q = q.gte("date", format(startDate, "yyyy-MM-dd"));
      if (endDate) q = q.lte("date", format(endDate, "yyyy-MM-dd"));
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      return {
        age: aggregate(rows.filter(r => r.breakdown_type === "age")),
        gender: aggregate(rows.filter(r => r.breakdown_type === "gender")),
        publisher_platform: aggregate(rows.filter(r => r.breakdown_type === "publisher_platform")),
        platform_position: aggregate(rows.filter(r => r.breakdown_type === "platform_position")),
      };
    },
  });
}
