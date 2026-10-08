import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMetaTrafficMetrics } from "@/hooks/useMetaTrafficMetrics";
import { businessDateKey } from "@/lib/businessDate";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { isPaidOperationStatus, rankExpertSales } from "@/lib/expertOperations";
import { buildExpertAccountScope, filterEventClassesByInventory, type ExpertAccountScope } from "@/lib/eventClassFilters";
import { useBackfillEventClassAccounts } from "@/hooks/useEventClasses";
import { useRDWonDealsForPeriod, type RDDealLite } from "@/hooks/useRDDealsForPeriod";
import { canonicalWonDate } from "@/lib/canonicalMetrics";
import { getRDDealAmount } from "@/lib/rdDealAmount";

export type ExpertOperationSale = {
  id: string; expert_id: string; event_class_id: string | null; participant_type: "student" | "model_patient";
  name: string; sale_date: string | null; class_name: string | null; gross_amount_cents: number; cash_received_cents: number;
  status: string; source_class_id: string | null; class_match_status: "matched" | "unmatched" | "ambiguous"; seller_name: string | null; payment_method: string | null; utm_campaign: string | null; utm_content: string | null; cpf?: string | null; phone?: string | null; future_revenue_cents?: number; installment_number?: number | null; installment_condition?: string | null; reconciliation_status?: string | null; product?: string | null; class_date?: string | null; contract_signed?: boolean | null;
};
export type ExpertOperationSource = { expert_id: string; ad_account_id: string | null; attribution_window: string; timezone: string };
export type CRMWonSale = {
  id: string;
  rd_deal_id: string;
  ad_account_id: string | null;
  rd_funnel_id: string | null;
  sale_date: string;
  net_revenue: number;
  quantity: number;
  contact_name: string | null;
  deal_owner_name: string | null;
};
export type ExpertOperationsData = {
  expertId?: string;
  sources: ExpertOperationSource[];
  sales: ExpertOperationSale[];
  commercialSales: CRMWonSale[];
  commercialSalesLoading: boolean;
  commercialSalesAvailable: boolean;
  commercialSalesError: unknown;
  classes: any[];
  traffic: ReturnType<typeof useMetaTrafficMetrics>["data"];
  sellers: Array<{ name: string; sales: number; grossRevenue: number; cashReceived: number; goal: number; progress: number; ticket: number; collectionRate: number }>;
  sync: { status: "fresh" | "syncing" | "stale" | "partial" | "error"; syncedAt: string | null; errors: string[] };
};

export interface ExpertOperationsScope {
  startDate: Date;
  endDate: Date;
  selectedAccountIds?: string[];
}

export function useExpertOperations(
  expertId: string | undefined,
  scopedAccountIds: string[] = [],
  scope?: ExpertOperationsScope,
) {
  const globalFilters = useGlobalFilters();
  const startDate = scope?.startDate ?? globalFilters.startDate;
  const endDate = scope?.endDate ?? globalFilters.endDate;
  const selectedAccountIds = scope?.selectedAccountIds ?? scopedAccountIds;
  const expert = useQuery({ queryKey: ["expert-operations-expert", expertId], enabled: Boolean(expertId), queryFn: async () => { const { data, error } = await (supabase as any).from("experts").select("nome").eq("id", expertId!).maybeSingle(); if (error) throw error; return data; } });
  const sources = useQuery({
    queryKey: ["expert-operation-sources", expertId, selectedAccountIds], enabled: Boolean(expertId),
    queryFn: async () => {
      let query = (supabase as any).from("expert_operation_sources").select("*").eq("expert_id", expertId!);
      if (selectedAccountIds.length) query = query.in("ad_account_id", selectedAccountIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ExpertOperationSource[];
    },
  });
  const expertAccountLinks = useQuery({
    queryKey: ["expert-operation-account-links", selectedAccountIds.slice().sort()],
    enabled: Boolean(expertId || selectedAccountIds.length),
    queryFn: async () => {
      const { data: sourceRows, error: sourceError } = await (supabase as any)
        .from("expert_operation_sources")
        .select("expert_id,ad_account_id")
        .not("ad_account_id", "is", null);
      if (sourceError) throw sourceError;
      const { data: expertRows, error: expertError } = await (supabase as any)
        .from("experts")
        .select("id,nome");
      if (expertError) throw expertError;
      return buildExpertAccountScope(sourceRows || [], expertRows || []);
    },
  });
  const expertIdsForSales = useMemo(() => Array.from(new Set([
    ...(expertId ? [expertId] : []),
    ...selectedAccountIds.flatMap((accountId) => expertAccountLinks.data?.accountToExpertIds[accountId] || []),
  ])), [expertAccountLinks.data, expertId, selectedAccountIds]);
  const sales = useQuery({
    queryKey: ["expert-sales", expertIdsForSales.slice().sort()], enabled: expertIdsForSales.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expert_sales").select("id,expert_id,event_class_id,participant_type,name,sale_date,class_name,source_class_id,class_match_status,gross_amount_cents,cash_received_cents,future_revenue_cents,installment_number,installment_condition,reconciliation_status,product,class_date,contract_signed,cpf,phone,status,seller_name,payment_method,utm_campaign,utm_content,source_active").in("expert_id", expertIdsForSales).eq("source_active", true).order("sale_date", { ascending: true });
      if (error) throw error;
      return ((data || []) as ExpertOperationSale[]).filter((row) => isPaidOperationStatus(row.status));
    },
  });
  const rdWonDeals = useRDWonDealsForPeriod({
    adAccountIds: selectedAccountIds,
    funnelIds: globalFilters.funnelIds,
    startDate,
    endDate,
    allHistory: globalFilters.preset === "max",
    enabled: selectedAccountIds.length > 0,
  });
  const classes = useQuery({
    queryKey: ["expert-operation-classes", expertId || "none", selectedAccountIds.slice().sort(), Object.keys(expertAccountLinks.data?.expertToAccountIds || {}).join(",")], enabled: Boolean(expertId || selectedAccountIds.length),
    queryFn: async () => {
      const pageSize = 1000;
      const rows: any[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await (supabase as any).from("event_classes").select("*").order("date_start", { ascending: true }).range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < pageSize) break;
      }
      if (!rows.length) return [];
      const classIds = rows.map((row: any) => row.id);
      const accountLinks: any[] = [];
      const participants: any[] = [];
      for (let offset = 0; offset < classIds.length; offset += 500) {
        const ids = classIds.slice(offset, offset + 500);
        const { data: accountBatch, error: accountLinkError } = await (supabase as any).from("event_class_accounts").select("event_class_id,ad_account_id").in("event_class_id", ids);
        const { data: participantBatch, error: participantsError } = await (supabase as any).from("event_class_participants").select("*").in("event_class_id", ids).order("created_at", { ascending: true });
        if (accountLinkError) throw accountLinkError;
        if (participantsError) throw participantsError;
        accountLinks.push(...(accountBatch || []));
        participants.push(...(participantBatch || []));
      }
      const accountsByClass = new Map<string, string[]>();
      (accountLinks || []).forEach((link: any) => accountsByClass.set(link.event_class_id, [...(accountsByClass.get(link.event_class_id) || []), link.ad_account_id]));
      const byClass = new Map<string, any[]>();
      (participants || []).forEach((participant: any) => byClass.set(participant.event_class_id, [...(byClass.get(participant.event_class_id) || []), participant]));
      return rows.map((row: any) => ({ ...row, ad_account_ids: accountsByClass.get(row.id) || (row.ad_account_id ? [row.ad_account_id] : []), participants: byClass.get(row.id) || [] }));
    },
  });
  useBackfillEventClassAccounts(classes.data as any[] | undefined);
  const linkedAccountIds = useMemo(() => Array.from(new Set((sources.data || []).map((source) => source.ad_account_id).filter(Boolean) as string[])), [sources.data]);
  // Prefer the explicit expert-to-account link. During the migration to that
  // link table, use the account selected in the global toolbar so the expert
  // panel can still show the same Meta traffic scope as the rest of Growdash.
  const accountIds = useMemo(() => {
    // When no single expert is selected (all accounts or multiple experts),
    // the operation view still needs the complete authorized account scope
    // for Meta metrics and CRM totals.
    if (!expertId) return scopedAccountIds;
    if (!scopedAccountIds.length) return linkedAccountIds;
    if (!linkedAccountIds.length) return scopedAccountIds;
    return scopedAccountIds.filter((id) => linkedAccountIds.includes(id));
  }, [expertId, linkedAccountIds, scopedAccountIds]);
  const attributionWindowsByAccount = useMemo(() => Object.fromEntries((sources.data || []).filter((source) => source.ad_account_id).map((source) => [source.ad_account_id, source.attribution_window || "account_default"])), [sources.data]);
  const traffic = useMetaTrafficMetrics({ adAccountIds: accountIds, campaignIds: [], startDate: businessDateKey(startDate), endDate: businessDateKey(endDate), timezone: sources.data?.[0]?.timezone || "America/Sao_Paulo", attributionWindow: sources.data?.length === 1 ? sources.data[0].attribution_window : undefined }, Boolean(accountIds.length));
  const filteredClasses = useMemo(() => filterEventClassesByInventory(
    (classes.data || []) as Array<{ date_start: string; ad_account_id?: string | null; ad_account_ids?: string[]; expert_id?: string | null; expert_name?: string | null }>,
    selectedAccountIds,
    expertId,
    expert.data?.nome,
    expertAccountLinks.data as ExpertAccountScope | undefined,
  ), [classes.data, expert.data?.nome, expertId, expertAccountLinks.data, selectedAccountIds]);
  const sellerGoals = useQuery({ queryKey: ["expert-sales-goals", expertId, businessDateKey(startDate).slice(0, 7)], enabled: Boolean(expertId), queryFn: async () => { const { data, error } = await (supabase as any).from("expert_sales_goals").select("seller_name,target_cents").eq("expert_id", expertId!).eq("goal_month", `${businessDateKey(startDate).slice(0, 7)}-01`); if (error) throw error; return data || []; } });
  const sellers = useMemo(() => {
    const goals = new Map((sellerGoals.data || []).map((row: any) => [String(row.seller_name).trim().toLocaleLowerCase(), Number(row.target_cents || 0)]));
    return rankExpertSales(sales.data || [], Object.fromEntries(goals));
  }, [sales.data, sellerGoals.data]);
  const commercialSales = useMemo(() => (rdWonDeals.data || []).map((deal: RDDealLite): CRMWonSale => ({ id: deal.id, rd_deal_id: deal.rd_deal_id, ad_account_id: deal.ad_account_id, rd_funnel_id: deal.rd_funnel_id, sale_date: canonicalWonDate(deal) || "", net_revenue: getRDDealAmount(deal), quantity: 1, contact_name: deal.contact_name, deal_owner_name: deal.deal_owner_name })), [rdWonDeals.data]);
  const syncStatus = traffic.data.status === "syncing" || sources.isFetching || sales.isFetching || classes.isFetching || rdWonDeals.isFetching ? "syncing" : traffic.data.status;
  return { expertId, sources: sources.data || [], accountIds, sales: sales.data || [], commercialSales, commercialSalesLoading: rdWonDeals.isLoading, commercialSalesAvailable: rdWonDeals.isSuccess, commercialSalesError: rdWonDeals.error, classes: filteredClasses, classesLoading: classes.isLoading || expertAccountLinks.isLoading, classesError: classes.error || expertAccountLinks.error, traffic: traffic.data, sellers, sync: { status: syncStatus, syncedAt: traffic.data.syncedAt, errors: [sources.error, sales.error, rdWonDeals.error, classes.error, expertAccountLinks.error, sellerGoals.error, traffic.error].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error)) }, isLoading: sources.isLoading || sales.isLoading || rdWonDeals.isLoading || classes.isLoading || expertAccountLinks.isLoading || sellerGoals.isLoading || traffic.isLoading, refetch: () => { void sources.refetch(); void sales.refetch(); void rdWonDeals.refetch(); void classes.refetch(); void sellerGoals.refetch(); void traffic.refetch(); } };
}
