export const FORM_ACTION_TYPES = [
  // `lead_grouped` is the official Ads Manager result for Instant Forms.
  // Other action types are legacy/aggregate aliases; prefer this exact event
  // whenever Meta returns it so an inflated alias cannot replace its count.
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "onsite_conversion.lead",
  "leadgen.other",
  "omni_lead",
] as const;
export const SITE_ACTION_TYPES = ["offsite_conversion.fb_pixel_lead", "offsite_conversion.lead"] as const;
export const CONVERSATION_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started_28d",
  "onsite_conversion.messaging_conversation_started_7d_click",
  "onsite_conversion.messaging_conversation_started_1d_view",
  "onsite_conversion.messaging_conversation_started",
  "messaging_conversation_started_7d",
  "messaging_conversation_started",
  "onsite_conversion.total_messaging_connection",
  "total_messaging_connection",
] as const;

function firstAliasValue(values: Record<string, number>, aliases: readonly string[]) {
  const alias = aliases.find((type) => Object.prototype.hasOwnProperty.call(values, type));
  return alias ? Math.max(0, Number(values[alias] || 0)) : 0;
}

export function resolveMetaLeadParts(
  values: Record<string, number>,
  configuredSiteAction?: string,
) {
  // Pixel events may be residual on native-form campaigns. A site lead is
  // countable only when its conversion event is explicitly configured per account.
  const siteAliases = configuredSiteAction
    && !FORM_ACTION_TYPES.includes(configuredSiteAction as typeof FORM_ACTION_TYPES[number])
    && configuredSiteAction !== "lead"
    ? [configuredSiteAction]
    : [];
  const formAction = FORM_ACTION_TYPES.find((type) => Object.prototype.hasOwnProperty.call(values, type));
  const hasSite = siteAliases.some((type) => Object.prototype.hasOwnProperty.call(values, type));
  const hasUnconfiguredSiteSignal = SITE_ACTION_TYPES.some((type) => Object.prototype.hasOwnProperty.call(values, type));
  const hasConversation = CONVERSATION_ACTION_TYPES.some((type) => Object.prototype.hasOwnProperty.call(values, type));
  // These action types are alternate representations of the same result, not
  // additive events. Use the first canonical event present (including zero),
  // never the largest alias: broad `omni_lead`/`lead` values can exceed the
  // grouped Instant Form result shown by Ads Manager.
  const forms = formAction
    ? Math.max(0, Number(values[formAction] || 0))
    : hasSite || hasUnconfiguredSiteSignal || hasConversation
      ? 0
      // Very old accounts can return only this ambiguous aggregate. Use it
      // solely as a last-resort fallback when no other lead mechanism exists.
      : Math.max(0, Number(values.lead || 0));
  const site = firstAliasValue(values, siteAliases);
  const conversations = firstAliasValue(values, CONVERSATION_ACTION_TYPES);
  return { forms, site, conversations, total: forms + site + conversations };
}

export type MetaLeadInsight = {
  ad_id: string;
  ad_account_id: string;
  date: string;
  leads: number | null;
};

export type MetaLeadAction = {
  ad_id: string;
  date: string;
  action_type: string;
  value: number | null;
};

/**
 * Resolve Meta lead actions per account/ad/day. Equivalent event aliases are
 * alternatives, not additive facts; the account's configured site event wins
 * when present. The legacy `insights.leads` aggregate is deliberately ignored.
 */
export function canonicalMetaLeads<T extends MetaLeadInsight>(
  rows: T[],
  actions: MetaLeadAction[],
  siteActionByAccount: Record<string, string | undefined>,
) {
  const byAdDate = new Map<string, Record<string, number>>();
  for (const row of actions) {
    const key = `${row.ad_id}|${row.date}`;
    const values = byAdDate.get(key) || {};
    values[row.action_type] = Math.max(values[row.action_type] || 0, Math.max(0, Number(row.value || 0)));
    byAdDate.set(key, values);
  }
  return rows.map((row) => {
    const values = byAdDate.get(`${row.ad_id}|${row.date}`) || {};
    const parts = resolveMetaLeadParts(values, siteActionByAccount[row.ad_account_id]);
    return {
      ...row,
      form_leads: parts.forms,
      site_leads: parts.site,
      conversations: parts.conversations,
      leads: parts.total,
    };
  });
}
