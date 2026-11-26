import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import { saoPauloDayBounds } from "@/lib/canonicalMetrics";
import { getRDDealAmount } from "@/lib/rdDealAmount";

export type DateRangeFilter = {
  start?: string | null;
  end?: string | null;
};

export type CRMAdvancedFilterState = {
  createdAt?: DateRangeFilter | null;
  closedAt?: DateRangeFilter | null;
  lastContactAt?: DateRangeFilter | null;
  expectedCloseAt?: DateRangeFilter | null;
  minValue?: number | null;
  maxValue?: number | null;
  campaign?: string | null;
  source?: string | null;
  product?: string | null;
  owner?: string | null;
};

import { businessDateKey } from "@/lib/businessDate";

function isDateInRange(isoString: string | null | undefined, range: DateRangeFilter | null | undefined): boolean {
  if (!range || (!range.start && !range.end)) return true;
  if (!isoString) return false;

  const dateObj = new Date(isoString);
  if (!Number.isFinite(dateObj.getTime())) return false;

  const dealDay = businessDateKey(dateObj);
  const startDay = range.start ? (range.start.length === 10 ? range.start : businessDateKey(new Date(range.start))) : null;
  const endDay = range.end ? (range.end.length === 10 ? range.end : businessDateKey(new Date(range.end))) : null;

  if (startDay && dealDay < startDay) return false;
  if (endDay && dealDay > endDay) return false;
  return true;
}

export function filterDealsByAdvancedCriteria(
  deals: RDDealLite[],
  filters: CRMAdvancedFilterState,
): RDDealLite[] {
  return deals.filter((deal) => {
    // 1. Data de criação
    if (filters.createdAt && !isDateInRange(deal.lead_created_at, filters.createdAt)) {
      return false;
    }

    // 2. Data de fechamento
    if (filters.closedAt && !isDateInRange(deal.closed_at, filters.closedAt)) {
      return false;
    }

    // 3. Data de último contato (stage_updated_at ou updated_at)
    if (filters.lastContactAt) {
      const contactDate = deal.stage_updated_at || deal.updated_at;
      if (!isDateInRange(contactDate, filters.lastContactAt)) {
        return false;
      }
    }

    // 4. Faixa de valor
    const amount = getRDDealAmount(deal);
    if (typeof filters.minValue === "number" && Number.isFinite(filters.minValue)) {
      if (amount < filters.minValue) return false;
    }
    if (typeof filters.maxValue === "number" && Number.isFinite(filters.maxValue)) {
      if (amount > filters.maxValue) return false;
    }

    // 5. Campanha
    if (filters.campaign && filters.campaign !== "all") {
      const dealCampaign = deal.campaign || deal.utm_campaign || deal.meta_campaign_name || "";
      if (dealCampaign.toLowerCase() !== filters.campaign.toLowerCase()) {
        return false;
      }
    }

    // 6. Fonte / Origem
    if (filters.source && filters.source !== "all") {
      const dealSource = deal.source || deal.utm_source || deal.meta_platform || "";
      if (dealSource.toLowerCase() !== filters.source.toLowerCase()) {
        return false;
      }
    }

    // 7. Produto ou serviço
    if (filters.product && filters.product !== "all") {
      const dealProduct = deal.rd_product_name || "";
      if (dealProduct.toLowerCase() !== filters.product.toLowerCase()) {
        return false;
      }
    }

    // 8. Responsável
    if (filters.owner && filters.owner !== "all") {
      if (deal.deal_owner_name !== filters.owner) {
        return false;
      }
    }

    return true;
  });
}

export function countActiveAdvancedFilters(filters: CRMAdvancedFilterState): number {
  let count = 0;
  if (filters.createdAt?.start || filters.createdAt?.end) count++;
  if (filters.closedAt?.start || filters.closedAt?.end) count++;
  if (filters.lastContactAt?.start || filters.lastContactAt?.end) count++;
  if (typeof filters.minValue === "number" || typeof filters.maxValue === "number") count++;
  if (filters.campaign && filters.campaign !== "all") count++;
  if (filters.source && filters.source !== "all") count++;
  if (filters.product && filters.product !== "all") count++;
  if (filters.owner && filters.owner !== "all") count++;
  return count;
}
