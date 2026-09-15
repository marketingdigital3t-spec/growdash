export type CampaignResultBreakdown = { label: string; value: number };
export type CampaignPrimaryResult = { label: "Leads" | "Conversas iniciadas"; value: number };

/**
 * Meta can expose a campaign outcome in `insights.leads` or only through an
 * action event. Conversations are a separate, valid lead origin and must be
 * exposed separately, without counting clicks, page views, checkout or purchases.
 */
export function resolveCampaignResults(insightLeads: number, actionTotals: Record<string, number>) {
  const leadsFromInsights = Math.max(0, Number(insightLeads || 0));
  const actionLeads = resolveMetaLeadActions(actionTotals);
  const leadsFromEvents = actionLeads.forms;
  // The action rows are the auditable Meta event source. `insights.leads` is
  // retained strictly as a fallback for legacy rows not yet reprocessed.
  const leadCount = leadsFromEvents > 0 ? leadsFromEvents : leadsFromInsights;
  const conversations = actionLeads.conversations;
  const breakdown: CampaignResultBreakdown[] = [];

  if (leadCount > 0) breakdown.push({ label: leadsFromEvents > 0 ? "Leads por evento" : "Leads Meta", value: leadCount });
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
import { resolveMetaLeadActions } from "./metaActionMetrics";
