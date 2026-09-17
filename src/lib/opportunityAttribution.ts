import type { InsightRow } from "@/hooks/useInsights";
import type { RDDeal } from "@/hooks/useRDDeals";
import { matches } from "@/lib/salesAttribution";

export type OpportunityAttributionStatus = "ad" | "adset" | "campaign" | "unmatched";

export interface OpportunityAttributionRow {
  deal: RDDeal;
  campaignId: string | null;
  campaignName: string;
  adsetId: string | null;
  adsetName: string;
  adId: string | null;
  adName: string;
  status: OpportunityAttributionStatus;
}

const value = (input: unknown) => String(input ?? "").trim();
const exact = (a: unknown, b: unknown) => value(a).toLocaleLowerCase("pt-BR") === value(b).toLocaleLowerCase("pt-BR") && value(a) !== "";

export function attributeRDOpportunity(deal: RDDeal, insights: InsightRow[]): OpportunityAttributionRow {
  const universe = insights.filter((row) => !deal.ad_account_id || row.ad_account_id === deal.ad_account_id);
  const campaign = value(deal.utm_campaign);
  const adset = value(deal.utm_term);
  const creative = value(deal.utm_content);
  const adId = value(deal.utm_id);
  const byAdId = adId ? universe.find((row) => row.ad_id === adId) : undefined;
  const byTriple = campaign && adset && creative
    ? universe.find((row) => exact(row.campaign_name, campaign) && exact(row.adset_name, adset) && exact(row.ad_name, creative))
    : undefined;
  const byCreative = campaign && creative
    ? universe.find((row) => exact(row.campaign_name, campaign) && matches(row.ad_name, creative))
    : undefined;
  const byAdset = campaign && adset
    ? universe.find((row) => exact(row.campaign_name, campaign) && matches(row.adset_name, adset))
    : undefined;
  const byCampaign = campaign
    ? universe.find((row) => exact(row.campaign_name, campaign) || exact(row.campaign_id, campaign))
    : undefined;
  const hit = byAdId || byTriple || byCreative || byAdset || byCampaign;
  if (!hit) return { deal, campaignId: null, campaignName: campaign || "Não atribuída", adsetId: null, adsetName: "Conjunto não identificado", adId: null, adName: "Criativo não identificado", status: "unmatched" };
  const status: OpportunityAttributionStatus = byAdId || byTriple || byCreative ? "ad" : byAdset ? "adset" : "campaign";
  return { deal, campaignId: hit.campaign_id ?? null, campaignName: hit.campaign_name || campaign || "Não atribuída", adsetId: status === "campaign" ? null : hit.adset_name || null, adsetName: status === "campaign" ? "Conjunto não identificado" : hit.adset_name || adset || "Conjunto não identificado", adId: status === "ad" ? hit.ad_id : null, adName: status === "ad" ? hit.ad_name || creative || "Criativo não identificado" : "Criativo não identificado", status };
}

export function attributeRDOpportunities(deals: RDDeal[], insights: InsightRow[]) {
  return deals.filter((deal) => deal.stage_bucket === "opportunity").map((deal) => attributeRDOpportunity(deal, insights));
}
