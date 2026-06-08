import { endOfDay, isWithinInterval, startOfDay } from "date-fns";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateInsideRange(value: string | null | undefined, startDate: Date, endDate: Date) {
  const date = asDate(value);
  if (!date) return false;
  return isWithinInterval(date, { start: startOfDay(startDate), end: endOfDay(endDate) });
}

export function getRDDealSaleDate(deal: RDDealLite) {
  return deal.closed_at || deal.stage_updated_at || deal.lead_created_at;
}

export function getRDLeadsInRange(deals: RDDealLite[], startDate: Date, endDate: Date) {
  return deals.filter((deal) => isDateInsideRange(deal.lead_created_at, startDate, endDate));
}

export function getRDWonDealsInRange(deals: RDDealLite[], startDate: Date, endDate: Date) {
  return deals.filter((deal) => {
    const isWon = deal.win === true || deal.stage_bucket === "client";
    return isWon && isDateInsideRange(getRDDealSaleDate(deal), startDate, endDate);
  });
}

export function sumRDRevenue(deals: RDDealLite[]) {
  return deals.reduce((sum, deal) => {
    const raw = deal.amount_total as unknown;
    if (raw == null) return sum;
    if (typeof raw === "number") return sum + (Number.isFinite(raw) ? raw : 0);
    // Robust parser: handles "R$ 1.234,56", "1234.56", "1,234.56"
    const cleaned = String(raw).replace(/[^\d.,\-]/g, "");
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");
    let normalized = cleaned;
    if (hasComma && hasDot) {
      // assume dots are thousand separators, comma decimal (BR)
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      normalized = cleaned.replace(",", ".");
    }
    const num = Number(normalized);
    return sum + (Number.isFinite(num) ? num : 0);
  }, 0);
}

function normalizeMarketingKey(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function rdDealMatchesCampaign(deal: RDDealLite, campaignId?: string | null, campaignName?: string | null) {
  const targets = [campaignId, campaignName].map(normalizeMarketingKey).filter(Boolean);
  if (targets.length === 0) return false;

  const candidates = [
    deal.rd_campaign_name,
    deal.utm_campaign,
    deal.first_touch_utm_campaign,
    deal.last_touch_utm_campaign,
  ].map(normalizeMarketingKey).filter(Boolean);

  return candidates.some((candidate) =>
    targets.some((target) => candidate === target || candidate.includes(target) || target.includes(candidate)),
  );
}

export function countRDLeadsForCampaign(deals: RDDealLite[], campaignId?: string | null, campaignName?: string | null) {
  return deals.filter((deal) => rdDealMatchesCampaign(deal, campaignId, campaignName)).length;
}
