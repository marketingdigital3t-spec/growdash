import { differenceInCalendarDays } from "date-fns";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useSales } from "@/hooks/useSales";
import {
  aggregateUnifiedMetrics,
  buildForecastScenarios,
  buildPlaybooks,
  calculateBudgetPacing,
  detectAnomalies,
  detectCreativeFatigue,
  resolveDataState,
  type AccountMetricContext,
} from "@/lib/intelligenceMetrics";

export function useIntelligenceCenter() {
  const filters = useGlobalFilters();
  const selectedAccountId = filters.adAccountId === "all" ? undefined : filters.adAccountId;
  const accountsQuery = useAdAccounts();
  const insightsQuery = useInsights({ adAccountId: selectedAccountId, startDate: filters.startDate, endDate: filters.endDate });
  const dealsQuery = useRDDealsForPeriod({ adAccountId: selectedAccountId, startDate: filters.startDate, endDate: filters.endDate });
  const salesQuery = useSales({ adAccountId: selectedAccountId, startDate: filters.startDate, endDate: filters.endDate });
  const campaignsQuery = useCampaigns(selectedAccountId);

  const accounts = accountsQuery.data || [];
  const selected = accounts.find((account) => account.id === selectedAccountId);
  const scopedAccounts = selected ? [selected] : accounts;
  const latestSync = scopedAccounts.map((account) => account.last_sync_success_at).filter(Boolean).sort().at(-1) || null;
  const context: AccountMetricContext = {
    id: selected?.id || "all",
    name: selected?.name || "Todas as contas",
    timezone: selected?.timezone_name || "America/Sao_Paulo",
    attributionWindow: selected?.attribution_window || "account_default",
    dailyBudget: scopedAccounts.reduce((sum, account) => sum + Number(account.daily_budget || 0), 0),
    remainingBalance: scopedAccounts.reduce((sum, account) => sum + Number(account.remaining_balance || 0), 0),
    targetCpl: selected ? Number(selected.target_cpl || 0) : 0,
    lastSyncAt: latestSync,
    oauthStatus: selected?.oauth_health_status || (selected?.connection_status === "connected" ? "unchecked" : "error"),
  };
  const metrics = aggregateUnifiedMetrics(insightsQuery.data || [], dealsQuery.data || [], salesQuery.data || []);
  const elapsedDays = Math.max(1, differenceInCalendarDays(filters.endDate, filters.startDate) + 1);
  const anomalies = detectAnomalies(insightsQuery.data || [], context.targetCpl);
  const pacing = calculateBudgetPacing(metrics, context, elapsedDays);
  const forecasts = buildForecastScenarios(metrics, pacing.projectedMonthSpend || metrics.spend);
  const creativeFatigue = detectCreativeFatigue(insightsQuery.data || []);
  const playbooks = buildPlaybooks(anomalies, pacing);
  const loading = accountsQuery.isLoading || insightsQuery.isLoading || dealsQuery.isLoading || salesQuery.isLoading;
  const error = accountsQuery.error || insightsQuery.error || dealsQuery.error || salesQuery.error;
  const dataState = resolveDataState({ loading, error, hasConfiguredSource: accounts.length > 0, rows: (insightsQuery.data || []).length, lastSyncAt: latestSync });
  return {
    filters,
    context,
    accounts,
    metrics,
    anomalies,
    pacing,
    forecasts,
    creativeFatigue,
    playbooks,
    campaigns: campaignsQuery.data || [],
    insights: insightsQuery.data || [],
    deals: dealsQuery.data || [],
    sales: salesQuery.data || [],
    dataState,
    loading,
    error,
    isFetching: insightsQuery.isFetching || dealsQuery.isFetching || salesQuery.isFetching,
    refetch: async () => Promise.all([accountsQuery.refetch(), insightsQuery.refetch(), dealsQuery.refetch(), salesQuery.refetch(), campaignsQuery.refetch()]),
  };
}
