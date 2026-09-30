import { resolveMetaActionMetrics, resolveMetaCampaignResult, resolveMetaLeadActions } from "@/lib/metaActionMetrics";

export interface MetaTrafficScope {
  adAccountIds: string[];
  campaignIds?: string[];
  startDate: string;
  endDate: string;
  attributionWindow?: string;
  timezone?: string;
}

export interface MetaTrafficMetrics {
  spend: number;
  dailySpend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  leads: number;
  totalLeads: number;
  /** Sum of the official Ads Manager Result value by campaign objective. */
  results: number;
  resultValue: number;
  formLeads: number;
  siteLeads: number;
  conversations: number;
  checkout: number;
  purchases: number;
  purchaseValue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  roas: number;
  resultBreakdown: Array<{
    accountId: string;
    campaignId: string;
    campaignName: string;
    adId?: string;
    objective: string | null;
    resultType: string;
    value: number;
  }>;
  breakdowns: MetaBreakdowns;
  attributionWindow: string | null;
  timezone: string | null;
  source: "meta";
  syncedAt: string | null;
  freshnessSeconds: number | null;
  status: "fresh" | "syncing" | "stale" | "error";
  coveredAccounts: string[];
  rowCount: number;
  errors: string[];
  leadBreakdownByAccount: Record<string, { formLeads: number; siteLeads: number; conversations: number; totalLeads: number }>;
  leadBreakdownByAd: Record<string, { formLeads: number; siteLeads: number; conversations: number; totalLeads: number }>;
}

export interface BreakdownSegment {
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpm: number;
}

export interface MetaBreakdowns {
  age: BreakdownSegment[];
  gender: BreakdownSegment[];
  region: BreakdownSegment[];
  country: BreakdownSegment[];
  platform: BreakdownSegment[];
  placement: BreakdownSegment[];
  device: BreakdownSegment[];
}

type InsightRow = {
  ad_id?: string | null;
  ad_account_id?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  campaign_objective?: string | null;
  optimization_goal?: string | null;
  date?: string | null;
  spend?: number | null;
  impressions?: number | null;
  reach?: number | null;
  clicks?: number | null;
};

type ActionData = {
  metaLeadActions?: { forms: number; site: number; conversations: number; total: number };
  totalsByAd?: Record<string, Record<string, number>>;
  valueTotalsByAd?: Record<string, Record<string, number>>;
  dailyMetaLeadByAccount?: Record<string, Record<string, { forms: number; site: number; conversations: number; total: number }> >;
  breakdowns?: MetaBreakdowns;
};

const EMPTY_BREAKDOWNS: MetaBreakdowns = {
  age: [], gender: [], region: [], country: [], platform: [], placement: [], device: [],
};

export function aggregateMetaTrafficMetrics(
  rows: InsightRow[],
  actions: ActionData | undefined,
  syncedAt: string | null,
  errors: string[] = [],
  now = Date.now(),
  context?: { attributionWindow?: string | null; timezone?: string | null },
): MetaTrafficMetrics {
  const totals = rows.reduce((acc, row) => ({
    spend: acc.spend + Number(row.spend || 0),
    impressions: acc.impressions + Number(row.impressions || 0),
    reach: acc.reach + Number(row.reach || 0),
    clicks: acc.clicks + Number(row.clicks || 0),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0 });

  let purchases = 0;
  let purchaseValue = 0;
  let checkout = 0;
  const seenActionAds = new Set<string>();
  for (const row of rows) {
    const adId = String(row.ad_id || "");
    if (!adId || seenActionAds.has(adId)) continue;
    seenActionAds.add(adId);
    const actionTotals = actions?.totalsByAd?.[adId];
    const valueTotals = actions?.valueTotalsByAd?.[adId];
    const resolved = resolveMetaActionMetrics(actionTotals, valueTotals);
    purchases += resolved.purchases;
    purchaseValue += resolved.purchaseValue;
    checkout += resolved.checkouts;
  }

  const leadTotals = actions?.metaLeadActions || { forms: 0, site: 0, conversations: 0, total: 0 };
  const leads = leadTotals.total;
  const leadBreakdownByAccount: MetaTrafficMetrics["leadBreakdownByAccount"] = {};
  for (const [accountId, daily] of Object.entries(actions?.dailyMetaLeadByAccount || {})) {
    const totals = Object.values(daily).reduce((sum, value) => ({
      formLeads: sum.formLeads + Number(value.forms || 0),
      siteLeads: sum.siteLeads + Number(value.site || 0),
      conversations: sum.conversations + Number(value.conversations || 0),
      totalLeads: sum.totalLeads + Number(value.total || 0),
    }), { formLeads: 0, siteLeads: 0, conversations: 0, totalLeads: 0 });
    leadBreakdownByAccount[accountId] = totals;
  }
  const leadBreakdownByAd: MetaTrafficMetrics["leadBreakdownByAd"] = {};
  for (const [adId, actionTotals] of Object.entries(actions?.totalsByAd || {})) {
    const resolved = resolveMetaLeadActions(actionTotals);
    leadBreakdownByAd[adId] = { formLeads: resolved.forms, siteLeads: resolved.site, conversations: resolved.conversations, totalLeads: resolved.total };
  }
  const seenResultAds = new Set<string>();
  const resultBreakdownByCampaign = new Map<string, { accountId: string; campaignId: string; campaignName: string; adId?: string; objective: string | null; resultType: string; value: number }>();
  rows.forEach((row) => {
    const adKey = String(row.ad_id || "");
    if (!adKey || seenResultAds.has(adKey)) return;
    seenResultAds.add(adKey);
    const actionTotals = actions?.totalsByAd?.[String(row.ad_id || "")] || {};
    const result = resolveMetaCampaignResult(row.campaign_objective, row.optimization_goal, actionTotals);
    const resultType = result.resultType;
    const value = resultType === "reach" ? Number(row.reach || 0) : result.value;
    if (value <= 0) return;
    const key = `${row.ad_account_id || ""}|${row.campaign_id || ""}|${resultType}`;
    const previous = resultBreakdownByCampaign.get(key);
    resultBreakdownByCampaign.set(key, previous ? { ...previous, value: previous.value + value } : {
      accountId: String(row.ad_account_id || ""),
      campaignId: String(row.campaign_id || ""),
      campaignName: String(row.campaign_name || ""),
      adId: adKey,
      objective: row.campaign_objective || null,
      resultType,
      value,
    });
  });
  const resultBreakdown = Array.from(resultBreakdownByCampaign.values());
  const results = resultBreakdown.reduce((sum, item) => sum + item.value, 0);
  const freshnessSeconds = syncedAt ? Math.max(0, Math.floor((now - new Date(syncedAt).getTime()) / 1000)) : null;
  const status = errors.length ? "error" : freshnessSeconds === null || freshnessSeconds > 300 ? "stale" : "fresh";
  const coveredAccounts = Array.from(new Set(rows.map((row) => row.ad_account_id).filter(Boolean) as string[]));
  const coveredDates = new Set(rows.map((row) => row.date).filter(Boolean) as string[]).size;

  return {
    ...totals,
    dailySpend: coveredDates > 0 ? totals.spend / coveredDates : 0,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    leads,
    totalLeads: leads,
    results,
    resultValue: results,
    formLeads: leadTotals.forms,
    siteLeads: leadTotals.site,
    conversations: leadTotals.conversations,
    checkout,
    purchases,
    purchaseValue,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : 0,
    cpl: leads > 0 ? totals.spend / leads : 0,
    roas: totals.spend > 0 ? purchaseValue / totals.spend : 0,
    resultBreakdown,
    breakdowns: actions?.breakdowns || EMPTY_BREAKDOWNS,
    attributionWindow: context?.attributionWindow || null,
    timezone: context?.timezone || null,
    source: "meta",
    syncedAt,
    freshnessSeconds,
    status,
    coveredAccounts,
    rowCount: rows.length,
    errors,
    leadBreakdownByAccount,
    leadBreakdownByAd,
  };
}

export function resolveMetaTrafficLeadActions(actionTotals?: Record<string, number>, siteAction?: string | null) {
  return resolveMetaLeadActions(actionTotals, siteAction);
}
