export type CampaignResultBreakdown = { label: string; value: number };
export type CampaignPrimaryResult = { label: "Leads" | "Conversas iniciadas"; value: number };

const LEAD_ACTION_TYPES = [
  "lead",
  "omni_lead",
  "leadgen_grouped",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
] as const;

const CONVERSATION_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started_28d",
  "onsite_conversion.messaging_first_reply",
] as const;

function preferredActionTotal(actionTotals: Record<string, number>, aliases: readonly string[]) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(actionTotals, alias)) return Math.max(0, Number(actionTotals[alias] || 0));
  }
  return 0;
}

/**
 * Meta can expose a campaign outcome in `insights.leads` or only through an
 * action event. Conversations are a separate, valid lead origin and must be
 * exposed separately, without counting clicks, page views, checkout or purchases.
 */
export function resolveCampaignResults(insightLeads: number, actionTotals: Record<string, number>) {
  const leadsFromInsights = Math.max(0, Number(insightLeads || 0));
  const leadsFromEvents = preferredActionTotal(actionTotals, LEAD_ACTION_TYPES);
  const leadCount = leadsFromInsights > 0 ? leadsFromInsights : leadsFromEvents;
  const conversations = preferredActionTotal(actionTotals, CONVERSATION_ACTION_TYPES);
  const breakdown: CampaignResultBreakdown[] = [];

  if (leadCount > 0) breakdown.push({ label: leadsFromInsights > 0 ? "Leads Meta" : "Leads por evento", value: leadCount });
  if (conversations > 0) breakdown.push({ label: "Conversas iniciadas", value: conversations });

  return { total: leadCount, leadCount, conversations, breakdown };
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
