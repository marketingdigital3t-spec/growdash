import { useEffect, useMemo } from "react";
import { BarChart3, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { KPIWidget } from "@/components/dashboard/widgets/KPIWidget";
import { PaymentChartWidget, PlatformDistributionWidget } from "@/components/dashboard/widgets/FinancialOverviewWidgets";
import { Card, CardContent } from "@/components/ui/card";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { useSales } from "@/hooks/useSales";
import { useRDDealsForPeriod, useRDWonDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { DashboardWidgetHelp } from "@/components/dashboard/DashboardWidgetHelp";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { getExpertDashboardMetrics } from "@/lib/expertDashboardMetrics";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

const MESSAGING_CONVERSATION_EVENT = "onsite_conversion.messaging_conversation_started_7d";
const NATIVE_FORM_LEAD_EVENT = "onsite_conversion.lead_grouped";

/**
 * Deliberately separate from the editable operational dashboard. The page only
 * queries metric sources protected by account RLS and renders no write actions,
 * integrations, CRM details, campaign editor, or dashboard configuration.
 */
export default function ExpertDashboard() {
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate, adAccountIds, setAdAccountIds } = useGlobalFilters();
  const { data: accounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const accountId = adAccountIds.length === 1 ? adAccountIds[0] : "all";

  useEffect(() => {
    if (loadingAccounts || accounts.length === 0) return;
    const allowed = new Set(accounts.map((account) => account.id));
    const next = adAccountIds.filter((id) => allowed.has(id));
    if (next.length !== adAccountIds.length) setAdAccountIds(next);
  }, [adAccountIds, accounts, loadingAccounts, setAdAccountIds]);

  const selectedId = accountId === "all" ? undefined : accountId;
  // “Todas as contas” means the union of accounts authorized for this expert,
  // not every RD deal without attribution. The latter is a reconciliation item
  // and must never inflate the owner-facing dashboard total.
  const selectedAccountIds = useMemo(() => adAccountIds.length ? adAccountIds : accounts.map((account) => account.id), [adAccountIds, accounts]);
  const { data: insights = [], isLoading: loadingInsights } = useInsights({ adAccountId: selectedId, adAccountIds: selectedAccountIds, startDate, endDate });
  const { data: sales = [] } = useSales({ adAccountId: selectedId, adAccountIds: selectedAccountIds, startDate, endDate });
  const { data: rdDeals = [] } = useRDDealsForPeriod({ adAccountId: selectedId, adAccountIds: selectedAccountIds, startDate, endDate });
  const { data: revenueDeals = [] } = useRDWonDealsForPeriod({ adAccountId: selectedId, adAccountIds: selectedAccountIds, startDate, endDate });
  const permittedAccounts = useMemo(() => accounts.map((account) => ({ id: account.id, name: account.name })), [accounts]);
  // useInsights keeps the previous query result while a filter changes. Always
  // reapply the permitted account scope so the all-accounts total can never
  // briefly include a prior account or an account outside this expert access.
  const permittedInsights = useMemo(() => {
    const accountIds = new Set(accounts.map((account) => account.id));
    return insights.filter((insight) => !!insight.ad_account_id
      && accountIds.has(insight.ad_account_id)
      && (adAccountIds.length === 0 || adAccountIds.includes(insight.ad_account_id)));
  }, [accounts, insights, adAccountIds]);
  const permittedSales = useMemo(() => {
    const accountIds = new Set(accounts.map((account) => account.id));
    return sales.filter((sale) => !!sale.ad_account_id
      && accountIds.has(sale.ad_account_id)
      && (adAccountIds.length === 0 || adAccountIds.includes(sale.ad_account_id)));
  }, [accounts, sales, adAccountIds]);
  const actionAdIds = useMemo(
    () => Array.from(new Set(permittedInsights.map((insight) => insight.ad_id).filter(Boolean))),
    [permittedInsights],
  );
  const actionAccountMap = useMemo(
    () => Object.fromEntries(permittedInsights.map((insight) => [insight.ad_id, insight.ad_account_id])),
    [permittedInsights],
  );
  const { data: actionData } = useActionTotalsByAds(actionAdIds, startDate, endDate, actionAccountMap);
  const expertMetrics = useMemo(
    () => getExpertDashboardMetrics(permittedInsights, rdDeals, permittedSales, {
      nativeFormLeads: actionData?.totals?.[NATIVE_FORM_LEAD_EVENT],
      conversations: actionData?.totals?.[MESSAGING_CONVERSATION_EVENT],
    }),
    [actionData?.totals, permittedInsights, permittedSales, rdDeals],
  );
  const leadBreakdown = useMemo(() => ({
    forms: expertMetrics.forms,
    site: expertMetrics.siteLeads,
    conversations: expertMetrics.conversations,
    total: expertMetrics.metaLeads,
  }), [expertMetrics]);
  const isLoading = loadingAccounts || loadingInsights;

  return (
    <MotionPage className="expert-dashboard gd-module-shell min-w-0 space-y-5 sm:space-y-6">
      <MotionItem>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[.16em]">Growdash</span></div>
            <h1 className="mt-1 text-2xl font-bold">Painel do Expert</h1>
            <p className="mt-1 text-sm text-muted-foreground">Resultados autorizados para acompanhamento da operação.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[.07] px-3 py-1.5 text-xs font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5" />Somente leitura</div>
        </div>
      </MotionItem>

      <MotionItem>
        <DateFilterBar
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          startDate={startDate}
          endDate={endDate}
          adAccounts={permittedAccounts}
          selectedAccount={accountId}
          onAccountChange={(id) => setAdAccountIds(id === "all" ? [] : [id])}
          selectedAccountIds={adAccountIds}
          onAccountIdsChange={setAdAccountIds}
          showSummary
        />
      </MotionItem>

      <DashboardProvider value={{
        startDate, endDate, adAccountId: selectedId, insights: permittedInsights, sales: permittedSales, rdDeals, revenueDeals,
        alerts: [], campaigns: [], adAccounts: accounts, products: [], isLoading,
        metricOverrides: { leads: expertMetrics.leads, conversion_rate: expertMetrics.conversionRate, cpl: expertMetrics.cpl },
        leadBreakdown,
      }}>
        <MotionItem>
          <section aria-labelledby="expert-kpis-title" className="gd-module-section">
            <div className="dashboard-section-heading"><div><p className="dashboard-section-eyebrow">Visão executiva</p><h2 id="expert-kpis-title">Indicadores principais</h2></div><p className="dashboard-section-description">Resultados consolidados do período e das contas autorizadas.</p></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {[
              ["Faturamento bruto", "revenue_gross"], ["Investimento em tráfego", "spend"],
            ].map(([title, metric]) => <DashboardWidgetHelp key={metric} type="kpi" title={title} className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><KPIWidget title={title} config={{ metric: metric as any }} /></DashboardWidgetHelp>)}
            <DashboardWidgetHelp type="kpi" title="Leads Meta" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><MetricCard title="Leads Meta" value={expertMetrics.metaLeads} icon={<UsersRound className="h-4 w-4" />} decimals={0} tooltip={`Formulários: ${expertMetrics.forms.toLocaleString("pt-BR")} · Site: ${expertMetrics.siteLeads.toLocaleString("pt-BR")} · Conversas: ${expertMetrics.conversations.toLocaleString("pt-BR")}.`} /></DashboardWidgetHelp>
            {[
              ["CPL", "cpl"], ["ROAS", "roas"],
              ["Lucro", "profit"], ["Margem", "profit_margin"], ["Recebíveis", "receivables"], ["CTR", "ctr"], ["Taxa de conversão", "conversion_rate"],
            ].map(([title, metric]) => <DashboardWidgetHelp key={metric} type="kpi" title={title} className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><KPIWidget title={title} config={{ metric: metric as any }} /></DashboardWidgetHelp>)}
            </div>
          </section>
        </MotionItem>

        <MotionItem>
          <section aria-labelledby="expert-charts-title" className="gd-module-section">
            <div className="dashboard-section-heading"><div><p className="dashboard-section-eyebrow">Leitura visual</p><h2 id="expert-charts-title">Distribuição dos resultados</h2></div><p className="dashboard-section-description">Compare pagamentos e plataformas sem misturar fontes.</p></div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <DashboardWidgetHelp type="payment_chart" title="Vendas por Pagamento" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><PaymentChartWidget /></DashboardWidgetHelp>
            <DashboardWidgetHelp type="platform_distribution" title="Distribuição por Plataforma" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><PlatformDistributionWidget /></DashboardWidgetHelp>
            </div>
          </section>
        </MotionItem>

      </DashboardProvider>

      {!isLoading && accounts.length === 0 && (
        <Card className="border-dashed"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><LockKeyhole className="h-5 w-5 text-primary" />Nenhuma conta foi autorizada para este acesso. Solicite ao administrador que vincule uma conta de anúncio.</CardContent></Card>
      )}
    </MotionPage>
  );
}
