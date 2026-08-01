import type { Sale } from "@/hooks/useSales";

export interface CampaignReference {
  id: string;
  name?: string | null;
  ad_account_id?: string | null;
}

/** Receita realizada: pendente e cancelada nunca entram no faturamento. */
export function isRealizedSale(sale: Pick<Sale, "status">): boolean {
  return sale.status === "confirmed";
}

export function normalizeAttributionKey(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve a venda para uma campanha sem aproximação fuzzy e sem atravessar
 * contas. A atribuição persistida no backend sempre tem prioridade.
 */
export function saleMatchesCampaign(sale: Sale, campaign: CampaignReference): boolean {
  if (!isRealizedSale(sale)) return false;
  if (sale.ad_account_id && campaign.ad_account_id && sale.ad_account_id !== campaign.ad_account_id) {
    return false;
  }

  const persistedId = sale.manual_override
    ? sale.manual_campaign_id || sale.matched_campaign_id
    : sale.matched_campaign_id;
  if (persistedId) return persistedId === campaign.id;
  if (sale.campaign_ids?.includes(campaign.id)) return true;

  const campaignId = normalizeAttributionKey(campaign.id);
  const campaignName = normalizeAttributionKey(campaign.name);
  const candidates = [sale.utm_campaign, sale.rd_campaign_name]
    .map(normalizeAttributionKey)
    .filter(Boolean);

  return candidates.some((candidate) => candidate === campaignId || (!!campaignName && candidate === campaignName));
}

export function realizedSales(sales: Sale[]): Sale[] {
  return sales.filter(isRealizedSale);
}
