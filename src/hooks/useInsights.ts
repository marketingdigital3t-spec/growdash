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
  attributionWindow?: string;
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
  optimization_goal?: string | null;
  result_type?: string | null;
  result_value?: number | null;
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

export function useInsights({ adAccountId, adAccountIds, campaignId, campaignIds, objectives, attributionWindow = "account_default", startDate, endDate, enabled = true }: UseInsightsParams) {
  return useQuery({
    queryKey: ["insights", adAccountId, adAccountIds?.slice().sort().join(","), campaignId, campaignIds?.join(","), objectives?.join(","), attributionWindow, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endDate, "yyyy-MM-dd");

      // Build the media catalog with separate queries. The previous nested
      // inner join discarded valid daily facts when a historical adset or
      // campaign relationship was missing, rendering accounts as zeroed out.
      const adCatalog: Record<string, any> = {};
      const accountIds = adAccountIds?.length ? adAccountIds : adAccountId ? [adAccountId] : [];
      let campaignsQuery = supabase.from("campaigns").select("id,name,status,objective,ad_account_id").order("id", { ascending: true });
      if (accountIds.length) campaignsQuery = campaignsQuery.in("ad_account_id", accountIds);
      if (campaignId) campaignsQuery = campaignsQuery.eq("id", campaignId);
      if (campaignIds?.length) campaignsQuery = campaignsQuery.in("id", campaignIds);
      if (objectives?.length) campaignsQuery = campaignsQuery.in("objective", objectives);
      const { data: campaignRows, error: campaignsError } = await withRequestTimeout(campaignsQuery, 15_000);
      if (campaignsError) throw campaignsError;
      const campaigns = (campaignRows || []) as any[];
      const campaignIdSet = new Set(campaigns.map((row) => String(row.id)));
      if (campaignIdSet.size === 0) return [];

      const { data: adsetRows, error: adsetsError } = await withRequestTimeout(
        supabase.from("adsets").select("id,name,status,campaign_id").in("campaign_id", Array.from(campaignIdSet)),
        15_000,
      );
      if (adsetsError) throw adsetsError;
      const adsets = (adsetRows || []) as any[];
      const adsetIdSet = new Set(adsets.map((row) => String(row.id)));
      if (adsetIdSet.size === 0) return [];

      const { data: adRows, error: adsError } = await withRequestTimeout(
        supabase.from("ads").select("id,name,status,adset_id,thumbnail_url").in("adset_id", Array.from(adsetIdSet)).order("id", { ascending: true }),
        15_000,
      );
      if (adsError) throw adsError;
      const adsetCatalog = new Map(adsets.map((row) => [String(row.id), row]));
      const campaignCatalog = new Map(campaigns.map((row) => [String(row.id), row]));
      const adIds = (adRows || []).map((row: any) => {
        const adset = adsetCatalog.get(String(row.adset_id));
        const campaign = adset ? campaignCatalog.get(String(adset.campaign_id)) : null;
        if (row?.id) adCatalog[String(row.id)] = { ...row, adsets: { ...adset, campaigns: campaign } };
        return row?.id ? String(row.id) : null;
      }).filter(Boolean) as string[];
      if (adIds.length === 0) return [];

      let query = supabase
        .from("insights")
        .select("ad_id, date, spend, impressions, reach, clicks, ctr, cpm, frequency, leads, cpl, conversion_rate, efficiency_rate, health_score, optimization_goal, result_type, result_value")
        .in("ad_id", adIds)
        .eq("attribution_window", attributionWindow)
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
        optimization_goal: row.optimization_goal ?? null,
        result_type: row.result_type ?? null,
        result_value: row.result_value ?? null,
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
