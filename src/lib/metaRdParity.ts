export type MetaRDParityDeal = {
  meta_is_organic?: boolean | null;
  meta_attribution_status?: string | null;
  meta_lead_id?: string | null;
  meta_form_id?: string | null;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  meta_ad_id?: string | null;
  utm_source?: string | null;
};

/** True only when an RD deal can be compared with an attributed Meta lead. */
export function isMetaAttributedRDDeal(deal: MetaRDParityDeal) {
  if (deal.meta_is_organic === true) return false;
  const status = String(deal.meta_attribution_status || "").trim().toLowerCase();
  if (status) return status === "attributed";
  const source = String(deal.utm_source || "").trim().toLowerCase();
  return Boolean(
    deal.meta_lead_id
      || deal.meta_form_id
      || deal.meta_campaign_id
      || deal.meta_adset_id
      || deal.meta_ad_id
      || ["meta", "facebook", "fb", "instagram"].includes(source),
  );
}

export function summarizeMetaRdParity(metaLeads: number, deals: MetaRDParityDeal[]) {
  const safeMetaLeads = Math.max(0, Number(metaLeads) || 0);
  const rdTotalLeads = deals.length;
  const rdAttributedLeads = deals.filter(isMetaAttributedRDDeal).length;
  const rdUnmatchedLeads = rdTotalLeads - rdAttributedLeads;
  const differencePercent = safeMetaLeads > 0
    ? Math.abs(rdAttributedLeads - safeMetaLeads) / safeMetaLeads * 100
    : rdAttributedLeads > 0 ? 100 : 0;
  const coveragePercent = safeMetaLeads > 0 ? rdAttributedLeads / safeMetaLeads * 100 : rdAttributedLeads > 0 ? 100 : 0;
  return { metaLeads: safeMetaLeads, rdTotalLeads, rdAttributedLeads, rdUnmatchedLeads, differencePercent, coveragePercent };
}
