import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";

export interface MetaLeadIdentity {
  meta_lead_id: string;
  ad_account_id: string;
  ad_id?: string | null;
  created_time: string;
  email?: string | null;
  phone?: string | null;
}

export type ReconciliationMethod = "meta_lead_id" | "email_phone" | "email" | "phone" | "ad_id";

export interface ReconciledLead {
  deal: RDDealLite;
  metaLead: MetaLeadIdentity;
  method: ReconciliationMethod;
}

export interface LeadReconciliationResult {
  matched: ReconciledLead[];
  unmatchedDeals: RDDealLite[];
  unmatchedMetaLeads: MetaLeadIdentity[];
}

export function normalizeEmail(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

export function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

/**
 * Links RD deals to the selected Meta account(s) without requiring the old
 * RD `ad_account_id` relationship. A Meta lead can be consumed only once,
 * and ambiguous identity is left unmatched instead of inflating coverage.
 */
export function reconcileRDDealsToMetaLeads(
  deals: RDDealLite[],
  metaLeads: MetaLeadIdentity[],
): LeadReconciliationResult {
  const available = new Set(metaLeads);
  const matched: ReconciledLead[] = [];
  const unmatchedDeals: RDDealLite[] = [];

  for (const deal of deals) {
    const dealEmail = normalizeEmail(deal.contact_email);
    const dealPhone = normalizePhone(deal.contact_phone);
    const explicitId = deal.meta_lead_id?.trim();
    const adId = deal.meta_ad_id?.trim() || deal.utm_id?.trim();
    const candidates = metaLeads.filter((lead) => available.has(lead));
    let method: ReconciliationMethod | null = null;
    let selected: MetaLeadIdentity | undefined;

    if (explicitId) {
      selected = candidates.find((lead) => lead.meta_lead_id === explicitId);
      if (selected) method = "meta_lead_id";
    }
    if (!selected && dealEmail && dealPhone) {
      const exact = candidates.filter((lead) => normalizeEmail(lead.email) === dealEmail && normalizePhone(lead.phone) === dealPhone);
      if (exact.length === 1) { selected = exact[0]; method = "email_phone"; }
    }
    if (!selected && dealEmail) {
      const exact = candidates.filter((lead) => normalizeEmail(lead.email) === dealEmail);
      if (exact.length === 1) { selected = exact[0]; method = "email"; }
    }
    if (!selected && dealPhone) {
      const exact = candidates.filter((lead) => normalizePhone(lead.phone) === dealPhone);
      if (exact.length === 1) { selected = exact[0]; method = "phone"; }
    }
    if (!selected && adId) {
      const exact = candidates.filter((lead) => lead.ad_id === adId);
      if (exact.length === 1) { selected = exact[0]; method = "ad_id"; }
    }

    if (selected && method) {
      available.delete(selected);
      matched.push({ deal, metaLead: selected, method });
    } else {
      unmatchedDeals.push(deal);
    }
  }

  return { matched, unmatchedDeals, unmatchedMetaLeads: metaLeads.filter((lead) => available.has(lead)) };
}
