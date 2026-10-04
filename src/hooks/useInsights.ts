import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withRequestTimeout } from "@/lib/resilience";
import { businessDateKey } from "@/lib/businessDate";
import { isSameQueryScope } from "@/lib/queryScope";

interface UseInsightsParams {
  adAccountId?: string;
  adAccountIds?: string[];
  campaignId?: string;
  campaignIds?: string[];
  objectives?: string[];
  attributionWindow?: string;
  attributionWindowsByAccount?: Record<string, string>;
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

export interface InsightRow {
  ad_id: string;
  campaign_id?: string | null;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpm: number;
  frequency: number;
  leads: number;
  form_leads?: number;
  site_leads?: number;
  conversations?: number;
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
  attribution_window?: string | null;
}

function canonicalInsightLeads(row: any) {
  const forms = Number(row.form_leads ?? 0);
  const site = Number(row.site_leads ?? 0);
  const conversations = Number(row.conversations ?? 0);
  const hasCanonicalFields = row.form_leads !== null && row.form_leads !== undefined
    || row.site_leads !== null && row.site_leads !== undefined
    || row.conversations !== null && row.conversations !== undefined;
  return {
    forms,
    site,
    conversations,
    total: hasCanonicalFields ? forms + site + conversations : Number(row.leads ?? 0),
  };
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
    const key = `${row.ad_id}::${row.date}::${row.attribution_window || "account_default"}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return Array.from(unique.values());
}

/**
 * Keep historical facts scoped by the campaign id persisted on the fact.
 * The current ad -> adset -> campaign catalog is only a legacy fallback;
 * archived or temporarily missing catalog rows must not turn valid Insights
 * into an apparent zero snapshot.
 */
export function filterInsightsByCampaignScope<T extends { ad_id: string; campaign_id?: string | null }>(
  rows: T[],
  campaignIds: string[] | undefined,
  campaignIdByAd: Record<string, string | null | undefined>,
) {
  if (!campaignIds?.length) return rows;
  const allowedCampaigns = new Set(campaignIds.map(String));
  return rows.filter((row) => {
    const campaignId = row.campaign_id ?? campaignIdByAd[row.ad_id];
    return campaignId != null && allowedCampaigns.has(String(campaignId));
  });
}

export function useInsights({ adAccountId, adAccountIds, campaignId, campaignIds, objectives, attributionWindow = "account_default", attributionWindowsByAccount = {}, startDate, endDate, enabled = true }: UseInsightsParams) {
  const queryKey = ["insights", adAccountId, adAccountIds?.slice().sort().join(","), campaignId, campaignIds?.join(","), objectives?.join(","), attributionWindow, JSON.stringify(Object.entries(attributionWindowsByAccount).sort(([a], [b]) => a.localeCompare(b))), businessDateKey(startDate), businessDateKey(endDate)] as const;
  return useQuery({
    queryKey,
    queryFn: async () => {
      const start = businessDateKey(startDate);
      const end = businessDateKey(endDate);
      const scopedAccountIds = adAccountIds?.length ? adAccountIds : adAccountId ? [adAccountId] : [];

      // Facts are now directly scoped by the internal account id. This path
      // avoids returning an empty snapshot when the campaign/ad catalog is
      // incomplete after an interrupted Meta sync.
      if (scopedAccountIds.length) {
        const PAGE = 1000;
        const directRows: any[] = [];
        let directAvailable = true;
        const directQuery = (supabase as any)
          .from("insights")
          .select("ad_id,ad_account_id,campaign_id,date,spend,impressions,reach,clicks,ctr,cpm,frequency,leads,form_leads,site_leads,conversations,cpl,conversion_rate,efficiency_rate,health_score,optimization_goal,result_type,result_value,attribution_window")
          .in("ad_account_id", scopedAccountIds)
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: true });
        for (let page = 0; ; page++) {
          const { data, error } = await withRequestTimeout(directQuery.range(page * PAGE, page * PAGE + PAGE - 1), 15_000);
          if (error) {
            // Older deployments without the additive column continue through
            // the legacy catalog path below; the migration makes this branch
            // authoritative after deployment.
            if (!/ad_account_id|column/i.test(error.message || "")) throw error;
            directAvailable = false;
            break;
          }
          const batch = data || [];
          directRows.push(...batch);
          if (batch.length < PAGE) break;
        }
        // An account-scoped facts query is authoritative even when it returns
        // no rows. Falling back to the catalog in that case made a broken or
        // incomplete catalog look like a different zero-valued snapshot.
        if (directAvailable) {
          const adIds = Array.from(new Set(directRows.map((row) => String(row.ad_id || "")).filter(Boolean)));
          const adCatalog: Record<string, any> = {};
          const adsetIds: string[] = [];
          if (adIds.length) {
            const { data: ads } = await withRequestTimeout((supabase as any).from("ads").select("id,name,thumbnail_url,adset_id").in("id", adIds), 15_000);
            for (const ad of ads || []) {
              adCatalog[String(ad.id)] = ad;
              if (ad.adset_id) adsetIds.push(String(ad.adset_id));
            }
          }
          const adsetCatalog = new Map<string, any>();
          const campaignIdsFromAds: string[] = [];
          if (adsetIds.length) {
            const { data: adsets } = await withRequestTimeout((supabase as any).from("adsets").select("id,name,campaign_id").in("id", Array.from(new Set(adsetIds))), 15_000);
            for (const adset of adsets || []) {
              adsetCatalog.set(String(adset.id), adset);
              if (adset.campaign_id) campaignIdsFromAds.push(String(adset.campaign_id));
            }
          }
          const campaignCatalog = new Map<string, any>();
          if (campaignIdsFromAds.length) {
            const { data: campaigns } = await withRequestTimeout((supabase as any).from("campaigns").select("id,name,objective,ad_account_id,status").in("id", Array.from(new Set(campaignIdsFromAds))), 15_000);
            for (const campaign of campaigns || []) campaignCatalog.set(String(campaign.id), campaign);
          }
          const normalizeWindow = (value: unknown) => String(value || "account_default")
            .split(",").map((item) => item.trim()).filter(Boolean).sort().join(",") || "account_default";
          const filteredRows = directRows
            .filter((row) => {
              const accountWindow = normalizeWindow(attributionWindowsByAccount[String(row.ad_account_id)] || attributionWindow);
              const rowWindow = normalizeWindow(row.attribution_window);
              // Older snapshots may have a null window. Treat null and the
              // explicit default as equivalent, but never mix configured
              // windows between accounts.
              if (rowWindow !== accountWindow) return false;
              return true;
            });
          const campaignIdByAd = Object.fromEntries(Object.entries(adCatalog).map(([adId, ad]) => {
            const adset = adsetCatalog.get(String(ad.adset_id));
            return [adId, adset?.campaign_id ?? null];
          }));
          const rowsForDisplay = filterInsightsByCampaignScope(filteredRows, campaignIds, campaignIdByAd);
          return dedupeDailyInsights(rowsForDisplay
            .map((row) => {
              const ad = adCatalog[String(row.ad_id)] || {};
              const adset = adsetCatalog.get(String(ad.adset_id)) || {};
              const campaign = campaignCatalog.get(String(adset.campaign_id)) || {};
              return {
                ad_id: row.ad_id,
                date: row.date,
                attribution_window: row.attribution_window ?? null,
                spend: row.spend ?? 0,
                impressions: row.impressions ?? 0,
                reach: row.reach ?? 0,
                clicks: row.clicks ?? 0,
                ctr: row.ctr ?? 0,
                cpm: row.cpm ?? 0,
                frequency: row.frequency ?? 0,
                leads: canonicalInsightLeads(row).total,
                form_leads: canonicalInsightLeads(row).forms,
                site_leads: canonicalInsightLeads(row).site,
                conversations: canonicalInsightLeads(row).conversations,
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
                campaign_id: row.campaign_id ?? adset.campaign_id ?? null,
                ad_account_id: row.ad_account_id ?? campaign.ad_account_id ?? null,
              };
            }) as InsightRow[]);
        }
      }

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

      // Paginar para evitar o limite default de 1000 linhas do Supabase.
      const INSIGHTS_PAGE = 1000;
      let allRows: any[] = [];
      const insightGroups = new Map<string, { window: string; ids: string[] }>();
      for (const adId of adIds) {
        const accountId = String(adCatalog[adId]?.adsets?.campaigns?.ad_account_id || "");
        const window = attributionWindowsByAccount[accountId] || attributionWindow;
        const key = `${accountId}::${window}`;
        const group = insightGroups.get(key) || { window, ids: [] };
        group.ids.push(adId);
        insightGroups.set(key, group);
      }
      for (const group of insightGroups.values()) {
        let query = supabase
          .from("insights")
          .select("ad_id, date, spend, impressions, reach, clicks, ctr, cpm, frequency, leads, form_leads, site_leads, conversations, cpl, conversion_rate, efficiency_rate, health_score, optimization_goal, result_type, result_value, attribution_window")
          .in("ad_id", group.ids)
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: true });
        if (group.window === "account_default") {
          query = query.or("attribution_window.eq.account_default,attribution_window.is.null");
        } else {
          query = query.eq("attribution_window", group.window);
        }
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
      }

      return dedupeDailyInsights(allRows.map((row: any) => {
        const ad = adCatalog[String(row.ad_id)] || {};
        const adset = ad.adsets || {};
        const campaign = adset.campaigns || {};
        return {
        ad_id: row.ad_id,
        date: row.date,
        attribution_window: row.attribution_window ?? null,
        spend: row.spend ?? 0,
        impressions: row.impressions ?? 0,
        reach: row.reach ?? 0,
        clicks: row.clicks ?? 0,
        ctr: row.ctr ?? 0,
        cpm: row.cpm ?? 0,
        frequency: row.frequency ?? 0,
          leads: canonicalInsightLeads(row).total,
          form_leads: canonicalInsightLeads(row).forms,
          site_leads: canonicalInsightLeads(row).site,
          conversations: canonicalInsightLeads(row).conversations,
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
    placeholderData: (previousData, previousQuery) => isSameQueryScope(previousQuery?.queryKey, queryKey) ? previousData : undefined,
    // The coordinator refreshes on entry/filter events and every five minutes.
    // Keep the previous result during the request so a pending Meta response
    // can never make the selected cards flash to zero.
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
