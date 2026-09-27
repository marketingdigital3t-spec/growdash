import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { withRequestTimeout } from "@/lib/resilience";

interface UseInsightsParams {
  adAccountId?: string;
  adAccountIds?: string[];
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

/**
 * Insights are daily facts. A single ad/date must contribute once to a
 * multi-account total even when an old sync retry left a repeated response in
 * a cached client payload. The database has this same unique key; applying it
 * at the boundary keeps the UI mathematically stable while reconciliation is
 * running in the background.
 */
export function dedupeDailyInsights(rows: InsightRow[]) {
  const unique = new Map<string, InsightRow>();
  for (const row of rows) {
    const key = `${row.ad_id}::${row.date}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return Array.from(unique.values());
}

export function useInsights({ adAccountId, adAccountIds, campaignId, campaignIds, objectives, startDate, endDate, enabled = true }: UseInsightsParams) {
  return useQuery({
    queryKey: ["insights", adAccountId, adAccountIds?.slice().sort().join(","), campaignId, campaignIds?.join(","), objectives?.join(","), startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endDate, "yyyy-MM-dd");

      // Resolve the media scope in a separate query. The previous nested
      // `insights -> ads -> adsets -> campaigns` inner join silently dropped
      // valid insight rows whenever one historical Meta entity was missing or
      // had an incomplete relationship. That made a healthy account display
      // R$ 0 / 0 leads even though the daily facts were already stored.
      const adCatalog: Record<string, any> = {};
      let adsQuery = supabase
        .from("ads")
        .select("id, name, status, thumbnail_url, adsets!inner(name, status, campaigns!inner(id, name, status, objective, ad_account_id))")
        .order("id", { ascending: true });
      if (adAccountIds && adAccountIds.length > 0) {
        adsQuery = adsQuery.in("adsets.campaigns.ad_account_id", adAccountIds);
      } else if (adAccountId) {
        adsQuery = adsQuery.eq("adsets.campaigns.ad_account_id", adAccountId);
      }
      if (campaignId) adsQuery = adsQuery.eq("adsets.campaigns.id", campaignId);
      if (campaignIds && campaignIds.length > 0) adsQuery = adsQuery.in("adsets.campaigns.id", campaignIds);
      if (objectives && objectives.length > 0) adsQuery = adsQuery.in("adsets.campaigns.objective", objectives);

      const ADS_PAGE = 1000;
      let adIds: string[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await withRequestTimeout(adsQuery.range(page * ADS_PAGE, page * ADS_PAGE + ADS_PAGE - 1), 15_000);
        if (error) throw error;
        const batch = data || [];
        for (const row of batch as any[]) {
          if (!row?.id) continue;
          adCatalog[String(row.id)] = row;
          adIds.push(String(row.id));
        }
        if (batch.length < ADS_PAGE) break;
      }
      adIds = Array.from(new Set(adIds));
      if (adIds.length === 0) return [];

      let query = supabase
        .from("insights")
        .select("ad_id, date, spend, impressions, reach, clicks, ctr, cpm, frequency, leads, cpl, conversion_rate, efficiency_rate, health_score")
        .in("ad_id", adIds)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      // Paginar para evitar o limite default de 1000 linhas do Supabase.
      const INSIGHTS_PAGE = 1000;
      let allRows: any[] = [];
      // Do not truncate long-running accounts after an arbitrary number of
      // pages. The selected interval is already enforced by the database.
      for (let page = 0; ; page++) {
        const from = page * INSIGHTS_PAGE;
        const to = from + INSIGHTS_PAGE - 1;
        // A provider delay must surface as a recoverable query failure rather
        // than leaving every Meta KPI in a permanent loading state.
        const { data, error } = await withRequestTimeout(query.range(from, to), 15_000);
        if (error) throw error;
        const batch = data || [];
        allRows = allRows.concat(batch);
        if (batch.length < INSIGHTS_PAGE) break;
      }

      return dedupeDailyInsights(allRows.map((row: any) => {
        const ad = adCatalog[String(row.ad_id)] || {};
        const adset = ad.adsets || {};
        const campaign = adset.campaigns || {};
        return {
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
        ad_name: ad.name ?? "",
        thumbnail_url: ad.thumbnail_url ?? null,
        adset_name: adset.name ?? "",
        campaign_name: campaign.name ?? "",
        campaign_objective: campaign.objective ?? null,
        ad_status: ad.status ?? null,
        adset_status: adset.status ?? null,
        campaign_status: campaign.status ?? null,
        campaign_id: campaign.id ?? null,
        ad_account_id: campaign.ad_account_id ?? null,
      };
      }) as InsightRow[]);
    },
    enabled,
    // The backend reconciles Meta every five minutes. Keep the UI cache on
    // that same cadence so account totals do not remain stale for 15 minutes.
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
