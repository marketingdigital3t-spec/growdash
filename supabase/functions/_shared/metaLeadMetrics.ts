export const FORM_ACTION_TYPES = [
  // `lead_grouped` is the official Ads Manager result for Instant Forms.
  // These events identify an on-Meta Lead Ads conversion. Generic `lead` and
  // `omni_lead` are intentionally excluded because they can aggregate site
  // events and cannot be classified as native forms without more evidence.
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
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
] as const;

// Keep these actions available to diagnostics and to prevent ambiguous legacy
// `lead` totals from being mistaken for form leads on messaging campaigns.
// They are not evidence of a newly started conversation and never contribute
// to the canonical Meta Leads KPI.
export const MESSAGING_AUXILIARY_ACTION_TYPES = [
  "onsite_conversion.total_messaging_connection",
  "total_messaging_connection",
  "onsite_conversion.messaging_conversation_replied_7d",
] as const;

export const META_LEAD_ACTION_TYPES = [
  ...FORM_ACTION_TYPES,
  ...SITE_ACTION_TYPES,
  ...CONVERSATION_ACTION_TYPES,
] as const;

function firstAliasValue(values: Record<string, number>, aliases: readonly string[]) {
  const alias = aliases.find((type) => Object.prototype.hasOwnProperty.call(values, type));
  return alias ? Math.max(0, Number(values[alias] || 0)) : 0;
}

export function resolveMetaLeadParts(
  values: Record<string, number>,
  configuredSiteAction?: string,
  siteDestinationConfirmed = false,
  conversationDestinationConfirmed = false,
) {
  // Pixel events may be residual on native-form campaigns. A site lead is
  // countable only when its conversion event is configured and the caller
  // confirmed this ad's destination is WEBSITE.
  const siteAliases = siteDestinationConfirmed && configuredSiteAction
    && !FORM_ACTION_TYPES.includes(configuredSiteAction as typeof FORM_ACTION_TYPES[number])
    && configuredSiteAction !== "lead"
    ? [configuredSiteAction]
    : [];
  // Aliases are alternate representations, not additive facts. Select the
  // first explicitly classified event by canonical priority; never infer a
  // form from generic `lead`/`omni_lead` aggregates.
  const forms = firstAliasValue(values, FORM_ACTION_TYPES);
  const site = firstAliasValue(values, siteAliases);
  const conversations = conversationDestinationConfirmed ? firstAliasValue(values, CONVERSATION_ACTION_TYPES) : 0;
  return { forms, site, conversations, total: forms + site + conversations };
}

export type MetaLeadInsight = {
  ad_id: string;
  ad_account_id: string;
  date: string;
  leads: number | null;
};

export type MetaLeadAction = {
	ad_account_id: string;
  ad_id: string;
  date: string;
  action_type: string;
  value: number | null;
};

/** Read a resolved lead total without allowing missing/non-finite data into aggregates. */
export function canonicalMetaLeadValue(row: { leads: number | null } | null | undefined) {
  const value = Number(row?.leads);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Resolve Meta lead actions per account/ad/day. Equivalent event aliases are
 * alternatives, not additive facts. A configured site event is counted only
 * when the caller proves that this ad's destination is WEBSITE. The legacy
 * `insights.leads` aggregate is deliberately ignored.
 */
export function canonicalMetaLeads<T extends Omit<MetaLeadInsight, "leads"> & { leads: number | null }>(
  rows: T[],
  actions: MetaLeadAction[],
  siteActionByAccount: Record<string, string | undefined>,
  siteEligibleAdScopes?: ReadonlySet<string>,
  conversationEligibleAdScopes?: ReadonlySet<string>,
): Array<Omit<T, "leads"> & { form_leads: number; site_leads: number; conversations: number; leads: number }> {
  const byAdDate = new Map<string, Record<string, number>>();
  for (const row of actions) {
    const key = `${row.ad_account_id}|${row.ad_id}|${row.date}`;
    const values = byAdDate.get(key) || {};
    values[row.action_type] = Math.max(values[row.action_type] || 0, Math.max(0, Number(row.value || 0)));
    byAdDate.set(key, values);
  }
  return rows.map((row) => {
    const values = byAdDate.get(`${row.ad_account_id}|${row.ad_id}|${row.date}`) || {};
    const scopeKey = `${row.ad_account_id}|${row.ad_id}`;
    const siteDestinationConfirmed = Boolean(siteEligibleAdScopes?.has(scopeKey));
    const conversationDestinationConfirmed = Boolean(conversationEligibleAdScopes?.has(scopeKey));
    const parts = resolveMetaLeadParts(values, siteActionByAccount[row.ad_account_id], siteDestinationConfirmed, conversationDestinationConfirmed);
    return {
      ...row,
      form_leads: parts.forms,
      site_leads: parts.site,
      conversations: parts.conversations,
      leads: parts.total,
    };
  });
}
