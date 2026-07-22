import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface RDDealLite {
  id: string;
  rd_deal_id: string;
  ad_account_id: string | null;
  rd_funnel_id: string | null;
  rd_stage_id: string | null;
  rd_stage_name: string | null;
  rd_stage_order: number | null;
  stage_bucket: string;
  win: boolean;
  lost_reason: string | null;
  amount_total: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  contact_name: string | null;
  contact_email: string | null;
  lead_state: string | null;
  lead_city: string | null;
  lead_created_at: string | null;
  stage_updated_at: string | null;
  closed_at: string | null;
  rd_product_name: string | null;
  deal_owner_name: string | null;
  first_touch_utm_campaign: string | null;
  last_touch_utm_campaign: string | null;
  rd_campaign_name: string | null;
  custom_fields?: Record<string, string> | null;
  updated_at?: string | null;
}

interface Params {
  startDate: Date;
  endDate: Date;
  adAccountId?: string;
  enabled?: boolean;
}

const FIELDS =
  "id, rd_deal_id, ad_account_id, rd_funnel_id, rd_stage_id, rd_stage_name, rd_stage_order, stage_bucket, win, lost_reason, amount_total, utm_source, utm_medium, utm_campaign, utm_content, utm_term, contact_name, contact_email, lead_state, lead_city, lead_created_at, stage_updated_at, closed_at, rd_product_name, deal_owner_name, first_touch_utm_campaign, last_touch_utm_campaign, custom_fields, updated_at";

export function useRDDealsForPeriod({ startDate, endDate, adAccountId, enabled = true }: Params) {
  return useQuery({
    queryKey: [
      "rd_deals_period",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      adAccountId ?? "all",
    ],
    enabled,
    queryFn: async () => {
      const PAGE = 1000;
      const MAX = 10;
      let all: RDDealLite[] = [];
      for (let p = 0; p < MAX; p++) {
        let q = (supabase as any)
          .from("rd_deals")
          .select(FIELDS)
          .gte("lead_created_at", startDate.toISOString())
          .lte("lead_created_at", endDate.toISOString())
          .order("lead_created_at", { ascending: false });
        if (adAccountId) q = q.eq("ad_account_id", adAccountId);
        const from = p * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await q.range(from, to);
        if (error) throw error;
        const batch = ((data ?? []) as any[]).map((d): RDDealLite => ({
          ...d,
          rd_campaign_name: d.last_touch_utm_campaign ?? d.first_touch_utm_campaign ?? d.utm_campaign ?? null,
        }));
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }
      return all;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Base operacional do CRM. Diferente dos relatórios, ela não corta negócios
 * pela data de criação: um lead antigo que continua aberto precisa permanecer
 * visível no pipeline, exatamente como no RD Station.
 */
export function useRDCRMDeals(adAccountId?: string, enabled = true) {
  return useQuery({
    queryKey: ["rd_crm_deals", adAccountId ?? "all"],
    enabled,
    queryFn: async () => {
      const pageSize = 1_000;
      const maxPages = 20;
      let all: RDDealLite[] = [];

      for (let page = 0; page < maxPages; page += 1) {
        let query = (supabase as any)
          .from("rd_deals")
          .select(FIELDS)
          .order("stage_updated_at", { ascending: false, nullsFirst: false })
          .order("lead_created_at", { ascending: false, nullsFirst: false });
        if (adAccountId) query = query.eq("ad_account_id", adAccountId);

        const from = page * pageSize;
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = ((data ?? []) as any[]).map((deal): RDDealLite => ({
          ...deal,
          rd_campaign_name: deal.last_touch_utm_campaign
            ?? deal.first_touch_utm_campaign
            ?? deal.utm_campaign
            ?? null,
        }));
        all = all.concat(batch);
        if (batch.length < pageSize) break;
      }

      return all;
    },
    staleTime: 15 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
    refetchOnWindowFocus: true,
  });
}

export type LeadBucket = "won" | "lost" | "disqualified" | "qualified" | "open";

const DISQUALIFIED_KEYWORDS = ["desqualif", "não qualif", "nao qualif", "unqualified", "unqualif"];
const QUALIFIED_BUCKETS = new Set(["sql", "opportunity", "client"]);

export function classifyLead(deal: RDDealLite): LeadBucket {
  if (deal.win) return "won";
  const stageName = (deal.rd_stage_name || "").toLowerCase();
  const reason = (deal.lost_reason || "").toLowerCase();
  const isDisqualified =
    DISQUALIFIED_KEYWORDS.some((k) => reason.includes(k)) ||
    DISQUALIFIED_KEYWORDS.some((k) => stageName.includes(k));
  if (deal.stage_bucket === "lost") {
    return isDisqualified ? "disqualified" : "lost";
  }
  if (isDisqualified) return "disqualified";
  if (QUALIFIED_BUCKETS.has(deal.stage_bucket)) return "qualified";
  return "open";
}
