import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface UseInsightsParams {
  adAccountId?: string;
  campaignId?: string;
  campaignIds?: string[];
  objectives?: string[];
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

export interface InsightRow {
  ad_id: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpm: number;
  frequency: number;
  leads: number;
  cpl: number;
  conversion_rate: number;
  efficiency_rate: number;
  health_score: number;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  campaign_objective?: string | null;
  thumbnail_url?: string | null;
  ad_status?: string | null;
  adset_status?: string | null;
  campaign_status?: string | null;
  campaign_id?: string | null;
  ad_account_id?: string | null;
}

export function useInsights({ adAccountId, campaignId, campaignIds, objectives, startDate, endDate, enabled = true }: UseInsightsParams) {
  return useQuery({
    queryKey: ["insights", adAccountId, campaignId, campaignIds?.join(","), objectives?.join(","), startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endDate, "yyyy-MM-dd");

      let query = (supabase as any)
        .from("insights")
        .select(`
          ad_id, date, spend, impressions, reach, clicks, ctr, cpm, frequency,
          leads, cpl, conversion_rate, efficiency_rate, health_score,
          ads!inner(
            name,
            status,
            thumbnail_url,
            adsets!inner(
              name,
              status,
              campaigns!inner(
                id,
                name,
                status,
                objective,
                ad_account_id
              )
            )
          )
        `)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (adAccountId) {
        query = query.eq("ads.adsets.campaigns.ad_account_id", adAccountId);
      }

      if (campaignId) {
        query = query.eq("ads.adsets.campaigns.id", campaignId);
      }

      if (campaignIds && campaignIds.length > 0) {
        query = query.in("ads.adsets.campaigns.id", campaignIds);
      }

      if (objectives && objectives.length > 0) {
        query = query.in("ads.adsets.campaigns.objective", objectives);
      }

      // Paginar para evitar o limite default de 1000 linhas do Supabase.
      const PAGE = 1000;
      const MAX_PAGES = 20;
      let allRows: any[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await query.range(from, to);
        if (error) throw error;
        const batch = data || [];
        allRows = allRows.concat(batch);
        if (batch.length < PAGE) break;
        if (page === MAX_PAGES - 1) {
          console.warn(`[useInsights] hit MAX_PAGES (${MAX_PAGES}) — possible truncation`);
        }
      }

      return allRows.map((row: any) => ({
        ad_id: row.ad_id,
        date: row.date,
        spend: row.spend ?? 0,
        impressions: row.impressions ?? 0,
        reach: row.reach ?? 0,
        clicks: row.clicks ?? 0,
        ctr: row.ctr ?? 0,
        cpm: row.cpm ?? 0,
        frequency: row.frequency ?? 0,
        leads: row.leads ?? 0,
        cpl: row.cpl ?? 0,
        conversion_rate: row.conversion_rate ?? 0,
        efficiency_rate: row.efficiency_rate ?? 0,
        health_score: row.health_score ?? 0,
        ad_name: row.ads?.name ?? "",
        thumbnail_url: row.ads?.thumbnail_url ?? null,
        adset_name: row.ads?.adsets?.name ?? "",
        campaign_name: row.ads?.adsets?.campaigns?.name ?? "",
        campaign_objective: row.ads?.adsets?.campaigns?.objective ?? null,
        ad_status: row.ads?.status ?? null,
        adset_status: row.ads?.adsets?.status ?? null,
        campaign_status: row.ads?.adsets?.campaigns?.status ?? null,
        campaign_id: row.ads?.adsets?.campaigns?.id ?? null,
        ad_account_id: row.ads?.adsets?.campaigns?.ad_account_id ?? null,
      })) as InsightRow[];
    },
    enabled,
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
