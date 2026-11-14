import { useMemo } from "react";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { useSales, dedupeCanonicalSales } from "@/hooks/useSales";
import { useRDDealsForPeriod, useRDWonDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFunnelStagesForIds } from "@/hooks/useRDDeals";
import { useResolvedRDAccountFunnelScope } from "@/hooks/useResolvedRDAccountFunnelScope";
import { aggregateRevenueSources } from "@/lib/revenueAggregation";
import { filterOperationalRDDeals, excludedOperationalRDDealIds } from "@/lib/crmPipelineStages";
import { NO_LINKED_RD_FUNNEL_SCOPE_ID } from "@/lib/rdAccountScope";
import { PerformanceSummaryDashboard } from "@/components/dashboard/PerformanceSummaryDashboard";

export default function PerformanceSummaryPage() {
  const {
    startDate,
    endDate,
    adAccountId: selectedAccount,
    adAccountIds: selectedAccountIds,
    funnelIds: selectedFunnelIds,
    businessUnitId,
    segment,
  } = useGlobalFilters();

  const { data: adAccounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const visibleAccounts = useMemo(() => {
    return businessUnitId
      ? adAccounts.filter((account) =>
          selectedAccountIds.length
            ? selectedAccountIds.includes(account.id)
            : account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id),
        )
      : adAccounts;
  }, [adAccounts, businessUnitId, selectedAccountIds, segment]);

  const visibleAccountIds = useMemo(() => new Set(visibleAccounts.map((a) => a.id)), [visibleAccounts]);
  const scopedAccountIds = useMemo(() => {
    return selectedAccountIds.length ? selectedAccountIds : visibleAccounts.map((a) => a.id);
  }, [selectedAccountIds, visibleAccounts]);

  const { data: rdFunnels = [] } = useRDFunnels();
  const resolvedRDAccountScope = useResolvedRDAccountFunnelScope({
    adAccountId: selectedAccountIds.length === 1 ? selectedAccountIds[0] : (selectedAccount === "all" ? undefined : selectedAccount),
    adAccountIds: selectedAccountIds,
    funnelIds: selectedFunnelIds,
  });
  const scopedRDfunnelIds = useMemo(() => {
    const resolved = resolvedRDAccountScope.funnelIds;
    if (resolved && resolved.length > 0) return resolved;
    if (resolvedRDAccountScope.accountScoped) return [NO_LINKED_RD_FUNNEL_SCOPE_ID];
    const active = rdFunnels.filter((f) => f.is_active && f.rd_funnel_id);
    return active.map((f) => f.id);
  }, [rdFunnels, resolvedRDAccountScope]);

  const insightsAccountIds = selectedAccountIds.length ? selectedAccountIds : scopedAccountIds;
  const { data: insights = [], isLoading: loadingInsights } = useInsights({
    adAccountId: insightsAccountIds.length === 1 ? insightsAccountIds[0] : undefined,
    adAccountIds: insightsAccountIds.length > 1 ? insightsAccountIds : undefined,
    attributionWindowsByAccount: Object.fromEntries(
      visibleAccounts.map((account) => [account.id, account.attribution_window || "account_default"]),
    ),
    startDate,
    endDate,
    enabled: !loadingAccounts && insightsAccountIds.length > 0,
  });

  const salesQuery = useSales({
    startDate,
    endDate,
    funnelIds: scopedRDfunnelIds,
    adAccountId: selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined,
    adAccountIds: selectedAccountIds.length > 1 ? selectedAccountIds : undefined,
  });

  const rdDealsQuery = useRDDealsForPeriod({
    startDate,
    endDate,
    adAccountIds: scopedAccountIds,
    funnelIds: scopedRDfunnelIds,
    enabled: true,
  });

  const rdWonDealsQuery = useRDWonDealsForPeriod({
    startDate,
    endDate,
    adAccountIds: scopedAccountIds,
    funnelIds: scopedRDfunnelIds,
    enabled: true,
  });

  const operationalRDDeals = useMemo(
    () => filterOperationalRDDeals(rdDealsQuery.data || [], rdFunnels),
    [rdDealsQuery.data, rdFunnels],
  );
  const operationalRDWonDeals = useMemo(
    () => filterOperationalRDDeals(rdWonDealsQuery.data || [], rdFunnels),
    [rdFunnels, rdWonDealsQuery.data],
  );

  const excludedRDDealIds = useMemo(
    () => excludedOperationalRDDealIds([...(rdDealsQuery.data || []), ...(rdWonDealsQuery.data || [])], rdFunnels),
    [rdDealsQuery.data, rdFunnels, rdWonDealsQuery.data],
  );

  const activeScopedFunnelIds = useMemo(() => new Set(scopedRDfunnelIds), [scopedRDfunnelIds]);
  const { data: scopedFunnelStages = [] } = useFunnelStagesForIds(scopedRDfunnelIds);
  const stageNameById = useMemo(
    () => new Map(scopedFunnelStages.map((stage) => [stage.rd_stage_id, stage.name])),
    [scopedFunnelStages],
  );
  const canonicalUnitSales = useMemo(
    () =>
      dedupeCanonicalSales(
        (salesQuery.data || []).filter((sale) => {
          if (sale.rd_deal_id && excludedRDDealIds.has(sale.rd_deal_id)) return false;
          if (sale.ad_account_id)
            return visibleAccountIds.has(sale.ad_account_id) && (selectedAccountIds.length === 0 || selectedAccountIds.includes(sale.ad_account_id));
          return !!sale.rd_funnel_id && activeScopedFunnelIds.has(sale.rd_funnel_id);
        }),
      ),
    [activeScopedFunnelIds, excludedRDDealIds, salesQuery.data, selectedAccountIds, visibleAccountIds],
  );

  const dashboardDeals = useMemo(
    () => operationalRDDeals
      .filter((deal) => !!deal.rd_funnel_id && activeScopedFunnelIds.has(deal.rd_funnel_id))
      .map((deal) => {
        const canonicalName = deal.rd_stage_name
          || (deal.rd_stage_id ? stageNameById.get(deal.rd_stage_id) : null)
          || null;
        return canonicalName && canonicalName !== deal.rd_stage_name
          ? { ...deal, rd_stage_name: canonicalName }
          : deal;
      }),
    [activeScopedFunnelIds, operationalRDDeals, stageNameById],
  );

  const dashboardRevenueDeals = useMemo(
    () => operationalRDWonDeals.filter((deal) => !!deal.rd_funnel_id && activeScopedFunnelIds.has(deal.rd_funnel_id)),
    [activeScopedFunnelIds, operationalRDWonDeals],
  );

  const glassSales = useMemo(
    () => aggregateRevenueSources(canonicalUnitSales, dashboardRevenueDeals),
    [canonicalUnitSales, dashboardRevenueDeals],
  );

  const totalSpend = useMemo(() => insights.reduce((sum, row) => sum + Number(row.spend || 0), 0), [insights]);
  const totalLeads = useMemo(() => {
    if (dashboardDeals.length > 0) return dashboardDeals.length;
    return insights.reduce((sum, row) => sum + Math.max(0, Number(row.leads || 0)), 0);
  }, [dashboardDeals, insights]);

  const accountsSpend = useMemo(() => {
    const spendByAcc = new Map<string, number>();
    for (const row of insights) {
      if (row.ad_account_id) {
        spendByAcc.set(row.ad_account_id, (spendByAcc.get(row.ad_account_id) || 0) + Number(row.spend || 0));
      }
    }
    return visibleAccounts
      .filter((acc) => spendByAcc.has(acc.id))
      .map((acc, index) => ({
        id: acc.id,
        name: acc.name ? (acc.name.length > 20 ? `Investimento CA0${index + 1}` : acc.name) : `Investimento CA0${index + 1}`,
        spend: spendByAcc.get(acc.id) || 0,
      }));
  }, [insights, visibleAccounts]);

  const accountTitle = useMemo(() => {
    if (selectedAccount !== "all") {
      const acc = visibleAccounts.find((a) => a.id === selectedAccount);
      if (acc?.name) return acc.name.replace(/^ca\d+\s*[-–]\s*/i, "").trim() || acc.name;
    }
    return "Aluna";
  }, [selectedAccount, visibleAccounts]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncingRD, setSyncingRD] = useState(false);

  async function syncRD() {
    if (syncingRD) return;
    setSyncingRD(true);
    try {
      const targetFunnels = rdFunnels.filter((f) => f.is_active && scopedRDfunnelIds.includes(f.id));
      for (const funnel of targetFunnels) {
        await supabase.functions.invoke("rd-sync-deals", {
          body: {
            funnel_id: funnel.id,
            analytics_mode: true,
            full_history: true,
            trigger_source: "summary_refresh",
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
      ]);
      toast({ title: "RD Station atualizado", description: "Os dados do funil e negociações foram sincronizados." });
    } catch (err) {
      toast({ title: "Erro ao atualizar RD", description: err instanceof Error ? err.message : "Não foi possível sincronizar o RD.", variant: "destructive" });
    } finally {
      setSyncingRD(false);
    }
  }

  const isLoading = loadingAccounts || loadingInsights;

  return (
    <MotionPage className="performance-summary-page gd-module-shell mx-auto w-full min-w-0 max-w-[1500px] space-y-5">
      <MotionItem>
        <PerformanceSummaryDashboard
          accountTitle={accountTitle}
          totalSpend={totalSpend}
          salesCount={glassSales.totalQuantity}
          totalLeads={totalLeads}
          deals={dashboardDeals}
          onSyncRD={syncRD}
          syncingRD={syncingRD}
        />
      </MotionItem>
    </MotionPage>
  );
}
