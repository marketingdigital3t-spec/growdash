import type { InsightRow } from "@/hooks/useInsights";
import type { RDDeal } from "@/hooks/useRDDeals";
import { dedupeRDDeals } from "@/hooks/useRDDealsForPeriod";
import { resolveLeadAttribution, type AttributionMatchMethod, type AttributionGranularity, type AttributionCoverage } from "@/lib/leadAttributionResolver";

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
  matchMethod: AttributionMatchMethod;
  granularity: AttributionGranularity | null;
  coverage: AttributionCoverage;
}

export function attributeRDOpportunity(deal: RDDeal, insights: InsightRow[]): OpportunityAttributionRow {
  const resolved = resolveLeadAttribution(deal, insights);
  const status: OpportunityAttributionStatus = !resolved.campaignId ? "unmatched"
    : resolved.granularity === "anuncio" ? "ad"
      : resolved.granularity === "conjunto" ? "adset" : "campaign";
  return {
    deal,
    campaignId: resolved.campaignId,
    campaignName: resolved.campaignName || "Não atribuída",
    adsetId: resolved.adsetId,
    adsetName: resolved.adsetName || "Conjunto não identificado",
    adId: resolved.adId,
    adName: resolved.adName || "Criativo não identificado",
    status,
    matchMethod: resolved.matchMethod,
    granularity: resolved.granularity,
    coverage: resolved.coverage,
  };
}

export function attributeRDOpportunities(deals: RDDeal[], insights: InsightRow[]) {
  return dedupeRDDeals(deals.filter((deal) => deal.stage_bucket === "opportunity"))
    .map((deal) => attributeRDOpportunity(deal, insights));
}
