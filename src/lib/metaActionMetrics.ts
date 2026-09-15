export const META_ACTION_TYPES = {
  forms: ["onsite_conversion.lead_grouped", "lead", "omni_lead", "leadgen_grouped", "offsite_conversion.fb_pixel_lead"],
  conversations: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_conversation_started_28d", "onsite_conversion.messaging_conversation_started", "onsite_conversion.total_messaging_connection", "onsite_conversion.messaging_first_reply"],
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

export function resolveMetaLeadActions(actionTotals?: Record<string, number>) {
  return {
    forms: preferredValue(actionTotals, META_ACTION_TYPES.forms),
    conversations: preferredValue(actionTotals, META_ACTION_TYPES.conversations),
  };
}
