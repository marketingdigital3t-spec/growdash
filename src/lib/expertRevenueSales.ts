import type { Sale } from "@/hooks/useSales";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import { canonicalWonDate, isCanonicalWonDeal } from "@/lib/canonicalMetrics";
import { dedupeCanonicalSales } from "@/lib/canonicalSales";
import { getRDDealAmount } from "@/lib/rdDealAmount";
import { dedupeRDDeals } from "@/hooks/useRDDealsForPeriod";

/**
 * Keeps the Expert dashboard coherent while RD and the legacy `sales`
 * materialization arrive at different times. RD wins are canonical; a
 * temporary missing `sales` row must not make the payment/platform widgets
 * contradict the revenue KPI.
 */
export function mergeCanonicalExpertSales(sales: Sale[], wonDeals: RDDealLite[]): Sale[] {
  const canonicalSales = dedupeCanonicalSales(sales);
  const confirmedDealIds = new Set(
    canonicalSales
      .filter((sale) => sale.status === "confirmed" && sale.rd_deal_id)
      .map((sale) => String(sale.rd_deal_id)),
  );
  const synthetic: Sale[] = [];
  for (const deal of dedupeRDDeals(wonDeals)) {
    const dealId = String(deal.rd_deal_id || "");
    if (!dealId || !isCanonicalWonDeal(deal) || confirmedDealIds.has(dealId)) continue;
    const amount = getRDDealAmount(deal);
    const closedDate = canonicalWonDate(deal);
    synthetic.push({
      id: `rd:${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${dealId}`,
      user_id: "",
      product_id: null,
      ad_account_id: deal.ad_account_id,
      campaign_ids: [],
      sale_date: closedDate ? closedDate.slice(0, 10) : "",
      gross_revenue: amount,
      net_revenue: amount,
      tax_amount: 0,
      refund_amount: 0,
      chargeback_amount: 0,
      payment_method: "outros",
      payment_method_source: "rd_station",
      custom_fields: deal.custom_fields ?? null,
      status: "confirmed",
      quantity: 1,
      notes: null,
      lead_state: deal.lead_state,
      lead_formation: null,
      contact_name: deal.contact_name,
      contact_phone: null,
      contact_email: deal.contact_email,
      lead_city: deal.lead_city,
      lead_entry_date: deal.lead_created_at,
      adset_id: deal.meta_adset_id ?? null,
      ad_id: deal.meta_ad_id ?? null,
      rd_deal_id: dealId,
      rd_campaign_name: deal.rd_campaign_name,
      rd_product_name: deal.rd_product_name,
      rd_funnel_id: deal.rd_funnel_id,
      utm_source: deal.utm_source,
      utm_medium: deal.utm_medium,
      utm_campaign: deal.utm_campaign,
      utm_term: deal.utm_term,
      utm_content: deal.utm_content,
      manual_platform: null,
      matched_campaign_id: deal.meta_campaign_id ?? null,
      match_method: null,
      manual_campaign_id: null,
      manual_adset_id: null,
      manual_ad_id: null,
      manual_override: false,
      workspace_id: null,
      business_unit_id: null,
      source_provider: "rd_station",
      source_record_id: dealId,
      source_closed_at: closedDate,
      attribution_confidence: null,
      attribution_reason: "rd_won_deal_fallback",
      meta_lead_id: deal.meta_lead_id ?? null,
      meta_form_id: deal.meta_form_id ?? null,
      meta_attribution_method: deal.meta_attribution_method ?? null,
      created_at: deal.updated_at || closedDate || new Date(0).toISOString(),
      updated_at: deal.updated_at || closedDate || new Date(0).toISOString(),
    });
  }
  return [...canonicalSales, ...synthetic];
}
