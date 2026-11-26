import { CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES, resolveMetaLeadParts } from "../../supabase/functions/_shared/metaLeadMetrics.ts";
import { matchesMetaAttributionWindow, normalizeMetaAttributionWindow } from "@/lib/metaInsightFacts";

export const META_ACTION_TYPES = {
  // `lead` is an ambiguous auxiliary action on messaging campaigns and is
  // never used as a canonical form/site fallback.
  // Lead Ads and older Lead Ads aliases are exposed by Meta as result actions.
  // Website conversions stay in the separate `site` group below.
  // Resolve them by canonical provider priority, never by maximum alias value.
  forms: FORM_ACTION_TYPES,
  site: SITE_ACTION_TYPES,
  // Only explicit started-conversation actions are canonical. Total
  // connections/replies remain diagnostic events, not acquired leads.
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

export function resolveMetaLeadActions(actionTotals?: Record<string, number>, siteAction?: string | null, siteDestinationConfirmed = false, conversationDestinationConfirmed = false) {
  // The shared pure resolver is also used by Meta ingestion, MCP and AI/RAG.
  // Aliases use shared provider precedence; only the three distinct groups sum.
  return resolveMetaLeadParts(actionTotals || {}, siteAction || undefined, siteDestinationConfirmed, conversationDestinationConfirmed);
}

export function aggregateScopedMetaLeads(
  insightRows: Array<{ ad_id: string; date: string; ad_account_id: string; attribution_window?: string | null }>,
  actionRows: Array<{ ad_id: string; date: string; action_type: string; value: number | null; attribution_window?: string | null }>,
  siteActionByAccount: Record<string, string | undefined> = {},
  siteEligibleAdScopes?: ReadonlySet<string>,
  conversationEligibleAdScopes?: ReadonlySet<string>,
) {
  return aggregateMetaLeadTargets(insightRows, actionRows, siteActionByAccount, siteEligibleAdScopes, conversationEligibleAdScopes).totals.total;
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
  const conversationDestinationConfirmed = objectiveKey.includes("MESSAG") || goalKey.includes("CONVERSATION") || goalKey.includes("MESSAGE");
  const conversations = resolveMetaLeadActions(actionTotals, undefined, false, conversationDestinationConfirmed).conversations;
  const purchases = value(META_ACTION_TYPES.purchase);
  const landingPageViews = value(META_ACTION_TYPES.landingPageView);
  const linkClicks = value(META_ACTION_TYPES.linkClick);
  const leadActions = resolveMetaLeadActions(actionTotals, undefined, false, conversationDestinationConfirmed);

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
  siteEligibleAdScopes?: ReadonlySet<string>,
  conversationEligibleAdScopes?: ReadonlySet<string>,
) {
  const totals = { forms: 0, site: 0, conversations: 0, total: 0 };
  const dailyByAccount: Record<string, Record<string, { forms: number; site: number; conversations: number; total: number }>> = {};
  for (const [adId, dates] of Object.entries(dailyActionsByAd)) {
    const accountId = accountByAd[adId];
    for (const [date, actions] of Object.entries(dates)) {
      const scopeKey = accountId
        ? adId.startsWith(`${accountId}|`) ? adId : `${accountId}|${adId}`
        : adId;
      const siteDestinationConfirmed = Boolean(siteEligibleAdScopes?.has(scopeKey));
      const conversationDestinationConfirmed = Boolean(conversationEligibleAdScopes?.has(scopeKey));
      const siteAction = accountId ? siteActionByAccount[accountId] : undefined;
      const resolved = resolveMetaLeadActions(actions, siteAction, siteDestinationConfirmed, conversationDestinationConfirmed);
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

/**
 * Resolve the global Meta lead contract per account/day from persisted action
 * facts. When a caller supplies a site-eligible scope, site actions are only
 * admitted for ad sets explicitly classified as WEBSITE; absent metadata then
 * fails closed for the site component without hiding forms or conversations.
 */
export function aggregateMetaLeadTargets(
  insightRows: Array<{ ad_id: string; ad_account_id?: string | null; date: string; attribution_window?: string | null }>,
  actionRows: Array<{ ad_account_id?: string | null; ad_id: string; date: string; action_type: string; value: number | null; attribution_window?: string | null }>,
  siteActionByAccount: Record<string, string | undefined> = {},
  siteEligibleAdScopes?: ReadonlySet<string>,
  conversationEligibleAdScopes?: ReadonlySet<string>,
) {
  const accountByScopedAd: Record<string, string | null> = {};
  const accountsByAd = new Map<string, Set<string>>();
  const attributionByAdDate = new Map<string, string>();
  const ambiguousInsightScopes = new Set<string>();
  const snapshotKeys = new Set<string>();
  for (const row of insightRows) {
    const accountId = row.ad_account_id || "";
    const scopedAdKey = `${accountId}|${row.ad_id}`;
    accountByScopedAd[scopedAdKey] = accountId || null;
    const adAccounts = accountsByAd.get(row.ad_id) || new Set<string>();
    if (accountId) adAccounts.add(accountId);
    accountsByAd.set(row.ad_id, adAccounts);
    const key = `${accountId}|${row.ad_id}|${row.date}`;
    const attribution = normalizeMetaAttributionWindow(row.attribution_window);
    const existing = attributionByAdDate.get(key);
    // The same ad/day in two attribution windows is ambiguous unless callers
    // first scope the rows to the account's configured window. Fail closed;
    // silently choosing whichever row happened to arrive last mixes totals.
    if (existing && existing !== attribution) ambiguousInsightScopes.add(key);
    else attributionByAdDate.set(key, attribution);
    snapshotKeys.add(key);
  }

  const facts = new Map<string, typeof actionRows[number]>();
  for (const row of actionRows) {
    const candidateAccounts = accountsByAd.get(row.ad_id);
    // Legacy fixtures/rows without account UUID remain safe only when this ad
    // ID maps to exactly one account in the selected Insights scope.
    const accountId = row.ad_account_id || (candidateAccounts?.size === 1 ? Array.from(candidateAccounts)[0] : null);
    if (!accountId || !candidateAccounts?.has(accountId)) continue;
    const scopeKey = `${accountId}|${row.ad_id}|${row.date}`;
    const insightAttribution = attributionByAdDate.get(scopeKey);
    if (!accountId
      || !snapshotKeys.has(scopeKey)
      || ambiguousInsightScopes.has(scopeKey)
      || !insightAttribution
      || !matchesMetaAttributionWindow(row.attribution_window, insightAttribution)) continue;
    const key = `${accountId}|${row.ad_id}|${row.date}|${row.action_type}`;
    const previous = facts.get(key);
    // Legacy NULL and explicit account_default rows describe the same fact.
    if (!previous || (!previous.attribution_window && row.attribution_window)) facts.set(key, row);
  }

  const dailyByAd: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of facts.values()) {
    const accountId = row.ad_account_id || (accountsByAd.get(row.ad_id)?.size === 1 ? Array.from(accountsByAd.get(row.ad_id)!)[0] : null);
    if (!accountId) continue;
    const scopedAdKey = `${accountId}|${row.ad_id}`;
    const days = dailyByAd[scopedAdKey] || (dailyByAd[scopedAdKey] = {});
    const actions = days[row.date] || (days[row.date] = {});
    actions[row.action_type] = Math.max(actions[row.action_type] || 0, Math.max(0, Number(row.value || 0)));
  }

  return aggregateMetaLeadActionDays(dailyByAd, accountByScopedAd, siteActionByAccount, siteEligibleAdScopes, conversationEligibleAdScopes);
}
