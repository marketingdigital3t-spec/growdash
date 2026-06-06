import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAccountLpConfigs } from "@/hooks/useAccountPixels";
import { useAccountAdsets } from "@/hooks/useAccountAdsets";

const NATIVE_LEAD_GROUPED = "onsite_conversion.lead_grouped";
const LP_VIEW_EVENT = "landing_page_view";
const MESSAGE_EVENT = "onsite_conversion.messaging_conversation_started_7d";

const DEST_NATIVE = new Set(["ON_AD"]);
const DEST_LANDING = new Set(["WEBSITE"]);
const DEST_MESSAGES = new Set([
  "MESSENGER", "WHATSAPP", "INSTAGRAM_DIRECT",
  "MESSAGING_INSTAGRAM_DIRECT", "MESSAGING_MESSENGER", "MESSAGING_WHATSAPP",
]);

const isDeadStatus = (s?: string | null) => {
  if (!s) return false;
  const u = s.toUpperCase();
  return u.includes("DELETED") || u.includes("ARCHIVED");
};

interface ActionRow {
  ad_id: string;
  action_type: string;
  value: number;
  date: string;
}

/**
 * Computes canonical Meta leads per (ad_account_id, date) using the SAME rule
 * as the dashboard KPI "Leads":
 *   - FORMS (ON_AD) campaigns: `onsite_conversion.lead_grouped`
 *   - LANDING (WEBSITE) campaigns: per-account configured action_type (`account_lp_config`)
 *   - MESSAGES campaigns: `onsite_conversion.messaging_conversation_started_7d`
 *
 * Returns `Map<"accountId|YYYY-MM-DD", number>`.
 *
 * This is the single source of truth for any widget that needs to anchor totals
 * to the dashboard KPI (hourly conversion, weekday distribution, etc.).
 */
export function useCanonicalLeadsByAccountDate() {
  const { insights, campaigns, startDate, endDate, adAccountId } = useDashboard();
  const { data: lpConfigs = {} } = useAccountLpConfigs();
  const { data: accountAdsets = [] } = useAccountAdsets(adAccountId);

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  // Scope to ads present in the current dashboard insights (already filtered by account/period).
  const scopedAdIds = useMemo(() => Array.from(new Set(insights.map((r) => r.ad_id))), [insights]);
  const adIdsKey = scopedAdIds.slice().sort().join(",");

  // ad_id -> { campaign_id, ad_account_id }
  const adMeta = useMemo(() => {
    const m: Record<string, { campaign_id: string | null; ad_account_id: string | null }> = {};
    for (const r of insights) {
      m[r.ad_id] = { campaign_id: r.campaign_id ?? null, ad_account_id: r.ad_account_id ?? null };
    }
    return m;
  }, [insights]);

  // Fetch insight_actions for scoped ads in window
  const actionsQ = useQuery({
    queryKey: ["canonical-leads-actions", adIdsKey, start, end],
    enabled: scopedAdIds.length > 0,
    queryFn: async (): Promise<ActionRow[]> => {
      const CHUNK = 200;
      const PAGE = 1000;
      const all: ActionRow[] = [];
      for (let i = 0; i < scopedAdIds.length; i += CHUNK) {
        const chunk = scopedAdIds.slice(i, i + CHUNK);
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("insight_actions" as any)
            .select("ad_id, action_type, value, date")
            .in("ad_id", chunk)
            .gte("date", start)
            .lte("date", end)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data || []) as unknown as ActionRow[];
          all.push(...rows);
          if (rows.length < PAGE) break;
        }
      }
      return all;
    },
  });

  const result = useMemo(() => {
    const targetByAccountDate = new Map<string, number>();
    const actions = actionsQ.data || [];
    if (actions.length === 0) return { targetByAccountDate, isLoading: actionsQ.isLoading };

    // Build classification context.
    // campaign status (from campaigns table) — used to exclude DELETED/ARCHIVED.
    const campaignStatus: Record<string, string | null> = {};
    for (const c of (campaigns || []) as any[]) {
      if (c?.id) campaignStatus[c.id] = c.status ?? null;
    }
    // destination_type set per campaign (from adsets) — structural mechanic signal.
    const destSetByCampaign: Record<string, Set<string>> = {};
    for (const a of accountAdsets) {
      if (!a.campaign_id || !a.destination_type) continue;
      (destSetByCampaign[a.campaign_id] ||= new Set()).add(a.destination_type);
    }

    // Per-ad action totals for the whole window (used to classify campaigns by observed events).
    const totalsByAd: Record<string, Record<string, number>> = {};
    for (const r of actions) {
      const t = (totalsByAd[r.ad_id] ||= {});
      t[r.action_type] = (t[r.action_type] || 0) + Number(r.value || 0);
    }

    // Aggregate per-campaign event totals (mirrors DefaultDashboardContent logic).
    const totalsByCampaign: Record<string, Record<string, number>> = {};
    for (const adId of Object.keys(totalsByAd)) {
      const meta = adMeta[adId];
      const campId = meta?.campaign_id;
      if (!campId) continue;
      const t = (totalsByCampaign[campId] ||= {});
      for (const [k, v] of Object.entries(totalsByAd[adId])) t[k] = (t[k] || 0) + v;
    }

    // account per campaign — derived from insights.
    const accountByCampaign: Record<string, string> = {};
    for (const r of insights) {
      if (r.campaign_id && r.ad_account_id) accountByCampaign[r.campaign_id] = r.ad_account_id;
    }

    // Classify each campaign as native (FORMS) / landing / messages (same rules as the KPI).
    const nativeCampaigns = new Set<string>();
    const landingCampaigns = new Set<string>();
    for (const campId of Object.keys(totalsByCampaign).concat(Object.keys(destSetByCampaign))) {
      if (isDeadStatus(campaignStatus[campId])) continue;
      const t = totalsByCampaign[campId] || {};
      const ds = destSetByCampaign[campId] || new Set<string>();
      const acc = accountByCampaign[campId];
      const lpAction = acc ? (lpConfigs as any)[acc]?.action_type : undefined;
      const hasNativeDest = Array.from(ds).some((d) => DEST_NATIVE.has(d));
      const hasLandingDest = Array.from(ds).some((d) => DEST_LANDING.has(d));

      if ((t[NATIVE_LEAD_GROUPED] || 0) > 0 || hasNativeDest) nativeCampaigns.add(campId);
      if (
        lpAction &&
        (hasLandingDest || ((t[LP_VIEW_EVENT] || 0) > 0 && !hasNativeDest))
      ) {
        landingCampaigns.add(campId);
      }
    }

    // 4) Walk all action rows, summing only the canonical event per ad's mechanic, per day.
    for (const r of actions) {
      const meta = adMeta[r.ad_id];
      if (!meta?.ad_account_id || !meta.campaign_id) continue;
      const campId = meta.campaign_id;
      const acc = meta.ad_account_id;
      const isNative = nativeCampaigns.has(campId);
      const isLanding = landingCampaigns.has(campId);
      if (!isNative && !isLanding) continue; // ignore messages-only for now (KPI "Leads" = native + landing)

      let counts = false;
      if (isNative && r.action_type === NATIVE_LEAD_GROUPED) counts = true;
      if (!counts && isLanding) {
        const lpAction = (lpConfigs as any)[acc]?.action_type;
        if (lpAction && r.action_type === lpAction) counts = true;
      }
      if (!counts) continue;

      const key = `${acc}|${r.date}`;
      targetByAccountDate.set(key, (targetByAccountDate.get(key) || 0) + Number(r.value || 0));
    }

    return { targetByAccountDate, isLoading: false };
  }, [actionsQ.data, actionsQ.isLoading, accountAdsets, campaigns, lpConfigs, adMeta, insights]);

  return {
    targetByAccountDate: result.targetByAccountDate,
    isLoading: Boolean(actionsQ.isLoading) || result.isLoading,
  };
}

// Re-export the canonical event constants for any caller that needs them.
export const CANONICAL_EVENTS = {
  NATIVE_LEAD_GROUPED,
  LP_VIEW_EVENT,
  MESSAGE_EVENT,
};
