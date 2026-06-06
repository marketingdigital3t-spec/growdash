import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type CRMDealStatus = "all" | "open" | "won" | "lost";

export interface CRMDeal {
  id: string;
  ad_account_id: string;
  rd_funnel_id: string;
  rd_deal_id: string;
  contact_name: string | null;
  contact_email: string | null;
  deal_owner_name: string | null;
  rd_stage_name: string | null;
  rd_stage_order: number | null;
  rd_product_name: string | null;
  stage_bucket: string;
  win: boolean;
  lost_reason: string | null;
  amount_total: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  lead_state: string | null;
  lead_city: string | null;
  lead_created_at: string | null;
  stage_updated_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

interface UseCRMDealsParams {
  startDate?: Date;
  endDate?: Date;
  adAccountId?: string;
  search?: string;
  funnelId?: string;
  owner?: string;
  stage?: string;
  status?: CRMDealStatus;
  refetchIntervalMs?: number;
}

const CRM_DEAL_FIELDS = [
  "id",
  "ad_account_id",
  "rd_funnel_id",
  "rd_deal_id",
  "contact_name",
  "contact_email",
  "deal_owner_name",
  "rd_stage_name",
  "rd_stage_order",
  "rd_product_name",
  "stage_bucket",
  "win",
  "lost_reason",
  "amount_total",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "lead_state",
  "lead_city",
  "lead_created_at",
  "stage_updated_at",
  "closed_at",
  "updated_at",
].join(", ");

const text = (value: unknown) => String(value ?? "").toLowerCase();

function matchesSearch(deal: CRMDeal, search?: string) {
  const q = text(search).trim();
  if (!q) return true;
  return [
    deal.contact_name,
    deal.contact_email,
    deal.rd_deal_id,
    deal.deal_owner_name,
    deal.rd_stage_name,
    deal.rd_product_name,
    deal.utm_source,
    deal.utm_campaign,
    deal.lead_city,
    deal.lead_state,
  ].some((value) => text(value).includes(q));
}

export function useCRMDeals({
  startDate,
  endDate,
  adAccountId,
  search,
  funnelId,
  owner,
  stage,
  status = "all",
  refetchIntervalMs,
}: UseCRMDealsParams = {}) {
  return useQuery({
    queryKey: [
      "crm_deals",
      startDate?.toISOString(),
      endDate?.toISOString(),
      adAccountId ?? "all",
      search ?? "",
      funnelId ?? "all",
      owner ?? "all",
      stage ?? "all",
      status,
    ],
    queryFn: async () => {
      let query = supabase
        .from("rd_deals")
        .select(CRM_DEAL_FIELDS)
        .order("lead_created_at", { ascending: false });

      if (startDate || endDate) {
        const startIso = startOfDay(startDate ?? endDate!).toISOString();
        const endIso = endOfDay(endDate ?? startDate!).toISOString();
        query = query.or([
          `and(lead_created_at.gte.${startIso},lead_created_at.lte.${endIso})`,
          `and(closed_at.gte.${startIso},closed_at.lte.${endIso})`,
          `and(stage_updated_at.gte.${startIso},stage_updated_at.lte.${endIso})`,
        ].join(","));
      }

      if (adAccountId && adAccountId !== "all") query = query.eq("ad_account_id", adAccountId);
      if (funnelId && funnelId !== "all") query = query.eq("rd_funnel_id", funnelId);
      if (owner && owner !== "all") query = query.eq("deal_owner_name", owner);
      if (stage && stage !== "all") query = query.eq("rd_stage_name", stage);
      if (status === "won") query = query.eq("win", true);
      if (status === "lost") query = query.not("lost_reason", "is", null);
      if (status === "open") query = query.eq("win", false).is("lost_reason", null);

      const PAGE = 1000;
      const MAX_PAGES = 10;
      let all: CRMDeal[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await query.range(from, to);
        if (error) throw error;
        const batch = (data || []) as unknown as CRMDeal[];
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }

      return all.filter((deal) => matchesSearch(deal, search));
    },
    refetchInterval: refetchIntervalMs,
  });
}
