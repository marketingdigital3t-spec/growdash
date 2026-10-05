import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { businessDateKey } from "@/lib/businessDate";
import { isSameQueryScope } from "@/lib/queryScope";
import { normalizeMetaAttributionWindow } from "@/lib/metaInsightFacts";
import { buildConversationEligibleMetaAdScopes, buildSiteEligibleMetaAdScopes } from "@/lib/metaLeadScope";
import { META_LEAD_ACTION_TYPES } from "../../supabase/functions/_shared/metaLeadMetrics";
import { aggregateMetaCampaignLeadFacts } from "@/lib/metaCampaignLeadRollup";

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 200;

/** Reads canonical lead facts by account/date, independent of the campaign catalog. */
export function useMetaCampaignLeadRollup(
  adAccountIds: string[],
  startDate: Date,
  endDate: Date,
  attributionByAccount: Record<string, string>,
) {
  const accountIds = [...new Set(adAccountIds)].sort();
  const start = businessDateKey(startDate);
  const end = businessDateKey(endDate);
  const attributionSignature = JSON.stringify(Object.entries(attributionByAccount).sort(([a], [b]) => a.localeCompare(b)));
  const queryKey = ["meta-campaign-lead-rollup", accountIds.join(","), start, end, attributionSignature] as const;

  return useQuery({
    queryKey,
    enabled: accountIds.length > 0,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    placeholderData: (previousData, previousQuery) => isSameQueryScope(previousQuery?.queryKey, queryKey) ? previousData : undefined,
    queryFn: async () => {
      const insightRows: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from("insights")
          .select("ad_id,ad_account_id,adset_id,campaign_id,campaign_name,date,attribution_window,spend,impressions,reach,clicks")
          .in("ad_account_id", accountIds)
          .gte("date", start)
          .lte("date", end)
          .order("ad_account_id", { ascending: true })
          .order("ad_id", { ascending: true })
          .order("date", { ascending: true })
          .order("attribution_window", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        insightRows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }

      const { data: configs, error: configError } = await supabase.from("account_lp_config")
        .select("ad_account_id,action_type")
        .in("ad_account_id", accountIds);
      if (configError) throw configError;
      const siteActionByAccount = Object.fromEntries((configs || [])
        .filter((row) => row.action_type)
        .map((row) => [row.ad_account_id, row.action_type as string]));
      const scopedInsightRows = insightRows.filter((row) =>
        normalizeMetaAttributionWindow(attributionByAccount[row.ad_account_id]) === normalizeMetaAttributionWindow(row.attribution_window));
      const adsetIds = Array.from(new Set(insightRows.map((row) => row.adset_id).filter(Boolean)));
      const destinationTypeByAdset: Record<string, string | null> = {};
      for (let index = 0; index < adsetIds.length; index += ID_CHUNK_SIZE) {
        const { data, error } = await supabase.from("adsets")
          .select("id,destination_type")
          .in("id", adsetIds.slice(index, index + ID_CHUNK_SIZE));
        if (error) throw error;
        for (const adset of data || []) destinationTypeByAdset[String(adset.id)] = adset.destination_type || null;
      }
      const siteEligibleAdScopes = buildSiteEligibleMetaAdScopes(scopedInsightRows, destinationTypeByAdset);
      const conversationEligibleAdScopes = buildConversationEligibleMetaAdScopes(scopedInsightRows, destinationTypeByAdset);
      const actionTypes = Array.from(new Set([...META_LEAD_ACTION_TYPES, "lead", ...Object.values(siteActionByAccount)]));

      const adIds = Array.from(new Set(scopedInsightRows.map((row) => String(row.ad_id)).filter(Boolean)));
      const actionRows: any[] = [];
      for (let index = 0; index < adIds.length; index += ID_CHUNK_SIZE) {
        const chunk = adIds.slice(index, index + ID_CHUNK_SIZE);
        for (let offset = 0; ; offset += PAGE_SIZE) {
          let query = (supabase.from("insight_actions" as any) as any)
            .select("ad_account_id,ad_id,date,action_type,value,attribution_window")
            .in("ad_account_id", accountIds)
            .in("ad_id", chunk)
            .in("action_type", actionTypes)
            .gte("date", start)
            .lte("date", end)
            .order("ad_account_id", { ascending: true })
            .order("ad_id", { ascending: true })
            .order("date", { ascending: true })
            .order("action_type", { ascending: true })
            .order("attribution_window", { ascending: true });
          if (accountIds.length === 1 && (attributionByAccount[accountIds[0]] || "account_default") === "account_default") {
            query = query.or("attribution_window.eq.account_default,attribution_window.is.null");
          }
          const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          actionRows.push(...(data || []));
          if (!data || data.length < PAGE_SIZE) break;
        }
      }

      return aggregateMetaCampaignLeadFacts(scopedInsightRows, actionRows, attributionByAccount, siteActionByAccount, siteEligibleAdScopes, conversationEligibleAdScopes);
    },
  });
}
