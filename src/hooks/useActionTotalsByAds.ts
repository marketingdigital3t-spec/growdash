import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ActionTotalsResult {
  /** Sum across all ads, keyed by action_type. */
  totals: Record<string, number>;
  /** Sum keyed by `${ad_account_id}::${action_type}`. Empty if no map provided. */
  totalsByAccount: Record<string, Record<string, number>>;
  /** Per-account, per-day, per-action totals: { [accountId]: { [date]: { [action_type]: value } } }. */
  dailyByAccount: Record<string, Record<string, Record<string, number>>>;
  /** Per-ad totals: { [ad_id]: { [action_type]: value } }. Used to classify campaigns by mechanism. */
  totalsByAd: Record<string, Record<string, number>>;
  /** Per-ad monetary values keyed by action_type (for purchase value and ROAS). */
  valueTotalsByAd: Record<string, Record<string, number>>;
  /** Number of ad_ids excluded because their campaign was DELETED/ARCHIVED. */
  excludedAdCount: number;
}

const isDeadStatus = (status?: string | null) => {
  if (!status) return false;
  const s = status.toUpperCase();
  return s.includes("DELETED") || s.includes("ARCHIVED");
};

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
  adIds: string[],
  startDate?: Date,
  endDate?: Date,
  adAccountByAdId?: Record<string, string | null | undefined>,
) {
  const sortedIds = [...adIds].sort();
  return useQuery({
    queryKey: [
      "action-totals-by-ads",
      sortedIds.join(","),
      startDate?.toISOString(),
      endDate?.toISOString(),
      adAccountByAdId ? Object.keys(adAccountByAdId).length : 0,
    ],
    enabled: sortedIds.length > 0,
    queryFn: async (): Promise<ActionTotalsResult> => {
      const totals: Record<string, number> = {};
      const totalsByAccount: Record<string, Record<string, number>> = {};
      const dailyByAccount: Record<string, Record<string, Record<string, number>>> = {};
      const totalsByAd: Record<string, Record<string, number>> = {};
      const valueTotalsByAd: Record<string, Record<string, number>> = {};
      const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
      const end = endDate ? format(endDate, "yyyy-MM-dd") : null;

      // === Filter out ads whose parent campaign is DELETED/ARCHIVED ===
      // ads -> adset_id -> adsets.campaign_id -> campaigns.status
      const CHUNK_IDS = 500;
      const adsetByAd: Record<string, string> = {};
      for (let i = 0; i < sortedIds.length; i += CHUNK_IDS) {
        const chunk = sortedIds.slice(i, i + CHUNK_IDS);
        const { data, error } = await (supabase as any)
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
        const { data, error } = await (supabase as any)
          .from("adsets")
          .select("id, campaign_id")
          .in("id", chunk);
        if (error) throw error;
        for (const r of (data || []) as any[]) campaignByAdset[r.id] = r.campaign_id;
      }
      const campaignIds = Array.from(new Set(Object.values(campaignByAdset)));
      const campaignStatus: Record<string, string | null> = {};
      for (let i = 0; i < campaignIds.length; i += CHUNK_IDS) {
        const chunk = campaignIds.slice(i, i + CHUNK_IDS);
        const { data, error } = await (supabase as any)
          .from("campaigns")
          .select("id, status")
          .in("id", chunk);
        if (error) throw error;
        for (const r of (data || []) as any[]) campaignStatus[r.id] = r.status;
      }

      const allowedIds = sortedIds.filter((adId) => {
        const adsetId = adsetByAd[adId];
        const campaignId = adsetId ? campaignByAdset[adsetId] : undefined;
        // If we don't have status info, keep the ad (avoid silent data loss)
        if (!campaignId) return true;
        const status = campaignStatus[campaignId];
        return !isDeadStatus(status);
      });
      const excludedAdCount = sortedIds.length - allowedIds.length;

      // === Sum insight_actions only for allowed ads ===
      const CHUNK = 200;
      const PAGE = 1000;
      for (let i = 0; i < allowedIds.length; i += CHUNK) {
        const chunk = allowedIds.slice(i, i + CHUNK);
        for (let from = 0; ; from += PAGE) {
          let q = (supabase as any)
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
            if (!valueTotalsByAd[r.ad_id]) valueTotalsByAd[r.ad_id] = {};
            valueTotalsByAd[r.ad_id][r.action_type] = (valueTotalsByAd[r.ad_id][r.action_type] || 0) + Number(r.value_amount || 0);
            const acc = adAccountByAdId ? adAccountByAdId[r.ad_id] : undefined;
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
      return { totals, totalsByAccount, dailyByAccount, totalsByAd, valueTotalsByAd, excludedAdCount };
    },
  });
}
