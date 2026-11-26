export type CampaignResultBreakdown = { label: string; value: number };
export type CampaignPrimaryResult = { label: "Leads" | "Conversas iniciadas" | "Visualizações da página" | "Compras" | "Alcance"; value: number };
export type OfficialCampaignResult = { type?: string | null; value?: number | null };

export function selectOfficialCampaignResult(
  objective: string | null | undefined,
  optimizationGoal: string | null | undefined,
  byType: Record<string, number> | undefined,
): OfficialCampaignResult | undefined {
  const entries = Object.entries(byType || {})
    .map(([type, value]) => [String(type).toLowerCase(), Math.max(0, Number(value || 0))] as const)
    .filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return undefined;

  const objectiveKey = String(objective || "").toUpperCase();
  const goalKey = String(optimizationGoal || "").toUpperCase();
  const preferredType = objectiveKey.includes("SALES") || objectiveKey.includes("CONVERSION") || goalKey.includes("PURCHASE")
    ? "purchase"
    : objectiveKey.includes("TRAFFIC") || goalKey.includes("LANDING_PAGE_VIEW")
      ? "landing_page_view"
      : objectiveKey.includes("AWARENESS") || goalKey.includes("REACH")
        ? "reach"
        : objectiveKey.includes("MESSAG") || objectiveKey.includes("ENGAGEMENT") || goalKey.includes("CONVERSATION")
          ? "conversations"
          : "leads";
  const exact = entries.find(([type]) => type === preferredType);
  if (exact) return { type: exact[0], value: exact[1] };
  // A known objective must not silently adopt an unrelated event type just
  // because it has a larger value. This is the behavior that caused the
  // Growdash result column to diverge from Ads Manager.
  const hasKnownObjective = Boolean(objectiveKey || goalKey);
  return hasKnownObjective ? undefined : { type: entries[0][0], value: entries[0][1] };
}

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
 * A tabela mostra o mesmo resultado principal usado pela Meta: primeiro o
 * resultado oficial persistido no snapshot; depois o evento correspondente ao
 * objetivo/otimização; somente em dados antigos sem objetivo conhecido usa o
 * maior evento disponível como fallback. Nunca escolhe o maior evento quando
 * a Meta já informou qual é o resultado da campanha.
 */
export function resolveCampaignPrimaryResult(
  objective: string | null | undefined,
  results: { leadCount: number; conversations: number; landingPageViews?: number; purchases?: number; reach?: number },
  official?: OfficialCampaignResult,
): CampaignPrimaryResult {
  const officialValue = Number(official?.value);
  if (official?.type && Number.isFinite(officialValue) && officialValue >= 0) {
    const type = String(official.type).toLowerCase();
    if (type.includes("purchase") || type.includes("conversion")) return { label: "Compras", value: officialValue };
    if (type.includes("landing") || type.includes("page_view") || type === "traffic") return { label: "Visualizações da página", value: officialValue };
    if (type.includes("reach")) return { label: "Alcance", value: officialValue };
    if (type.includes("conversation") || type.includes("messag")) return { label: "Conversas iniciadas", value: officialValue };
    if (type.includes("lead")) return { label: "Leads", value: officialValue };
  }

  const normalizedObjective = String(objective || "").toUpperCase();
  const leads = Math.max(0, Number(results.leadCount || 0));
  const conversations = Math.max(0, Number(results.conversations || 0));
  const landingPageViews = Math.max(0, Number(results.landingPageViews || 0));
  const purchases = Math.max(0, Number(results.purchases || 0));
  const reach = Math.max(0, Number(results.reach || 0));

  if (normalizedObjective.includes("SALES") || normalizedObjective.includes("CONVERSION")) return { label: "Compras", value: purchases };
  if (normalizedObjective.includes("TRAFFIC")) return { label: "Visualizações da página", value: landingPageViews };
  if (normalizedObjective.includes("AWARENESS")) return { label: "Alcance", value: reach };
  if (normalizedObjective.includes("MESSAG") || normalizedObjective.includes("ENGAGEMENT")) return { label: "Conversas iniciadas", value: conversations };
  if (normalizedObjective.includes("LEAD")) return { label: "Leads", value: leads };

  if (leads === 0 && conversations === 0) {
    return { label: "Leads", value: 0 };
  }
  if (leads === 0) return { label: "Conversas iniciadas", value: conversations };
  if (conversations === 0) return { label: "Leads", value: leads };
  if (leads === conversations) return { label: "Leads", value: leads };
  return leads > conversations ? { label: "Leads", value: leads } : { label: "Conversas iniciadas", value: conversations };
}
import { META_ACTION_TYPES, resolveMetaLeadActions } from "./metaActionMetrics";
