export const FORM_ACTION_TYPES = ["onsite_conversion.lead_grouped", "omni_lead", "leadgen_grouped"] as const;
export const SITE_ACTION_TYPES = ["offsite_conversion.fb_pixel_lead", "offsite_conversion.lead"] as const;
export const CONVERSATION_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started_28d",
  "onsite_conversion.messaging_conversation_started",
  "onsite_conversion.total_messaging_connection",
] as const;

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
export function canonicalMetaLeads(
  rows: MetaLeadInsight[],
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
  const maxAlias = (values: Record<string, number>, aliases: readonly string[]) => Math.max(0, ...aliases.map((alias) => Number(values[alias] || 0)));
  return rows.map((row) => {
    const values = byAdDate.get(`${row.ad_id}|${row.date}`) || {};
    const configuredSiteAction = siteActionByAccount[row.ad_account_id];
    const siteAliases = configuredSiteAction && !FORM_ACTION_TYPES.includes(configuredSiteAction as typeof FORM_ACTION_TYPES[number]) && configuredSiteAction !== "lead"
      ? [configuredSiteAction]
      : SITE_ACTION_TYPES;
    const hasNative = FORM_ACTION_TYPES.some((type) => Object.prototype.hasOwnProperty.call(values, type));
    const hasSite = siteAliases.some((type) => Object.prototype.hasOwnProperty.call(values, type));
    const hasConversation = CONVERSATION_ACTION_TYPES.some((type) => Object.prototype.hasOwnProperty.call(values, type));
    const forms = hasNative ? maxAlias(values, FORM_ACTION_TYPES) : hasSite || hasConversation ? 0 : maxAlias(values, ["lead"]);
    const site = maxAlias(values, siteAliases);
    const conversations = maxAlias(values, CONVERSATION_ACTION_TYPES);
    return { ...row, leads: forms + site + conversations };
  });
}
