import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { META_ACTION_TYPES, resolveMetaLeadActions } from "@/lib/metaActionMetrics";

export interface ActionTotalsResult {
  /** Sum across all ads, keyed by action_type. */
  totals: Record<string, number>;
  /** Sum keyed by `${ad_account_id}::${action_type}`. Empty if no map provided. */
  totalsByAccount: Record<string, Record<string, number>>;
  /** Per-account, per-day, per-action totals: { [accountId]: { [date]: { [action_type]: value } } }. */
  dailyByAccount: Record<string, Record<string, Record<string, number>>>;
  /** Per-ad, per-day, per-action totals. Keeps daily charts scoped to the selected campaigns. */
  dailyByAd: Record<string, Record<string, Record<string, number>>>;
  /** Per-ad totals: { [ad_id]: { [action_type]: value } }. Used to classify campaigns by mechanism. */
  totalsByAd: Record<string, Record<string, number>>;
  /** Per-ad monetary values keyed by action_type (for purchase value and ROAS). */
  valueTotalsByAd: Record<string, Record<string, number>>;
  /** Number of ad_ids excluded because their campaign was DELETED/ARCHIVED. */
  excludedAdCount: number;
  metaLeadActions: { forms: number; site: number; conversations: number; total: number };
}

export interface ActionScope {
  /** Resolve every ad in these accounts, including ads without an insights row. */
  adAccountIds?: string[];
  /** Optional campaign restriction applied while resolving the account ads. */
  campaignIds?: string[];
}

/**
 * Aggregates insight_actions for the given ad_ids over a date range.
 *
 * Mirrors Meta Ads Manager default behavior: ad_ids whose parent campaign is
 * DELETED or ARCHIVED are excluded from the totals. This avoids inflated counts
 * coming from removed campaigns that still share the same pixel/custom event.
 *
 * If `adAccountByAdId` is provided, also returns per-account breakdowns so the
 * caller can resolve per-account event mappings (e.g. lp_lead_action override).
 */
export function useActionTotalsByAds(
  adIds: string[] | undefined,
  startDate?: Date,
  endDate?: Date,
  adAccountByAdId?: Record<string, string | null | undefined>,
  scope?: ActionScope,
) {
  const sortedIds = [...(adIds || [])].sort();
  const scopedAccounts = [...(scope?.adAccountIds || [])].sort();
  const scopedCampaigns = [...(scope?.campaignIds || [])].sort();
  const accountMapSignature = adAccountByAdId
    ? JSON.stringify(Object.entries(adAccountByAdId).sort(([a], [b]) => a.localeCompare(b)))
    : "";
  return useQuery({
    queryKey: [
      "action-totals-by-ads",
      sortedIds.join(","),
      scopedAccounts.join(","),
      scopedCampaigns.join(","),
      startDate?.toISOString(),
      endDate?.toISOString(),
      accountMapSignature,
    ],
    enabled: sortedIds.length > 0 || scopedAccounts.length > 0 || scopedCampaigns.length > 0,
    queryFn: async (): Promise<ActionTotalsResult> => {
      const totals: Record<string, number> = {};
      const totalsByAccount: Record<string, Record<string, number>> = {};
      const dailyByAccount: Record<string, Record<string, Record<string, number>>> = {};
      const dailyByAd: Record<string, Record<string, Record<string, number>>> = {};
      const totalsByAd: Record<string, Record<string, number>> = {};
      const valueTotalsByAd: Record<string, Record<string, number>> = {};
      const metaLeadActions = { forms: 0, site: 0, conversations: 0, total: 0 };
      const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
      const end = endDate ? format(endDate, "yyyy-MM-dd") : null;

      // Resolve the complete account/campaign ad universe first. This is
      // intentionally independent of `insights`: an ad can have valid Meta
      // actions even when its daily insight row was not persisted locally.
      const CHUNK_IDS = 500;
      let resolvedIds = sortedIds;
      const resolvedAccountByAd: Record<string, string | null> = { ...(adAccountByAdId || {}) };
      if (scopedAccounts.length > 0 || scopedCampaigns.length > 0) {
        let campaignQuery = supabase.from("campaigns").select("id, ad_account_id");
        if (scopedAccounts.length > 0) campaignQuery = campaignQuery.in("ad_account_id", scopedAccounts);
        if (scopedCampaigns.length > 0) campaignQuery = campaignQuery.in("id", scopedCampaigns);
        const { data: campaigns, error: campaignsError } = await campaignQuery;
        if (campaignsError) throw campaignsError;
        const campaignRows = (campaigns || []) as Array<{ id: string; ad_account_id: string | null }>;
        const campaignIds = campaignRows.map((row) => row.id);
        const campaignAccount = Object.fromEntries(campaignRows.map((row) => [row.id, row.ad_account_id]));
        const adsetRows: Array<{ id: string; campaign_id: string }> = [];
        for (let i = 0; i < campaignIds.length; i += CHUNK_IDS) {
          const { data, error } = await supabase.from("adsets").select("id, campaign_id").in("campaign_id", campaignIds.slice(i, i + CHUNK_IDS));
          if (error) throw error;
          adsetRows.push(...((data || []) as Array<{ id: string; campaign_id: string }>));
        }
        const adsetIds = adsetRows.map((row) => row.id);
        const adRows: Array<{ id: string; adset_id: string }> = [];
        for (let i = 0; i < adsetIds.length; i += CHUNK_IDS) {
          const { data, error } = await supabase.from("ads").select("id, adset_id").in("adset_id", adsetIds.slice(i, i + CHUNK_IDS));
          if (error) throw error;
          adRows.push(...((data || []) as Array<{ id: string; adset_id: string }>));
        }
        const campaignByAdset = Object.fromEntries(adsetRows.map((row) => [row.id, row.campaign_id]));
        resolvedIds = adRows.map((row) => row.id);
        for (const row of adRows) resolvedAccountByAd[row.id] = campaignAccount[campaignByAdset[row.adset_id]] || null;
      }
      const resolvedSortedIds = [...new Set(resolvedIds)].sort();
      const adsetByAd: Record<string, string> = {};
      for (let i = 0; i < resolvedSortedIds.length; i += CHUNK_IDS) {
        const chunk = resolvedSortedIds.slice(i, i + CHUNK_IDS);
        const { data, error } = await supabase
          .from("ads")
          .select("id, adset_id")
          .in("id", chunk);
        if (error) throw error;
        for (const r of (data || []) as any[]) adsetByAd[r.id] = r.adset_id;
      }
      const adsetIds = Array.from(new Set(Object.values(adsetByAd)));
      const campaignByAdset: Record<string, string> = {};
      for (let i = 0; i < adsetIds.length; i += CHUNK_IDS) {
        const chunk = adsetIds.slice(i, i + CHUNK_IDS);
        const { data, error } = await supabase
          .from("adsets")
          .select("id, campaign_id")
          .in("id", chunk);
        if (error) throw error;
        for (const r of (data || []) as any[]) campaignByAdset[r.id] = r.campaign_id;
      }
      const campaignIds = Array.from(new Set(Object.values(campaignByAdset)));
      // Historical Meta results remain valid even when the parent campaign is
      // archived/deleted. Never discard those action rows by current status.
      const allowedIds = resolvedSortedIds;
      const excludedAdCount = 0;

      // === Sum insight_actions only for allowed ads ===
      const CHUNK = 200;
      const PAGE = 1000;
      for (let i = 0; i < allowedIds.length; i += CHUNK) {
        const chunk = allowedIds.slice(i, i + CHUNK);
        for (let from = 0; ; from += PAGE) {
          let q = supabase
            .from("insight_actions" as any)
            .select("ad_id, action_type, value, value_amount, date")
            .in("ad_id", chunk);
          if (start) q = q.gte("date", start);
          if (end) q = q.lte("date", end);
          const { data, error } = await q.range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data || []) as any[];
          for (const r of rows) {
            const v = Number(r.value || 0);
            totals[r.action_type] = (totals[r.action_type] || 0) + v;
            if (!totalsByAd[r.ad_id]) totalsByAd[r.ad_id] = {};
            totalsByAd[r.ad_id][r.action_type] = (totalsByAd[r.ad_id][r.action_type] || 0) + v;
            if (!dailyByAd[r.ad_id]) dailyByAd[r.ad_id] = {};
            if (!dailyByAd[r.ad_id][r.date]) dailyByAd[r.ad_id][r.date] = {};
            dailyByAd[r.ad_id][r.date][r.action_type] = (dailyByAd[r.ad_id][r.date][r.action_type] || 0) + v;
            if (!valueTotalsByAd[r.ad_id]) valueTotalsByAd[r.ad_id] = {};
            valueTotalsByAd[r.ad_id][r.action_type] = (valueTotalsByAd[r.ad_id][r.action_type] || 0) + Number(r.value_amount || 0);
            const acc = resolvedAccountByAd[r.ad_id] || undefined;
            if (acc) {
              if (!totalsByAccount[acc]) totalsByAccount[acc] = {};
              totalsByAccount[acc][r.action_type] = (totalsByAccount[acc][r.action_type] || 0) + v;
              if (!dailyByAccount[acc]) dailyByAccount[acc] = {};
              if (!dailyByAccount[acc][r.date]) dailyByAccount[acc][r.date] = {};
              dailyByAccount[acc][r.date][r.action_type] =
                (dailyByAccount[acc][r.date][r.action_type] || 0) + v;
            }
          }
          if (rows.length < PAGE) break;
        }
      }
      const accountIds = Array.from(new Set(allowedIds.map((id) => resolvedAccountByAd[id]).filter(Boolean))) as string[];
      const lpByAccount: Record<string, string> = {};
      if (accountIds.length > 0) {
        const { data: configs, error } = await supabase.from("account_lp_config").select("ad_account_id, action_type").in("ad_account_id", accountIds);
        if (error) throw error;
        for (const config of (configs || []) as Array<{ ad_account_id: string; action_type: string | null }>) {
          if (config.action_type) lpByAccount[config.ad_account_id] = config.action_type;
        }
      }
      const nativeAliases = new Set<string>(META_ACTION_TYPES.forms);
      for (const adId of allowedIds) {
        const actions = totalsByAd[adId] || {};
        const resolved = resolveMetaLeadActions(actions);
        const accountId = resolvedAccountByAd[adId] || "";
        const lpAction = lpByAccount[accountId];
        const site = lpAction && !nativeAliases.has(lpAction) && lpAction !== "lead"
          ? Math.max(0, Number(actions[lpAction] || 0))
          : 0;
        metaLeadActions.forms += resolved.forms;
        metaLeadActions.site += site;
        metaLeadActions.conversations += resolved.conversations;
      }
      metaLeadActions.total = metaLeadActions.forms + metaLeadActions.site + metaLeadActions.conversations;
      return { totals, totalsByAccount, dailyByAccount, dailyByAd, totalsByAd, valueTotalsByAd, excludedAdCount, metaLeadActions };
    },
    staleTime: 120_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
}
