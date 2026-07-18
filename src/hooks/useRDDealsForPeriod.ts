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
}

interface Params {
  startDate: Date;
  endDate: Date;
  adAccountId?: string;
  enabled?: boolean;
}

const FIELDS =
  "id, rd_deal_id, ad_account_id, rd_funnel_id, rd_stage_id, rd_stage_name, stage_bucket, win, lost_reason, amount_total, utm_source, utm_medium, utm_campaign, utm_content, utm_term, contact_name, contact_email, lead_state, lead_city, lead_created_at, stage_updated_at, closed_at, rd_product_name, deal_owner_name, first_touch_utm_campaign, last_touch_utm_campaign, custom_fields";

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
        let q = supabase
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
