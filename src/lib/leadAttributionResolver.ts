import type { InsightRow } from "@/hooks/useInsights";
import { mergeManualTracking, type ManualTracking } from "@/lib/leadTracking";

export type LeadAttributionMethod = "meta_id" | "utm" | "touch" | "manual" | "unmatched";
export type LeadAttributionStatus = "attributed" | "partial" | "unavailable";

export interface LeadAttribution {
  source: string | null;
  platform: string | null;
  placement: string | null;
  formId: string | null;
  formName: string | null;
  isOrganic: boolean | null;
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
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  meta_ad_name?: string | null;
  meta_form_id?: string | null;
  meta_form_name?: string | null;
  meta_platform?: string | null;
  meta_placement?: string | null;
  meta_is_organic?: boolean | null;
  meta_attribution_method?: string | null;
  manual_tracking?: ManualTracking | null;
};

const text = (value: unknown) => {
  const valueText = String(value ?? "").trim();
  if (!valueText || /^\{\{[^{}]+\}\}$/.test(valueText) || /^\$\{[^{}]+\}$/.test(valueText)) return "";
  return valueText;
};
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
  const source = text(deal.utm_source) || null;
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
  const manual = deal.manual_tracking && typeof deal.manual_tracking === "object" ? deal.manual_tracking : null;
  const hasManual = !!manual && Object.keys(manual).length > 0;
  const applyManual = (automatic: LeadAttribution): LeadAttribution => {
    if (!hasManual) return automatic;
    const draft = mergeManualTracking({
      source: automatic.source,
      campaign: automatic.campaignName,
      adset: automatic.adsetName,
      creative: automatic.adName,
      form: automatic.formName || automatic.formId,
      platform: automatic.platform,
      placement: automatic.placement,
      isOrganic: automatic.isOrganic,
    }, manual);
    return {
      ...automatic,
      source: draft.source == null ? null : String(draft.source),
      campaignName: draft.campaign == null ? null : String(draft.campaign),
      adsetName: draft.adset == null ? null : String(draft.adset),
      adName: draft.creative == null ? null : String(draft.creative),
      formName: draft.form == null ? null : String(draft.form),
      formId: manual.form === undefined ? automatic.formId : null,
      platform: draft.platform == null ? null : String(draft.platform),
      placement: draft.placement == null ? null : String(draft.placement),
      isOrganic: typeof draft.isOrganic === "boolean" ? draft.isOrganic : null,
      method: "manual",
      status: "attributed",
    };
  };
  if (!hit) {
    return applyManual({
      source,
      platform: text(deal.meta_platform) || null,
      placement: text(deal.meta_placement) || null,
      formId: text(deal.meta_form_id) || null,
      formName: text(deal.meta_form_name) || null,
      isOrganic: typeof deal.meta_is_organic === "boolean" ? deal.meta_is_organic : null,
      campaignId,
      campaignName: text(deal.meta_campaign_name) || campaign || null,
      adsetId,
      adsetName: text(deal.meta_adset_name) || adset || null,
      adId,
      adName: text(deal.meta_ad_name) || creative || null,
      method: hasAny ? "unmatched" : "unmatched",
      status: hasAny ? "partial" : "unavailable",
    });
  }
  return applyManual({
    source,
    platform: text(deal.meta_platform) || null,
    placement: text(deal.meta_placement) || null,
    formId: text(deal.meta_form_id) || null,
    formName: text(deal.meta_form_name) || null,
    isOrganic: typeof deal.meta_is_organic === "boolean" ? deal.meta_is_organic : null,
    campaignId: hit.campaign_id ?? campaignId,
    campaignName: text(deal.meta_campaign_name) || hit.campaign_name || campaign || null,
    adsetId: hit.adset_id ?? adsetId,
    adsetName: text(deal.meta_adset_name) || hit.adset_name || adset || null,
    adId: hit.ad_id || adId,
    adName: text(deal.meta_ad_name) || hit.ad_name || creative || null,
    method: byAd || byIds ? "meta_id" : "utm",
    status: "attributed",
  });
}
