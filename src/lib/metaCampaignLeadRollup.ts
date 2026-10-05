import { resolveMetaLeadActions } from "@/lib/metaActionMetrics";
import { normalizeMetaAttributionWindow } from "@/lib/metaInsightFacts";

export interface MetaCampaignLeadInsight {
  ad_account_id: string;
  ad_id: string;
  adset_id?: string | null;
  campaign_id: string | null;
  campaign_name?: string | null;
  date: string;
  attribution_window?: string | null;
  spend?: number | string | null;
  impressions?: number | string | null;
  reach?: number | string | null;
  clicks?: number | string | null;
}

export interface MetaCampaignLeadAction {
  ad_account_id: string;
  ad_id: string;
  date: string;
  action_type: string;
  value: number | string | null;
  attribution_window?: string | null;
}

export interface MetaLeadTotals {
  forms: number;
  site: number;
  conversations: number;
  total: number;
}

export interface MetaCampaignDeliveryTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  insightRows: number;
  campaignName: string | null;
  accountIds: string[];
}

/**
 * Rebuilds campaign lead totals from canonical action facts joined to daily
 * Insights scope. It deliberately does not require campaign/ad catalog rows.
 */
export function aggregateMetaCampaignLeadFacts(
  insightRows: MetaCampaignLeadInsight[],
  actionRows: MetaCampaignLeadAction[],
  attributionByAccount: Record<string, string>,
  siteActionByAccount: Record<string, string | undefined>,
  siteEligibleAdScopes?: ReadonlySet<string>,
  conversationEligibleAdScopes?: ReadonlySet<string>,
) {
  const empty = (): MetaLeadTotals => ({ forms: 0, site: 0, conversations: 0, total: 0 });
  const dailyByScope = new Map<string, {
    accountId: string;
    adId: string;
    campaignId: string | null;
    campaignName: string | null;
    date: string;
    attribution: string;
    hasExplicitAttribution: boolean;
    actions: Record<string, number>;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
  }>();

  for (const insight of insightRows) {
    const expectedAttribution = normalizeMetaAttributionWindow(attributionByAccount[insight.ad_account_id] || "account_default");
    if (normalizeMetaAttributionWindow(insight.attribution_window) !== expectedAttribution) continue;
    const scope = `${insight.ad_account_id}|${insight.ad_id}|${insight.date}`;
    const previous = dailyByScope.get(scope);
    if (previous && previous.attribution !== expectedAttribution) continue;
    const incoming = {
      accountId: insight.ad_account_id,
      adId: insight.ad_id,
      campaignId: insight.campaign_id,
      campaignName: insight.campaign_name || previous?.campaignName || null,
      date: insight.date,
      attribution: expectedAttribution,
      hasExplicitAttribution: insight.attribution_window != null,
      actions: previous?.actions || {},
      spend: Math.max(0, Number(insight.spend || 0)),
      impressions: Math.max(0, Number(insight.impressions || 0)),
      reach: Math.max(0, Number(insight.reach || 0)),
      clicks: Math.max(0, Number(insight.clicks || 0)),
    };
    if (!previous || (!previous.hasExplicitAttribution && incoming.hasExplicitAttribution)) {
      dailyByScope.set(scope, incoming);
    }
  }

  const uniqueActions = new Map<string, MetaCampaignLeadAction>();
  for (const action of actionRows) {
    const scope = `${action.ad_account_id}|${action.ad_id}|${action.date}`;
    const daily = dailyByScope.get(scope);
    if (!daily || normalizeMetaAttributionWindow(action.attribution_window) !== daily.attribution) continue;
    const factKey = `${scope}|${action.action_type}|${daily.attribution}`;
    const previous = uniqueActions.get(factKey);
    if (!previous || (!previous.attribution_window && action.attribution_window)) uniqueActions.set(factKey, action);
  }

  for (const [factKey, action] of uniqueActions) {
    const scope = factKey.split("|").slice(0, 3).join("|");
    const daily = dailyByScope.get(scope);
    if (!daily) continue;
    daily.actions[action.action_type] = (daily.actions[action.action_type] || 0) + Math.max(0, Number(action.value || 0));
  }

  const totals = empty();
  const byCampaign: Record<string, MetaLeadTotals> = {};
  const dailyByCampaign: Record<string, Record<string, MetaLeadTotals>> = {};
  const deliveryByCampaign: Record<string, MetaCampaignDeliveryTotals> = {};
  for (const daily of dailyByScope.values()) {
    const scopeKey = `${daily.accountId}|${daily.adId}`;
    const siteDestinationConfirmed = Boolean(siteEligibleAdScopes?.has(scopeKey));
    const conversationDestinationConfirmed = Boolean(conversationEligibleAdScopes?.has(scopeKey));
    const resolved = resolveMetaLeadActions(daily.actions, siteActionByAccount[daily.accountId], siteDestinationConfirmed, conversationDestinationConfirmed);
    const campaignKey = daily.campaignId || `__unmapped__:${daily.accountId}`;
    const current = byCampaign[campaignKey] || empty();
    current.forms += resolved.forms;
    current.site += resolved.site;
    current.conversations += resolved.conversations;
    current.total = current.forms + current.site + current.conversations;
    byCampaign[campaignKey] = current;
    const dateTotals = dailyByCampaign[campaignKey]?.[daily.date] || empty();
    dateTotals.forms += resolved.forms;
    dateTotals.site += resolved.site;
    dateTotals.conversations += resolved.conversations;
    dateTotals.total = dateTotals.forms + dateTotals.site + dateTotals.conversations;
    dailyByCampaign[campaignKey] = { ...(dailyByCampaign[campaignKey] || {}), [daily.date]: dateTotals };
    totals.forms += resolved.forms;
    totals.site += resolved.site;
    totals.conversations += resolved.conversations;
    const delivery = deliveryByCampaign[campaignKey] || { spend: 0, impressions: 0, reach: 0, clicks: 0, insightRows: 0, campaignName: daily.campaignName, accountIds: [] };
    delivery.spend += daily.spend;
    delivery.impressions += daily.impressions;
    delivery.reach += daily.reach;
    delivery.clicks += daily.clicks;
    delivery.insightRows += 1;
    delivery.campaignName ||= daily.campaignName;
    if (!delivery.accountIds.includes(daily.accountId)) delivery.accountIds.push(daily.accountId);
    deliveryByCampaign[campaignKey] = delivery;
  }
  totals.total = totals.forms + totals.site + totals.conversations;
  return { totals, byCampaign, dailyByCampaign, deliveryByCampaign, scopedInsightRows: dailyByScope.size };
}

/** Adds read-only rows for Insights campaigns whose catalog record is missing. */
export function addInsightOnlyCampaignRows<T extends { id: string | number }>(
  catalogRows: T[],
  deliveryByCampaign: Record<string, MetaCampaignDeliveryTotals>,
) {
  const knownCampaignIds = new Set(catalogRows.map((campaign) => String(campaign.id)));
  const insightOnlyRows = Object.entries(deliveryByCampaign)
    .filter(([campaignId, delivery]) => !knownCampaignIds.has(campaignId) && delivery.accountIds.length === 1)
    .map(([campaignId, delivery]) => ({
      id: campaignId,
      name: campaignId.startsWith("__unmapped__:")
        ? "Campanha não identificada (Insights sem campaign_id)"
        : delivery.campaignName || `Campanha ${campaignId}`,
      ad_account_id: delivery.accountIds[0],
      status: null,
      objective: null,
      daily_budget: null,
      lifetime_budget: null,
      budget: null,
      adsets: [],
      spend: delivery.spend,
      impressions: delivery.impressions,
      reach: delivery.reach,
      clicks: delivery.clicks,
      linkClicks: 0,
      uniqueLinkClicks: 0,
      linkCpc: 0,
      uniqueLinkCtr: 0,
      frequency: delivery.reach > 0 ? delivery.impressions / delivery.reach : 0,
      leads: 0,
      formLeads: 0,
      siteLeads: 0,
      conversations: 0,
      legacyLeads: 0,
      hasCanonicalLeadParts: true,
      salesCount: 0,
      revenue: 0,
      profit: -delivery.spend,
      roi: -100,
      roas: 0,
      cpa: 0,
      cpl: 0,
      ctr: delivery.impressions > 0 ? delivery.clicks / delivery.impressions * 100 : 0,
      cpc: delivery.clicks > 0 ? delivery.spend / delivery.clicks : 0,
      cpm: delivery.impressions > 0 ? delivery.spend / delivery.impressions * 1000 : 0,
      conversionRate: 0,
      catalogMissing: true as const,
      campaignUnmapped: campaignId.startsWith("__unmapped__:"),
    }));

  return [...catalogRows, ...insightOnlyRows];
}
