import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BreakdownSegment, MetaBreakdowns } from "@/lib/metaTraffic";
import { filterMetaBreakdownsByAttribution } from "@/lib/metaBreakdownScope";

const TYPES: Array<[keyof MetaBreakdowns, string[]]> = [
  ["age", ["age"]],
  ["gender", ["gender"]],
  ["region", ["region"]],
  ["country", ["country"]],
  ["platform", ["publisher_platform"]],
  ["placement", ["platform_position"]],
  ["device", ["platform_position"]],
];

const empty = (): MetaBreakdowns => ({ age: [], gender: [], region: [], country: [], platform: [], placement: [], device: [] });

function aggregate(rows: any[]): BreakdownSegment[] {
  const grouped = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();
  for (const row of rows) {
    const key = String(row.segment_key || "indisponível");
    const current = grouped.get(key) || { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    current.spend += Number(row.spend || 0);
    current.impressions += Number(row.impressions || 0);
    current.clicks += Number(row.clicks || 0);
    current.leads += Number(row.leads || 0);
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([key, value]) => ({
    key,
    ...value,
    cpl: value.leads > 0 ? value.spend / value.leads : 0,
    ctr: value.impressions > 0 ? value.clicks / value.impressions * 100 : 0,
    cpm: value.impressions > 0 ? value.spend / value.impressions * 1000 : 0,
  })).sort((a, b) => b.spend - a.spend);
}

export function useMetaBreakdowns(campaignIds: string[], startDate: string, endDate: string, enabled = true, attributionWindowByCampaign: Record<string, string> = {}) {
  const ids = [...new Set(campaignIds.filter(Boolean))].sort();
  const attributionSignature = JSON.stringify(Object.entries(attributionWindowByCampaign).sort(([a], [b]) => a.localeCompare(b)));
  return useQuery({
    queryKey: ["meta-breakdowns", ids.join(","), startDate, endDate, attributionSignature],
    enabled: enabled && ids.length > 0,
    queryFn: async () => {
      const result = empty();
      for (const [target, sourceTypes] of TYPES) {
        const rows: any[] = [];
        for (let offset = 0; offset < ids.length; offset += 200) {
          const { data, error } = await supabase
            .from("insights_breakdowns" as any)
            .select("breakdown_type,segment_key,spend,impressions,clicks,leads,date,attribution_window")
            .in("campaign_id", ids.slice(offset, offset + 200))
            .in("breakdown_type", sourceTypes)
            .gte("date", startDate)
            .lte("date", endDate);
          if (error) throw error;
          rows.push(...(data || []));
        }
        const correctlyAttributed = filterMetaBreakdownsByAttribution(rows, attributionWindowByCampaign);
        if (target === "device") {
          result.device = aggregate(correctlyAttributed.filter((row) => /·\s*[^·]+\s*·/.test(String(row.segment_key || ""))));
        } else if (target === "placement") {
          result.placement = aggregate(correctlyAttributed.filter((row) => String(row.segment_key || "").includes("·")));
        } else {
          result[target] = aggregate(correctlyAttributed);
        }
      }
      return result;
    },
    staleTime: 120_000,
  });
}
