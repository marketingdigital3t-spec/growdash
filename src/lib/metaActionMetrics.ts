import { CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES, resolveMetaLeadParts } from "../../supabase/functions/_shared/metaLeadMetrics.ts";

export const META_ACTION_TYPES = {
  // `lead` is an ambiguous auxiliary action on messaging campaigns. Prefer
  // native form events and only use it as a fallback when none is present.
  // Lead Ads and older Lead Ads aliases are exposed by Meta as result actions.
  // Website conversions stay in the separate `site` group below.
  // Resolve them by canonical provider priority, never by maximum alias value.
  forms: FORM_ACTION_TYPES,
  site: SITE_ACTION_TYPES,
  // Older Meta accounts expose the same result as total_messaging_connection.
  // It is a fallback alias only; shared provider priority selects one event.
  conversations: CONVERSATION_ACTION_TYPES,
  linkClick: ["link_click"],
  landingPageView: ["landing_page_view"],
  checkout: [
    "omni_initiated_checkout",
    "initiate_checkout",
    "offsite_conversion.fb_pixel_initiate_checkout",
  ],
  purchase: [
    "omni_purchase",
    "purchase",
    "offsite_conversion.fb_pixel_purchase",
  ],
} as const;

function preferredValue(source: Record<string, number> | undefined, aliases: readonly string[]) {
  if (!source) return 0;
  const values = aliases.filter((alias) => Object.prototype.hasOwnProperty.call(source, alias)).map((alias) => Math.max(0, Number(source[alias] || 0)));
  return values.length ? Math.max(...values) : 0;
}

export function resolveMetaActionMetrics(
  actionTotals?: Record<string, number>,
  actionValueTotals?: Record<string, number>,
) {
  return {
    linkClicks: preferredValue(actionTotals, META_ACTION_TYPES.linkClick),
    landingPageViews: preferredValue(actionTotals, META_ACTION_TYPES.landingPageView),
    checkouts: preferredValue(actionTotals, META_ACTION_TYPES.checkout),
    purchases: preferredValue(actionTotals, META_ACTION_TYPES.purchase),
    purchaseValue: preferredValue(actionValueTotals, META_ACTION_TYPES.purchase),
  };
}

export function resolveMetaLeadActions(actionTotals?: Record<string, number>, siteAction?: string | null) {
  // The shared pure resolver is also used by Meta ingestion, MCP and AI/RAG.
  // Aliases use shared provider precedence; only the three distinct groups sum.
  return resolveMetaLeadParts(actionTotals || {}, siteAction || undefined);
}

export type MetaResultType = "leads" | "conversations" | "landing_page_view" | "purchase" | "reach";

/**
 * Resolves the single Result column used by Ads Manager for a campaign.
 * Objective is the primary signal; action aliases follow shared provider
 * priority rather than selecting the largest alternative event.
 */
export function resolveMetaCampaignResult(
  objective: string | null | undefined,
  optimizationGoal: string | null | undefined,
  actionTotals?: Record<string, number>,
) {
  const objectiveKey = String(objective || "").toUpperCase();
  const goalKey = String(optimizationGoal || "").toUpperCase();
  const value = (aliases: readonly string[]) => preferredValue(actionTotals, aliases);
  const conversations = resolveMetaLeadActions(actionTotals).conversations;
  const purchases = value(META_ACTION_TYPES.purchase);
  const landingPageViews = value(META_ACTION_TYPES.landingPageView);
  const linkClicks = value(META_ACTION_TYPES.linkClick);
  const leadActions = resolveMetaLeadActions(actionTotals);

  if (objectiveKey.includes("SALES") || objectiveKey.includes("CONVERSION") || goalKey.includes("PURCHASE")) {
    return { resultType: "purchase" as const, value: purchases };
  }
  if (objectiveKey.includes("TRAFFIC") || goalKey.includes("LANDING_PAGE_VIEW")) {
    return { resultType: "landing_page_view" as const, value: landingPageViews || linkClicks };
  }
  if (objectiveKey.includes("ENGAGEMENT") || objectiveKey.includes("MESSAGING") || goalKey.includes("CONVERSATION")) {
    return { resultType: "conversations" as const, value: conversations };
  }
  if (objectiveKey.includes("AWARENESS") || goalKey.includes("REACH")) {
    return { resultType: "reach" as const, value: 0 };
  }
  return { resultType: "leads" as const, value: leadActions.forms + leadActions.site };
}

export function aggregateMetaLeadActionDays(
  dailyActionsByAd: Record<string, Record<string, Record<string, number>>>,
  accountByAd: Record<string, string | null | undefined>,
  siteActionByAccount: Record<string, string | undefined> = {},
) {
  const totals = { forms: 0, site: 0, conversations: 0, total: 0 };
  const dailyByAccount: Record<string, Record<string, { forms: number; site: number; conversations: number; total: number }>> = {};
  for (const [adId, dates] of Object.entries(dailyActionsByAd)) {
    const accountId = accountByAd[adId];
    for (const [date, actions] of Object.entries(dates)) {
      const resolved = resolveMetaLeadActions(actions, accountId ? siteActionByAccount[accountId] : undefined);
      totals.forms += resolved.forms;
      totals.site += resolved.site;
      totals.conversations += resolved.conversations;
      if (!accountId) continue;
      const current = dailyByAccount[accountId]?.[date] || { forms: 0, site: 0, conversations: 0, total: 0 };
      current.forms += resolved.forms;
      current.site += resolved.site;
      current.conversations += resolved.conversations;
      current.total = current.forms + current.site + current.conversations;
      dailyByAccount[accountId] = { ...(dailyByAccount[accountId] || {}), [date]: current };
    }
  }
  totals.total = totals.forms + totals.site + totals.conversations;
  return { totals, dailyByAccount };
}
