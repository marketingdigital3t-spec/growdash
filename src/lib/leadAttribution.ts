import type { RDDealLite, LeadBucket } from "@/hooks/useRDDealsForPeriod";
import { classifyLead, dedupeRDDeals } from "@/hooks/useRDDealsForPeriod";
import type { InsightRow } from "@/hooks/useInsights";
import type { AccountUtmMapping, UtmField } from "@/hooks/useAccountUtmMapping";
import { DEFAULT_MAPPING } from "@/hooks/useAccountUtmMapping";
import { type FailureReason } from "@/lib/salesAttribution";
import { resolveLeadAttribution, type AttributionMatchMethod, type AttributionGranularity, type AttributionCoverage } from "@/lib/leadAttributionResolver";

export interface LeadCounts {
  total: number;
  won: number;
  lost: number;
  disqualified: number;
  qualified: number;
  open: number;
}

export interface LeadDealAttribution {
  deal: RDDealLite;
  bucket: LeadBucket;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  ad_id: string | null;
  match_method: AttributionMatchMethod;
  granularity: AttributionGranularity | null;
  coverage: AttributionCoverage;
  failure_reason?: FailureReason;
  failure_detail?: string;
}

export interface CampaignLeadAggregate {
  campaign_id: string;
  campaign_name: string;
  counts: LeadCounts;
  deals: LeadDealAttribution[];
}

export interface LeadAttributionResult {
  byCampaign: Map<string, CampaignLeadAggregate>;
  unmatched: LeadDealAttribution[];
  perDeal: LeadDealAttribution[];
  totals: LeadCounts;
}

const emptyCounts = (): LeadCounts => ({ total: 0, won: 0, lost: 0, disqualified: 0, qualified: 0, open: 0 });
const bump = (c: LeadCounts, bucket: LeadBucket) => { c.total += 1; c[bucket] += 1; };

const readDealField = (deal: RDDealLite, field: UtmField): string | null => {
  switch (field) {
    case "utm_source": return deal.utm_source;
    case "utm_medium": return deal.utm_medium;
    case "utm_campaign": return deal.utm_campaign ?? deal.last_touch_utm_campaign ?? deal.first_touch_utm_campaign;
    case "utm_term": return deal.utm_term;
    case "utm_content": return deal.utm_content;
    case "ad_id": return deal.utm_id ?? null;
  }
};

export function attributeLeadsToCampaigns(
  deals: RDDealLite[],
  insights: InsightRow[],
  mappingByAccount?: Map<string, AccountUtmMapping>,
): LeadAttributionResult {
  const byCampaign = new Map<string, CampaignLeadAggregate>();
  const unmatched: LeadDealAttribution[] = [];
  const perDeal: LeadDealAttribution[] = [];
  const totals = emptyCounts();

  const getMapping = (accountId: string | null | undefined): AccountUtmMapping => {
    if (accountId && mappingByAccount?.has(accountId)) return mappingByAccount.get(accountId)!;
    return { id: "", ad_account_id: accountId ?? "", ...DEFAULT_MAPPING };
  };

  const pushCampaign = (campaign_id: string, campaign_name: string, entry: LeadDealAttribution) => {
    let agg = byCampaign.get(campaign_id);
    if (!agg) {
      agg = { campaign_id, campaign_name, counts: emptyCounts(), deals: [] };
      byCampaign.set(campaign_id, agg);
    }
    bump(agg.counts, entry.bucket);
    agg.deals.push(entry);
  };

  for (const deal of dedupeRDDeals(deals)) {
    const bucket = classifyLead(deal);
    bump(totals, bucket);

    const mapping = getMapping(deal.ad_account_id);
    const campaignUtm = readDealField(deal, mapping.campaign_utm);
    const adsetUtm = readDealField(deal, mapping.adset_utm);
    const creativeUtm = readDealField(deal, mapping.creative_utm);
    const resolved = resolveLeadAttribution({
      ...deal,
      utm_campaign: campaignUtm,
      utm_term: adsetUtm,
      utm_content: creativeUtm,
      utm_id: readDealField(deal, "ad_id"),
    }, insights);

    const campaignId = resolved.campaignId;
    if (campaignId) {
      const entry: LeadDealAttribution = {
        deal,
        bucket,
        campaign_id: campaignId,
        campaign_name: resolved.campaignName,
        adset_id: resolved.adsetId,
        ad_id: resolved.adId,
        match_method: resolved.matchMethod,
        granularity: resolved.granularity,
        coverage: resolved.coverage,
      };
      pushCampaign(campaignId, resolved.campaignName ?? campaignId, entry);
      perDeal.push(entry);
      continue;
    }

    const reason: FailureReason = campaignUtm ? "campaign_not_found" : "no_utm_campaign";
    const detail = campaignUtm
      ? `Campanha "${campaignUtm}" não pôde ser confirmada nos insights da conta ${deal.ad_account_id ?? "não informada"}`
      : `Lead sem ${mapping.campaign_utm} e sem ID Meta de campanha persistido`;
    const failed: LeadDealAttribution = {
      deal,
      bucket,
      campaign_id: null,
      campaign_name: resolved.campaignName,
      adset_id: resolved.adsetId,
      ad_id: resolved.adId,
      match_method: resolved.matchMethod,
      granularity: resolved.granularity,
      coverage: resolved.coverage,
      failure_reason: reason,
      failure_detail: detail,
    };
    unmatched.push(failed);
    perDeal.push(failed);
  }

  return { byCampaign, unmatched, perDeal, totals };
}
