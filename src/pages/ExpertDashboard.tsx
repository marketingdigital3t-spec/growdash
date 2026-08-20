import { useEffect, useMemo, useState } from "react";
import { BarChart3, CircleDollarSign, LockKeyhole, MessageCircleMore, ShieldCheck, Target, UsersRound } from "lucide-react";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { KPIWidget } from "@/components/dashboard/widgets/KPIWidget";
import { PaymentChartWidget, PlatformDistributionWidget } from "@/components/dashboard/widgets/FinancialOverviewWidgets";
import { Card, CardContent } from "@/components/ui/card";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useInsights } from "@/hooks/useInsights";
import { useSales } from "@/hooks/useSales";
import { useRDDealsForPeriod, useRDWonDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { DashboardWidgetHelp } from "@/components/dashboard/DashboardWidgetHelp";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { getExpertAttribution, getExpertDashboardMetrics } from "@/lib/expertDashboardMetrics";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";

const MESSAGING_CONVERSATION_EVENT = "onsite_conversion.messaging_conversation_started_7d";
const NATIVE_FORM_LEAD_EVENT = "onsite_conversion.lead_grouped";

/**
 * Deliberately separate from the editable operational dashboard. The page only
 * queries metric sources protected by account RLS and renders no write actions,
 * integrations, CRM details, campaign editor, or dashboard configuration.
 */
export default function ExpertDashboard() {
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const { data: accounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const [accountId, setAccountId] = useState("all");

  useEffect(() => {
    if (loadingAccounts || accounts.length === 0) return;
    if (accounts.length === 1) setAccountId(accounts[0].id);
    else if (accountId !== "all" && !accounts.some((account) => account.id === accountId)) setAccountId("all");
  }, [accountId, accounts, loadingAccounts]);

  const selectedId = accountId === "all" ? undefined : accountId;
  // “Todas as contas” means the union of accounts authorized for this expert,
  // not every RD deal without attribution. The latter is a reconciliation item
  // and must never inflate the owner-facing dashboard total.
  const selectedAccountIds = useMemo(() => accountId === "all" ? accounts.map((account) => account.id) : undefined, [accountId, accounts]);
  const { data: insights = [], isLoading: loadingInsights } = useInsights({ adAccountId: selectedId, startDate, endDate });
  const { data: sales = [] } = useSales({ adAccountId: selectedId, startDate, endDate });
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
      && (!selectedId || insight.ad_account_id === selectedId));
  }, [accounts, insights, selectedId]);
  const permittedSales = useMemo(() => {
    const accountIds = new Set(accounts.map((account) => account.id));
    return sales.filter((sale) => !!sale.ad_account_id
      && accountIds.has(sale.ad_account_id)
      && (!selectedId || sale.ad_account_id === selectedId));
  }, [accounts, sales, selectedId]);
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
  const attribution = useMemo(() => getExpertAttribution(permittedSales), [permittedSales]);
  const isLoading = loadingAccounts || loadingInsights;

  return (
    <MotionPage className="expert-dashboard min-w-0 space-y-4 sm:space-y-6">
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
          onAccountChange={setAccountId}
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
          <section aria-label="Indicadores de performance" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {[
              ["Faturamento líquido", "revenue_net"], ["Investimento", "spend"],
            ].map(([title, metric]) => <DashboardWidgetHelp key={metric} type="kpi" title={title} className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><KPIWidget title={title} config={{ metric: metric as any }} /></DashboardWidgetHelp>)}
            <DashboardWidgetHelp type="kpi" title="Leads Meta" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><MetricCard title="Leads Meta" value={expertMetrics.metaLeads} icon={<UsersRound className="h-4 w-4" />} decimals={0} tooltip={`Formulários: ${expertMetrics.forms.toLocaleString("pt-BR")} · Site: ${expertMetrics.siteLeads.toLocaleString("pt-BR")} · Conversas: ${expertMetrics.conversations.toLocaleString("pt-BR")}.`} /></DashboardWidgetHelp>
            <DashboardWidgetHelp type="kpi" title="Conversas iniciadas" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><MetricCard title="Conversas iniciadas" value={expertMetrics.conversations} icon={<MessageCircleMore className="h-4 w-4" />} decimals={0} tooltip="Conversas de mensagem iniciadas nos anúncios Meta das contas e do período selecionados." /></DashboardWidgetHelp>
            {[
              ["CPL", "cpl"], ["ROAS", "roas"],
              ["Lucro", "profit"], ["Margem", "profit_margin"], ["Recebíveis", "receivables"], ["CTR", "ctr"], ["Taxa de conversão", "conversion_rate"],
            ].map(([title, metric]) => <DashboardWidgetHelp key={metric} type="kpi" title={title} className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><KPIWidget title={title} config={{ metric: metric as any }} /></DashboardWidgetHelp>)}
          </section>
        </MotionItem>

        <MotionItem>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <DashboardWidgetHelp type="payment_chart" title="Vendas por Pagamento" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><PaymentChartWidget /></DashboardWidgetHelp>
            <DashboardWidgetHelp type="platform_distribution" title="Distribuição por Plataforma" className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><PlatformDistributionWidget /></DashboardWidgetHelp>
          </section>
        </MotionItem>

        <MotionItem>
          <Card className="dashboard-glass-card min-w-0 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 text-primary"><Target className="h-4 w-4" /><span className="text-sm font-bold">Vendas por campanha e criativo</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">Atribuição baseada nas UTMs registradas no RD Station: campanha (utm_campaign) e criativo (utm_content).</p>
                </div>
                <div className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium tabular-nums">{expertMetrics.salesCount.toLocaleString("pt-BR")} vendas confirmadas</div>
              </div>
              {attribution.length > 0 ? <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/35 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-3 font-semibold">Campanha</th><th className="px-4 py-3 font-semibold">Criativo</th><th className="px-4 py-3 text-right font-semibold">Vendas</th><th className="px-4 py-3 text-right font-semibold">Faturamento líquido</th><th className="px-5 py-3 font-semibold">Pagamento</th></tr>
                  </thead>
                  <tbody>
                    {attribution.map((row) => <tr key={`${row.campaign}-${row.creative}`} className="border-t border-border/45 transition-colors hover:bg-muted/30">
                      <td className="max-w-[260px] truncate px-5 py-3 font-medium" title={row.campaign}>{row.campaign}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground" title={row.creative}>{row.creative}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.sales.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">R$ {row.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{row.payments.map((method) => <span key={method} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{paymentLabel(method)}</span>)}</div></td>
                    </tr>)}
                  </tbody>
                </table>
              </div> : <div className="flex min-h-32 items-center justify-center gap-2 px-5 py-8 text-center text-sm text-muted-foreground"><CircleDollarSign className="h-4 w-4" />Nenhuma venda confirmada com os filtros selecionados.</div>}
            </CardContent>
          </Card>
        </MotionItem>
      </DashboardProvider>

      {!isLoading && accounts.length === 0 && (
        <Card className="border-dashed"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><LockKeyhole className="h-5 w-5 text-primary" />Nenhuma conta foi autorizada para este acesso. Solicite ao administrador que vincule uma conta de anúncio.</CardContent></Card>
      )}
    </MotionPage>
  );
}

function paymentLabel(method: string) {
  return ({ pix: "Pix", cartao: "Cartão", boleto: "Boleto", outros: "Outros" } as Record<string, string>)[method] ?? "Outros";
}
