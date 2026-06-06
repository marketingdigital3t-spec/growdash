import type { RDDealLite, LeadBucket } from "@/hooks/useRDDealsForPeriod";
import { classifyLead } from "@/hooks/useRDDealsForPeriod";
import type { InsightRow } from "@/hooks/useInsights";
import type { AccountUtmMapping, UtmField } from "@/hooks/useAccountUtmMapping";
import { DEFAULT_MAPPING } from "@/hooks/useAccountUtmMapping";
import { matches, type FailureReason } from "@/lib/salesAttribution";

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
    case "ad_id": return null;
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

  for (const deal of deals) {
    const bucket = classifyLead(deal);
    bump(totals, bucket);

    const mapping = getMapping(deal.ad_account_id);
    const campVal = readDealField(deal, mapping.campaign_utm);
    const adsetVal = readDealField(deal, mapping.adset_utm);
    const creativeVal = readDealField(deal, mapping.creative_utm);

    const sameAccount = deal.ad_account_id
      ? insights.filter((r) => r.ad_account_id === deal.ad_account_id)
      : [];
    const universeAds = sameAccount.length > 0 ? sameAccount : insights;

    let entry: LeadDealAttribution | null = null;

    // L2: trio camp+adset+criativo
    if (campVal && adsetVal && creativeVal) {
      const hit = universeAds.find(
        (r) =>
          matches(r.campaign_name, campVal) &&
          matches(r.adset_name, adsetVal) &&
          matches(r.ad_name, creativeVal),
      );
      if (hit) {
        entry = { deal, bucket, campaign_id: hit.campaign_id ?? null, campaign_name: hit.campaign_name, adset_id: hit.adset_name, ad_id: hit.ad_id };
      }
    }
    // L3: par camp+criativo
    if (!entry && campVal && creativeVal) {
      const hit = universeAds.find(
        (r) => matches(r.campaign_name, campVal) && matches(r.ad_name, creativeVal),
      );
      if (hit) {
        entry = { deal, bucket, campaign_id: hit.campaign_id ?? null, campaign_name: hit.campaign_name, adset_id: null, ad_id: hit.ad_id };
      }
    }
    // L4: só campanha
    if (!entry && campVal) {
      const hit = universeAds.find((r) => matches(r.campaign_name, campVal));
      if (hit?.campaign_id) {
        entry = { deal, bucket, campaign_id: hit.campaign_id, campaign_name: hit.campaign_name, adset_id: null, ad_id: null };
      }
    }

    if (entry && entry.campaign_id) {
      pushCampaign(entry.campaign_id, entry.campaign_name ?? entry.campaign_id, entry);
      perDeal.push(entry);
    } else {
      let reason: FailureReason = "ok";
      let detail = "";
      if (!campVal) {
        reason = "no_utm_campaign";
        detail = `Lead sem ${mapping.campaign_utm}`;
      } else if (sameAccount.length === 0 && deal.ad_account_id) {
        reason = "account_no_insights";
        detail = "Conta do lead não tem insights no período";
      } else {
        reason = "campaign_not_found";
        detail = `Campanha "${campVal}" não casou com nenhuma das ${universeAds.length} campanhas do período`;
      }
      const failed: LeadDealAttribution = { deal, bucket, campaign_id: null, campaign_name: null, adset_id: null, ad_id: null, failure_reason: reason, failure_detail: detail };
      unmatched.push(failed);
      perDeal.push(failed);
    }
  }

  return { byCampaign, unmatched, perDeal, totals };
}
