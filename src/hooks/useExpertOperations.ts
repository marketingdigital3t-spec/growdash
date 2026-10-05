import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMetaTrafficMetrics } from "@/hooks/useMetaTrafficMetrics";
import { businessDateKey } from "@/lib/businessDate";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { isPaidOperationStatus, normalizeClassName, rankExpertSales } from "@/lib/expertOperations";

const norm = normalizeClassName;

export type ExpertOperationSale = {
  id: string; expert_id: string; event_class_id: string | null; participant_type: "student" | "model_patient";
  name: string; sale_date: string | null; class_name: string | null; gross_amount_cents: number; cash_received_cents: number;
  status: string; source_class_id: string | null; class_match_status: "matched" | "unmatched" | "ambiguous"; seller_name: string | null; payment_method: string | null; utm_campaign: string | null; utm_content: string | null;
};
export type ExpertOperationSource = { expert_id: string; ad_account_id: string | null; attribution_window: string; timezone: string };
export type ExpertOperationsData = {
  expertId: string;
  sources: ExpertOperationSource[];
  sales: ExpertOperationSale[];
  classes: any[];
  traffic: ReturnType<typeof useMetaTrafficMetrics>["data"];
  sellers: Array<{ name: string; sales: number; grossRevenue: number; cashReceived: number; goal: number; progress: number; ticket: number; collectionRate: number }>;
  sync: { status: "fresh" | "syncing" | "stale" | "partial" | "error"; syncedAt: string | null; errors: string[] };
};

export function useExpertOperations(expertId: string | undefined) {
  const { startDate, endDate, adAccountIds } = useGlobalFilters();
  const expert = useQuery({ queryKey: ["expert-operations-expert", expertId], enabled: Boolean(expertId), queryFn: async () => { const { data, error } = await (supabase as any).from("experts").select("nome").eq("id", expertId!).maybeSingle(); if (error) throw error; return data; } });
  const sources = useQuery({
    queryKey: ["expert-operation-sources", expertId], enabled: Boolean(expertId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expert_operation_sources").select("*").eq("expert_id", expertId!);
      if (error) throw error;
      return (data || []) as ExpertOperationSource[];
    },
  });
  const sales = useQuery({
    queryKey: ["expert-sales", expertId, businessDateKey(startDate), businessDateKey(endDate)], enabled: Boolean(expertId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expert_sales").select("id,expert_id,event_class_id,participant_type,name,sale_date,class_name,source_class_id,class_match_status,gross_amount_cents,cash_received_cents,status,seller_name,payment_method,utm_campaign,utm_content").eq("expert_id", expertId!).gte("sale_date", businessDateKey(startDate)).lte("sale_date", businessDateKey(endDate)).order("sale_date", { ascending: true });
      if (error) throw error;
      return ((data || []) as ExpertOperationSale[]).filter((row) => isPaidOperationStatus(row.status));
    },
  });
  const classes = useQuery({
    queryKey: ["expert-operation-classes", expertId || "all", businessDateKey(startDate), businessDateKey(endDate)], enabled: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("event_classes").select("*").order("date_start", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) return [];
      const { data: participants, error: participantsError } = await (supabase as any).from("event_class_participants").select("*").in("event_class_id", rows.map((row: any) => row.id)).order("created_at", { ascending: true });
      if (participantsError) throw participantsError;
      const byClass = new Map<string, any[]>();
      (participants || []).forEach((participant: any) => byClass.set(participant.event_class_id, [...(byClass.get(participant.event_class_id) || []), participant]));
      return rows.map((row: any) => ({ ...row, participants: byClass.get(row.id) || [] }));
    },
  });
  const linkedAccountIds = useMemo(() => Array.from(new Set((sources.data || []).map((source) => source.ad_account_id).filter(Boolean) as string[])), [sources.data]);
  // Prefer the explicit expert-to-account link. During the migration to that
  // link table, use the account selected in the global toolbar so the expert
  // panel can still show the same Meta traffic scope as the rest of Growdash.
  const accountIds = useMemo(
    () => linkedAccountIds.length ? linkedAccountIds : adAccountIds,
    [adAccountIds, linkedAccountIds],
  );
  const attributionWindowsByAccount = useMemo(() => Object.fromEntries((sources.data || []).filter((source) => source.ad_account_id).map((source) => [source.ad_account_id, source.attribution_window || "account_default"])), [sources.data]);
  const traffic = useMetaTrafficMetrics({ adAccountIds: accountIds, campaignIds: [], startDate: businessDateKey(startDate), endDate: businessDateKey(endDate), timezone: sources.data?.[0]?.timezone || "America/Sao_Paulo", attributionWindow: sources.data?.length === 1 ? sources.data[0].attribution_window : undefined }, Boolean(accountIds.length));
  const filteredClasses = useMemo(() => (classes.data || []).filter((item: any) => {
    if (!expertId) return true;
    if (item.expert_id && item.expert_id !== expertId) return false;
    if (!item.expert_id && norm(item.expert_name) !== norm(expert.data?.nome)) return false;
    // O carrossel de turmas é um inventário operacional. O período global
    // continua filtrando tráfego e vendas, mas não deve esconder turmas
    // futuras ou históricas do calendário.
    return true;
  }), [classes.data, expertId, expert.data?.nome, startDate, endDate]);
  const sellerGoals = useQuery({ queryKey: ["expert-sales-goals", expertId, businessDateKey(startDate).slice(0, 7)], enabled: Boolean(expertId), queryFn: async () => { const { data, error } = await (supabase as any).from("expert_sales_goals").select("seller_name,target_cents").eq("expert_id", expertId!).eq("goal_month", `${businessDateKey(startDate).slice(0, 7)}-01`); if (error) throw error; return data || []; } });
  const sellers = useMemo(() => {
    const goals = new Map((sellerGoals.data || []).map((row: any) => [String(row.seller_name).trim().toLocaleLowerCase(), Number(row.target_cents || 0)]));
    return rankExpertSales(sales.data || [], Object.fromEntries(goals));
  }, [sales.data, sellerGoals.data]);
  const syncStatus = traffic.data.status === "syncing" || sources.isFetching || sales.isFetching ? "syncing" : traffic.data.status;
  return { expertId, sources: sources.data || [], accountIds, sales: sales.data || [], classes: filteredClasses, traffic: traffic.data, sellers, sync: { status: syncStatus, syncedAt: traffic.data.syncedAt, errors: [sources.error, sales.error, sellerGoals.error, traffic.error].filter(Boolean).map((error) => error instanceof Error ? error.message : String(error)) }, isLoading: sources.isLoading || sales.isLoading || classes.isLoading || sellerGoals.isLoading || traffic.isLoading, refetch: () => { void sources.refetch(); void sales.refetch(); void classes.refetch(); void sellerGoals.refetch(); void traffic.refetch(); } };
}
