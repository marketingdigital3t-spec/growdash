export type CampaignResultBreakdown = { label: string; value: number };
export type CampaignPrimaryResult = { label: "Leads" | "Conversas iniciadas"; value: number };

/**
 * Acquisition results come only from canonical lead actions (forms, site and
 * conversations). The legacy `insights.leads` aggregate is not evidence and
 * must never be used as a fallback when action data is missing.
 */
export function resolveCampaignResults(
  insightLeads: number,
  actionTotals: Record<string, number>,
  siteAction?: string | null,
  insightParts?: { forms?: number | null; site?: number | null; conversations?: number | null; legacyLeads?: number | null; siteDestinationConfirmed?: boolean; conversationDestinationConfirmed?: boolean },
) {
  // Kept in the signature for callers migrating from the old contract; the
  // legacy aggregate is intentionally ignored.
  void insightLeads;
  const actionLeads = resolveMetaLeadActions(
    actionTotals,
    siteAction,
    insightParts?.siteDestinationConfirmed === true,
    insightParts?.conversationDestinationConfirmed !== false,
  );
  const siteAliases = siteAction && !META_ACTION_TYPES.forms.includes(siteAction as any) && siteAction !== "lead"
    ? [siteAction]
    : [...META_ACTION_TYPES.site];
  const hasFormEvents = META_ACTION_TYPES.forms.some((alias) => Object.prototype.hasOwnProperty.call(actionTotals, alias));
  const hasSiteEvents = insightParts?.siteDestinationConfirmed === true
    && siteAliases.some((alias) => Object.prototype.hasOwnProperty.call(actionTotals, alias));
  const hasConversationEvents = insightParts?.conversationDestinationConfirmed !== false
    && META_ACTION_TYPES.conversations.some((alias) => Object.prototype.hasOwnProperty.call(actionTotals, alias));
  const hasGenericLead = Object.prototype.hasOwnProperty.call(actionTotals, "lead") && !hasFormEvents && !hasSiteEvents && !hasConversationEvents;
  // Each component is resolved independently: a forms event cannot suppress a
  // persisted conversation count when the Meta action response is incomplete.
  const hasFormEventSource = hasFormEvents || hasGenericLead;
  const hasPersistedParts = Boolean(insightParts && [insightParts.forms, insightParts.site, insightParts.conversations]
    .some((value) => value !== null && value !== undefined));
  const forms = hasFormEventSource
    ? actionLeads.forms
    : hasPersistedParts ? Math.max(0, Number(insightParts?.forms || 0)) : 0;
  const site = hasSiteEvents
    ? actionLeads.site
    : hasPersistedParts ? Math.max(0, Number(insightParts?.site || 0)) : 0;
  const conversations = hasConversationEvents
    ? actionLeads.conversations
    : hasPersistedParts && insightParts?.conversationDestinationConfirmed !== false
      ? Math.max(0, Number(insightParts?.conversations || 0))
      : 0;
  const leadCount = forms + site;
  const breakdown: CampaignResultBreakdown[] = [];

  if (forms + site > 0) breakdown.push({ label: hasFormEventSource || hasSiteEvents ? "Leads por evento" : "Leads Meta", value: forms + site });
  if (site > 0) breakdown.push({ label: "Leads de site", value: site });
  if (conversations > 0) breakdown.push({ label: "Conversas iniciadas", value: conversations });

  return { total: leadCount + conversations, leadCount, conversations, breakdown };
}

/**
 * A tabela mostra sempre um único resultado principal: se há apenas um tipo
 * de evento, ele próprio; se há mais de um, o de maior volume. Os demais
 * continuam disponíveis na composição exibida ao passar o mouse.
 */
export function resolveCampaignPrimaryResult(
  objective: string | null | undefined,
  results: Pick<ReturnType<typeof resolveCampaignResults>, "leadCount" | "conversations">,
): CampaignPrimaryResult {
  const normalizedObjective = String(objective || "").toUpperCase();
  const isLeadCampaign = normalizedObjective.includes("LEAD");

  const leads = Math.max(0, Number(results.leadCount || 0));
  const conversations = Math.max(0, Number(results.conversations || 0));

  if (leads === 0 && conversations === 0) {
    return isLeadCampaign ? { label: "Leads", value: 0 } : { label: "Conversas iniciadas", value: 0 };
  }
  if (leads === 0) return { label: "Conversas iniciadas", value: conversations };
  if (conversations === 0) return { label: "Leads", value: leads };
  if (leads === conversations) return isLeadCampaign ? { label: "Leads", value: leads } : { label: "Conversas iniciadas", value: conversations };
  return leads > conversations ? { label: "Leads", value: leads } : { label: "Conversas iniciadas", value: conversations };
}
import { META_ACTION_TYPES, resolveMetaLeadActions } from "./metaActionMetrics";
