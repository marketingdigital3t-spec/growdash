export const META_ACTION_TYPES = {
  // `lead` is an ambiguous auxiliary action on messaging campaigns. Prefer
  // native form events and only use it as a fallback when none is present.
  // Lead Ads, older Lead Ads aliases and website lead conversions are all
  // exposed by Meta as result actions depending on campaign destination.
  // Resolve them as aliases (max, never additive) so one submission is not
  // counted twice when Meta returns more than one representation.
  forms: ["onsite_conversion.lead_grouped", "omni_lead", "leadgen_grouped", "offsite_conversion.fb_pixel_lead"],
  // Older Meta accounts expose the same result as total_messaging_connection.
  // It is a fallback alias only; preferredValue() prevents additive counting
  // when a started-conversation alias is present in the same ad.
  conversations: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_conversation_started_28d", "onsite_conversion.messaging_conversation_started", "onsite_conversion.total_messaging_connection"],
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
  const nativeAliases = META_ACTION_TYPES.forms;
  const hasNativeAlias = nativeAliases.some((alias) => Object.prototype.hasOwnProperty.call(actionTotals || {}, alias));
  const hasConversationAlias = META_ACTION_TYPES.conversations.some((alias) => Object.prototype.hasOwnProperty.call(actionTotals || {}, alias));
  const hasSiteAlias = !!siteAction && Object.prototype.hasOwnProperty.call(actionTotals || {}, siteAction);
  const site = siteAction && !nativeAliases.includes(siteAction as any) && siteAction !== "lead"
    ? preferredValue(actionTotals, [siteAction])
    : 0;
  const forms = hasNativeAlias ? preferredValue(actionTotals, nativeAliases) : hasConversationAlias || hasSiteAlias ? 0 : preferredValue(actionTotals, ["lead"]);
  const conversations = preferredValue(actionTotals, META_ACTION_TYPES.conversations);
  return {
    forms,
    site,
    conversations,
    total: forms + site + conversations,
  };
}
