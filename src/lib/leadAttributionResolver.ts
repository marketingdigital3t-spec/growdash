import type { InsightRow } from "@/hooks/useInsights";

export type LeadAttributionMethod = "meta_id" | "utm" | "touch" | "unmatched";
export type LeadAttributionStatus = "attributed" | "partial" | "unavailable";

export interface LeadAttribution {
  platform: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  method: LeadAttributionMethod;
  status: LeadAttributionStatus;
}

type AttributionDeal = {
  ad_account_id?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  utm_id?: string | null;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  meta_ad_id?: string | null;
  meta_attribution_method?: string | null;
};

const text = (value: unknown) => String(value ?? "").trim();
const same = (a: unknown, b: unknown) => text(a).toLocaleLowerCase("pt-BR") === text(b).toLocaleLowerCase("pt-BR") && text(a) !== "";

export function resolveLeadAttribution(deal: AttributionDeal, insights: InsightRow[]): LeadAttribution {
  const rows = insights.filter((row) => !deal.ad_account_id || row.ad_account_id === deal.ad_account_id);
  const adId = text(deal.meta_ad_id) || text(deal.utm_id) || null;
  const campaignId = text(deal.meta_campaign_id) || null;
  const adsetId = text(deal.meta_adset_id) || null;
  const byAd = adId ? rows.find((row) => row.ad_id === adId) : undefined;
  const byIds = campaignId || adsetId || adId
    ? rows.find((row) =>
      (!campaignId || row.campaign_id === campaignId) &&
      (!adsetId || row.adset_id === adsetId) &&
      (!adId || row.ad_id === adId))
    : undefined;
  const campaign = text(deal.utm_campaign);
  const adset = text(deal.utm_term);
  const creative = text(deal.utm_content);
  const byNames = campaign && adset && creative
    ? rows.find((row) => same(row.campaign_name, campaign) && same(row.adset_name, adset) && same(row.ad_name, creative))
    : undefined;
  const byCampaignCreative = campaign && creative
    ? rows.find((row) => same(row.campaign_name, campaign) && same(row.ad_name, creative))
    : undefined;
  const byCampaign = campaign
    ? rows.find((row) => same(row.campaign_name, campaign) || same(row.campaign_id, campaign))
    : undefined;
  const hit = byAd || byIds || byNames || byCampaignCreative || byCampaign;
  const hasAny = Boolean(adId || campaign || adset || creative || campaignId || adsetId);
  if (!hit) {
    return {
      platform: text(deal.utm_source) || (hasAny ? "meta" : null),
      campaignId,
      campaignName: campaign || null,
      adsetId,
      adsetName: adset || null,
      adId,
      adName: creative || null,
      method: hasAny ? "unmatched" : "unmatched",
      status: hasAny ? "partial" : "unavailable",
    };
  }
  return {
    platform: text(deal.utm_source) || "meta",
    campaignId: hit.campaign_id ?? campaignId,
    campaignName: hit.campaign_name || campaign || null,
    adsetId: hit.adset_id ?? adsetId,
    adsetName: hit.adset_name || adset || null,
    adId: hit.ad_id || adId,
    adName: hit.ad_name || creative || null,
    method: byAd || byIds ? "meta_id" : "utm",
    status: "attributed",
  };
}
