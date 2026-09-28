import { resolveMetaActionMetrics } from "@/lib/metaActionMetrics";
import { resolveMetaLeadActions } from "@/lib/metaActionMetrics";

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
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  formLeads: number;
  siteLeads: number;
  conversations: number;
  purchases: number;
  purchaseValue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  roas: number;
  source: "meta";
  syncedAt: string | null;
  freshnessSeconds: number | null;
  status: "fresh" | "syncing" | "stale" | "error";
  coveredAccounts: string[];
  rowCount: number;
  errors: string[];
}

type InsightRow = {
  ad_id?: string | null;
  ad_account_id?: string | null;
  campaign_id?: string | null;
  spend?: number | null;
  impressions?: number | null;
  reach?: number | null;
  clicks?: number | null;
};

type ActionData = {
  metaLeadActions?: { forms: number; site: number; conversations: number; total: number };
  totalsByAd?: Record<string, Record<string, number>>;
  valueTotalsByAd?: Record<string, Record<string, number>>;
};

export function aggregateMetaTrafficMetrics(
  rows: InsightRow[],
  actions: ActionData | undefined,
  syncedAt: string | null,
  errors: string[] = [],
  now = Date.now(),
): MetaTrafficMetrics {
  const totals = rows.reduce((acc, row) => ({
    spend: acc.spend + Number(row.spend || 0),
    impressions: acc.impressions + Number(row.impressions || 0),
    reach: acc.reach + Number(row.reach || 0),
    clicks: acc.clicks + Number(row.clicks || 0),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0 });

  let purchases = 0;
  let purchaseValue = 0;
  for (const row of rows) {
    const adId = String(row.ad_id || "");
    const actionTotals = actions?.totalsByAd?.[adId];
    const valueTotals = actions?.valueTotalsByAd?.[adId];
    const resolved = resolveMetaActionMetrics(actionTotals, valueTotals);
    purchases += resolved.purchases;
    purchaseValue += resolved.purchaseValue;
  }

  const leadTotals = actions?.metaLeadActions || { forms: 0, site: 0, conversations: 0, total: 0 };
  const leads = leadTotals.total;
  const freshnessSeconds = syncedAt ? Math.max(0, Math.floor((now - new Date(syncedAt).getTime()) / 1000)) : null;
  const status = errors.length ? "error" : freshnessSeconds === null || freshnessSeconds > 300 ? "stale" : "fresh";
  const coveredAccounts = Array.from(new Set(rows.map((row) => row.ad_account_id).filter(Boolean) as string[]));

  return {
    ...totals,
    leads,
    formLeads: leadTotals.forms,
    siteLeads: leadTotals.site,
    conversations: leadTotals.conversations,
    purchases,
    purchaseValue,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : 0,
    cpl: leads > 0 ? totals.spend / leads : 0,
    roas: totals.spend > 0 ? purchaseValue / totals.spend : 0,
    source: "meta",
    syncedAt,
    freshnessSeconds,
    status,
    coveredAccounts,
    rowCount: rows.length,
    errors,
  };
}

export function resolveMetaTrafficLeadActions(actionTotals?: Record<string, number>, siteAction?: string | null) {
  return resolveMetaLeadActions(actionTotals, siteAction);
}
