import { useQuery } from "@tanstack/react-query";
import { businessDateKey } from "@/lib/businessDate";
import { supabase } from "@/integrations/supabase/client";

export type BreakdownType = "age" | "gender" | "region" | "country" | "publisher_platform" | "platform_position";

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
  region: BreakdownSegment[];
  country: BreakdownSegment[];
  publisher_platform: BreakdownSegment[];
  platform_position: BreakdownSegment[];
  device: BreakdownSegment[];
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
    queryKey: ["campaign-breakdowns", campaignId, startDate ? businessDateKey(startDate) : null, endDate ? businessDateKey(endDate) : null],
    enabled: !!campaignId,
    queryFn: async (): Promise<CampaignBreakdowns> => {
      let q = supabase
        .from("insights_breakdowns" as any)
        .select("breakdown_type, segment_key, spend, impressions, clicks, leads, date")
        .eq("campaign_id", campaignId!);
      if (startDate) q = q.gte("date", businessDateKey(startDate));
      if (endDate) q = q.lte("date", businessDateKey(endDate));
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      return {
        age: aggregate(rows.filter(r => r.breakdown_type === "age")),
        gender: aggregate(rows.filter(r => r.breakdown_type === "gender")),
        region: aggregate(rows.filter(r => r.breakdown_type === "region")),
        country: aggregate(rows.filter(r => r.breakdown_type === "country")),
        publisher_platform: aggregate(rows.filter(r => r.breakdown_type === "publisher_platform")),
        platform_position: aggregate(rows.filter(r => r.breakdown_type === "platform_position")),
        device: aggregate(rows.filter(r => r.breakdown_type === "platform_position" && /·\s*[^·]+\s*·/.test(String(r.segment_key || "")))),
      };
    },
  });
}
