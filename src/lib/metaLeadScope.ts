export interface MetaLeadDestinationRow {
  ad_account_id: string;
  ad_id: string;
  adset_id?: string | null;
}

export const META_MESSAGE_DESTINATION_TYPES = new Set([
  "MESSENGER", "WHATSAPP", "INSTAGRAM_DIRECT",
  "MESSAGING_INSTAGRAM_DIRECT", "MESSAGING_MESSENGER", "MESSAGING_WHATSAPP",
]);

export function isMetaMessagingDestination(destinationType: string | null | undefined) {
  return META_MESSAGE_DESTINATION_TYPES.has(String(destinationType || "").toUpperCase());
}

/**
 * A configured account-level pixel action is a valid site lead only for ads
 * whose persisted Meta ad set destination is explicitly WEBSITE. This keeps
 * residual pixel events from Instant Form and messaging campaigns out of site
 * lead totals. Unknown destinations fail closed.
 */
export function buildSiteEligibleMetaAdScopes<T extends MetaLeadDestinationRow>(
  rows: T[],
  destinationTypeByAdset: Record<string, string | null | undefined>,
) {
  return new Set(rows
    .filter((row) => row.adset_id && String(destinationTypeByAdset[row.adset_id] || "").toUpperCase() === "WEBSITE")
    .map((row) => `${row.ad_account_id}|${row.ad_id}`));
}

/** Conversation actions on form/profile/traffic ads are not campaign results. */
export function buildConversationEligibleMetaAdScopes<T extends MetaLeadDestinationRow>(
  rows: T[],
  destinationTypeByAdset: Record<string, string | null | undefined>,
) {
  return new Set(rows
    .filter((row) => row.adset_id && isMetaMessagingDestination(destinationTypeByAdset[row.adset_id]))
    .map((row) => `${row.ad_account_id}|${row.ad_id}`));
}
