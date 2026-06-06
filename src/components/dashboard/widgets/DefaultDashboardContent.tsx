// Default "Padrão" dashboard. Reflects the user's requested layout:
// 1) Faturamento Líquido / Gastos / ROAS / ROI
// 2) Vendas por Pagamento / Vendas por Plataforma / Margem / Recebíveis / Ticket Médio
// 3) Performance de Campanhas (3 abas: Formulário Nativo / Landing page / Mensagens)
// 4) Funil de Conversão (passos definidos por aba)
// 5) Gráficos diários
// + CampaignsDetailWidget no fim (system widget)

import { useMemo, useState } from "react";
import {
  DollarSign, BarChart3, Users, MousePointer, Coins, ArrowRightLeft,
  TrendingUp, Receipt, Percent, BadgeDollarSign, PiggyBank, Eye, Globe2,
  FileText, Globe, MessageCircle, MousePointerClick, ShoppingBag,
  Facebook, Chrome, HelpCircle, ArrowRight,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { InsightsTable } from "@/components/dashboard/InsightsTable";
import { CampaignResultsTable } from "@/components/dashboard/CampaignResultsTable";
import { PaymentChart } from "@/components/dashboard/PaymentChart";
import { PerformanceLineChart } from "@/components/dashboard/PerformanceLineChart";
import { ObjectiveTabs, type ObjectiveType } from "@/components/dashboard/ObjectiveTabs";
import { CampaignFunnel, type FunnelStepDef } from "@/components/dashboard/CampaignFunnel";
import { FunnelStepsSelect } from "@/components/dashboard/FunnelStepsSelect";
import { CampaignMultiSelect } from "@/components/dashboard/CampaignMultiSelect";
import { aggregateMetrics, groupByDate, groupByCreative } from "@/lib/metrics";
import { aggregateSales, type Sale } from "@/hooks/useSales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePlatformRules } from "@/hooks/usePlatformRules";
import { inferPlatform, inferPlatformWithDealFallback, PLATFORM_LABELS, type TopPlatform } from "@/lib/platformInference";
import { PlatformDrilldownSheet } from "@/components/dashboard/PlatformDrilldownSheet";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { useAccountLpConfigs } from "@/hooks/useAccountPixels";
import { useAccountAdsets } from "@/hooks/useAccountAdsets";
import { GeoOriginWidget } from "@/components/dashboard/widgets/GeoOriginWidget";

// Mapeamento destination_type (Meta) -> aba
const DEST_NATIVE = new Set(["ON_AD"]);
const DEST_LANDING = new Set(["WEBSITE"]);
const DEST_MESSAGES = new Set([
  "MESSENGER", "WHATSAPP", "INSTAGRAM_DIRECT",
  "MESSAGING_INSTAGRAM_DIRECT", "MESSAGING_MESSENGER", "MESSAGING_WHATSAPP",
]);

// Eventos canônicos do Meta usados para classificar a MECÂNICA real da campanha.
// Não usamos `campaign.objective` porque o ODAX colapsou tudo em OUTCOME_LEADS.
const NATIVE_LEAD_GROUPED = "onsite_conversion.lead_grouped";
const LP_VIEW_EVENT = "landing_page_view";
const MESSAGE_EVENT = "onsite_conversion.messaging_conversation_started_7d";

interface Props {
  onEditSale: (s: Sale) => void;
}

export function DefaultDashboardContent({ onEditSale: _onEditSale }: Props) {
  const { insights, sales, rdDeals, campaigns, startDate, endDate, adAccountId } = useDashboard();
  const { data: platformRules = [] } = usePlatformRules();
  const { data: lpConfigs = {} } = useAccountLpConfigs();
  const { data: accountAdsets = [] } = useAccountAdsets(adAccountId);
  const [drilldown, setDrilldown] = useState<TopPlatform | null>(null);
  const [platformView, setPlatformView] = useState<"leads" | "revenue" | "conv">("leads");
  const [objective, setObjective] = useState<ObjectiveType>("leads");
  const [perfCampaignIds, setPerfCampaignIds] = useState<string[]>([]);
  const [funnelHidden, setFunnelHidden] = useState<Record<ObjectiveType, string[]>>({
    leads: [],
    native_form: [],
    landing_page: [],
    messages: [],
  });

  const adMetrics = aggregateMetrics(insights);
  const salesMetrics = aggregateSales(sales);

  // === STEP 1: fetch action totals for ALL ads in the period ===
  // Classification needs per-campaign data, so we don't pre-filter by tab.
  const allAdIds = useMemo(
    () => Array.from(new Set(insights.map((r) => r.ad_id))),
    [insights],
  );
  const adAccountByAdId = useMemo(() => {
    const m: Record<string, string | null | undefined> = {};
    for (const r of insights) m[r.ad_id] = r.ad_account_id;
    return m;
  }, [insights]);
  const { data: actionData = { totals: {}, totalsByAccount: {}, dailyByAccount: {}, totalsByAd: {}, excludedAdCount: 0 } } = useActionTotalsByAds(
    allAdIds,
    startDate,
    endDate,
    adAccountByAdId,
  );

  // === STEP 2: classify each campaign by its real conversion mechanism ===
  // Combina eventos observados (lead_grouped/lpv/messages) + destination_type
  // estrutural do adset (ON_AD/WEBSITE/MESSENGER/...). Permite classificar
  // campanhas ATIVAS sem qualquer lead ou impressão no período.
  const campaignClassification = useMemo(() => {
    // ad_id -> campaign_id, campaign_id -> ad_account_id
    const campaignByAd: Record<string, string> = {};
    const accountByCampaign: Record<string, string> = {};
    for (const r of insights) {
      if (r.campaign_id) campaignByAd[r.ad_id] = r.campaign_id;
      if (r.campaign_id && r.ad_account_id) accountByCampaign[r.campaign_id] = r.ad_account_id;
    }
    // Fallback: completar accountByCampaign via tabela `campaigns`
    for (const c of (campaigns || []) as any[]) {
      if (c.id && c.ad_account_id && !accountByCampaign[c.id]) {
        accountByCampaign[c.id] = c.ad_account_id;
      }
    }

    // destination_type set por campanha (a partir dos adsets)
    const destSetByCampaign: Record<string, Set<string>> = {};
    // status da campanha (via adset.status como proxy quando precisamos):
    // usamos `campaigns.status` direto se disponível
    const campaignStatus: Record<string, string | null> = {};
    for (const c of (campaigns || []) as any[]) {
      if (c.id) campaignStatus[c.id] = c.status ?? null;
    }
    for (const a of accountAdsets) {
      if (!a.campaign_id || !a.destination_type) continue;
      if (!destSetByCampaign[a.campaign_id]) destSetByCampaign[a.campaign_id] = new Set();
      destSetByCampaign[a.campaign_id].add(a.destination_type);
    }

    // Aggregate per-campaign action totals (eventos)
    const totalsByCampaign: Record<string, Record<string, number>> = {};
    for (const adId of Object.keys(actionData.totalsByAd)) {
      const campId = campaignByAd[adId];
      if (!campId) continue;
      const adTotals = actionData.totalsByAd[adId];
      if (!totalsByCampaign[campId]) totalsByCampaign[campId] = {};
      for (const k of Object.keys(adTotals)) {
        totalsByCampaign[campId][k] = (totalsByCampaign[campId][k] || 0) + adTotals[k];
      }
    }

    // Universo de campanhas: as com insights no período + ativas com destination_type relevante
    const candidateIds = new Set<string>();
    for (const r of insights) if (r.campaign_id) candidateIds.add(r.campaign_id);
    for (const cid of Object.keys(destSetByCampaign)) {
      const status = (campaignStatus[cid] || "").toUpperCase();
      if (status !== "ACTIVE") continue;
      const ds = destSetByCampaign[cid];
      const hasRelevant = Array.from(ds).some(
        (d) => DEST_NATIVE.has(d) || DEST_LANDING.has(d) || DEST_MESSAGES.has(d),
      );
      if (hasRelevant) candidateIds.add(cid);
    }

    // Classify
    const native = new Set<string>();
    const landing = new Set<string>();
    const messages = new Set<string>();
    for (const campId of candidateIds) {
      const t = totalsByCampaign[campId] || {};
      const acc = accountByCampaign[campId];
      const lpAction = acc ? lpConfigs[acc]?.action_type : undefined;
      const ds = destSetByCampaign[campId] || new Set<string>();

      const hasNativeDest = Array.from(ds).some((d) => DEST_NATIVE.has(d));
      const hasLandingDest = Array.from(ds).some((d) => DEST_LANDING.has(d));
      const hasMsgDest = Array.from(ds).some((d) => DEST_MESSAGES.has(d));

      if ((t[NATIVE_LEAD_GROUPED] || 0) > 0 || hasNativeDest) native.add(campId);
      // Landing exige destino WEBSITE OU (lpv>0 sem destino nativo).
      // Evita que campanhas de FORMS (ON_AD) com pixel_lead/lpv "ruído" inflacionem a aba LP.
      if (
        lpAction &&
        (hasLandingDest || ((t[LP_VIEW_EVENT] || 0) > 0 && !hasNativeDest))
      ) {
        landing.add(campId);
      }
      // Mensagens: destino estrutural sempre conta; eventos contam mesmo sem destino
      if ((t[MESSAGE_EVENT] || 0) > 0 || hasMsgDest) messages.add(campId);
    }
    return { native, landing, messages, totalsByCampaign, accountByCampaign };
  }, [insights, actionData.totalsByAd, lpConfigs, accountAdsets, campaigns]);

  // Set of campaign IDs allowed for the current tab
  const allowedCampaignIds = useMemo(() => {
    const { native, landing, messages } = campaignClassification;
    if (objective === "native_form") return native;
    if (objective === "landing_page") return landing;
    if (objective === "messages") return messages;
    // "leads" = união de nativo + landing
    return new Set<string>([...native, ...landing]);
  }, [campaignClassification, objective]);

  const objectiveInsights = useMemo(
    () =>
      insights.filter(
        (r) =>
          r.campaign_id &&
          allowedCampaignIds.has(r.campaign_id) &&
          (perfCampaignIds.length === 0 || perfCampaignIds.includes(r.campaign_id)),
      ),
    [insights, allowedCampaignIds, perfCampaignIds],
  );
  const objectiveMetrics = aggregateMetrics(objectiveInsights);
  const creativeData = groupByCreative(objectiveInsights);

  const objectiveCampaigns = useMemo(
    () =>
      (campaigns || [])
        .filter((c: any) => allowedCampaignIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name })),
    [campaigns, allowedCampaignIds],
  );

  // Action totals SCOPED to the current tab (only ads of campaigns classified into this tab).
  // Without this, KPIs would include events from campaigns of other mechanisms.
  const scopedAdIds = useMemo(
    () => Array.from(new Set(objectiveInsights.map((r) => r.ad_id))),
    [objectiveInsights],
  );
  // Map ad_id -> campaign_id (from insights) for sub-classification within the tab.
  const campaignByAdAll = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of insights) if (r.campaign_id) m[r.ad_id] = r.campaign_id;
    return m;
  }, [insights]);
  const { actionTotals, scopedTotalsByAccount, nativeTotalsByAccount, landingTotalsByAccount } = useMemo(() => {
    const totals: Record<string, number> = {};
    const byAcc: Record<string, Record<string, number>> = {};
    const byAccNative: Record<string, Record<string, number>> = {};
    const byAccLanding: Record<string, Record<string, number>> = {};
    const accByAd: Record<string, string | null | undefined> = adAccountByAdId;
    const { native, landing } = campaignClassification;
    for (const adId of scopedAdIds) {
      const t = actionData.totalsByAd[adId];
      if (!t) continue;
      const acc = accByAd[adId];
      const campId = campaignByAdAll[adId];
      const isNative = campId ? native.has(campId) : false;
      const isLanding = campId ? landing.has(campId) : false;
      for (const k of Object.keys(t)) {
        totals[k] = (totals[k] || 0) + t[k];
        if (acc) {
          if (!byAcc[acc]) byAcc[acc] = {};
          byAcc[acc][k] = (byAcc[acc][k] || 0) + t[k];
          if (isNative) {
            if (!byAccNative[acc]) byAccNative[acc] = {};
            byAccNative[acc][k] = (byAccNative[acc][k] || 0) + t[k];
          }
          if (isLanding) {
            if (!byAccLanding[acc]) byAccLanding[acc] = {};
            byAccLanding[acc][k] = (byAccLanding[acc][k] || 0) + t[k];
          }
        }
      }
    }
    return {
      actionTotals: totals,
      scopedTotalsByAccount: byAcc,
      nativeTotalsByAccount: byAccNative,
      landingTotalsByAccount: byAccLanding,
    };
  }, [scopedAdIds, actionData.totalsByAd, adAccountByAdId, campaignByAdAll, campaignClassification]);

  // Financial metrics
  const roas = adMetrics.totalSpend > 0 ? salesMetrics.totalNet / adMetrics.totalSpend : 0;
  const profit = salesMetrics.totalNet - adMetrics.totalSpend - salesMetrics.totalTax;
  const roi = adMetrics.totalSpend > 0 ? (profit / adMetrics.totalSpend) * 100 : 0;
  const profitMargin = salesMetrics.totalNet > 0 ? (profit / salesMetrics.totalNet) * 100 : 0;

  const confirmedCount = sales.filter((s) => s.status === "confirmed" || s.status === "pending").length;
  const ticketMedio = confirmedCount > 0 ? salesMetrics.totalNet / confirmedCount : 0;

  const PLATFORM_COLORS: Record<TopPlatform, string> = {
    meta: "hsl(221, 83%, 53%)",
    google: "hsl(38, 92%, 50%)",
    organic: "hsl(142, 71%, 45%)",
    unknown: "hsl(var(--muted-foreground))",
  };

  // ============================================================
  // Per-tab metrics from raw action totals
  // ============================================================
  const totalImpressions = objectiveInsights.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = objectiveInsights.reduce((s, r) => s + r.clicks, 0);
  const totalSpend = objectiveInsights.reduce((s, r) => s + r.spend, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const linkClicks = actionTotals["link_click"] || 0;
  const lpViews = actionTotals["landing_page_view"] || 0;

  const messages = actionTotals[MESSAGE_EVENT] || 0;

  // Per-account event sets, fully driven by user-configured per-scope mapping.
  const allAccountIds = Array.from(new Set(Object.keys(scopedTotalsByAccount)));

  // Native form: automatic — max(lead, lead_grouped) per account (Meta double-counts).
  // Landing page: per-account configured action_type via account_lp_config.
  const lpEventsForAccount = (acc: string): string[] => {
    const a = lpConfigs[acc]?.action_type;
    return a ? [a] : [];
  };

  const nativeEventsForAccount = (_acc: string): string[] => {
    return [NATIVE_LEAD_GROUPED];
  };

  // Formulário Instantâneo: usa SOMENTE lead_grouped (bate com Meta).
  const nativeLeadsCountForAccount = (accTotals: Record<string, number>): number => {
    return accTotals[NATIVE_LEAD_GROUPED] || 0;
  };

  // Returns the action_types used by the active tab for daily-series accumulation.
  const tabEventsForAccount = (acc: string): string[] => {
    if (objective === "messages") return [MESSAGE_EVENT];
    if (objective === "native_form") return nativeEventsForAccount(acc);
    if (objective === "landing_page") return lpEventsForAccount(acc);
    return Array.from(new Set([...nativeEventsForAccount(acc), ...lpEventsForAccount(acc)]));
  };

  // Compute totals — separa contagem por classificação para evitar dupla contagem
  // (ex.: campanhas de FORMS nativo que disparam pixel_lead também contariam como LP).
  let tabLeads = 0;
  let lpLeads = 0;
  let nativeLeads = 0;
  const lpLeadActionsUsed: string[] = [];
  for (const acc of allAccountIds) {
    const accTotals = scopedTotalsByAccount[acc] || {};
    const accNativeTotals = nativeTotalsByAccount[acc] || {};
    const accLandingTotals = landingTotalsByAccount[acc] || {};
    const lpEvts = lpEventsForAccount(acc);
    // Native leads contam SOMENTE de campanhas classificadas como nativo
    const accNative = nativeLeadsCountForAccount(accNativeTotals);
    nativeLeads += accNative;
    // LP leads contam SOMENTE de campanhas classificadas como landing
    for (const e of lpEvts) {
      lpLeads += accLandingTotals[e] || 0;
      if (!lpLeadActionsUsed.includes(e)) lpLeadActionsUsed.push(e);
    }
    if (objective === "messages") tabLeads += accTotals[MESSAGE_EVENT] || 0;
    else if (objective === "native_form") tabLeads += accNative;
    else if (objective === "landing_page") for (const e of lpEvts) tabLeads += accLandingTotals[e] || 0;
    else tabLeads += accNative + lpEvts.reduce((s, e) => s + (accLandingTotals[e] || 0), 0);
  }

  const clickRef = linkClicks > 0 ? linkClicks : totalClicks;

  // Resultados por plataforma:
  //   - leads do Meta vêm de insight_actions (mesma fonte do KPI "Leads" = tabLeads).
  //   - leads de Google / Orgânico / Não encontrado vêm do CRM (rdDeals).
  //   - vendas e receita vêm de `sales`.
  const platformBreakdown = useMemo(() => {
    const acc: Record<TopPlatform, { leads: number; sales: number; revenue: number }> = {
      meta: { leads: tabLeads, sales: 0, revenue: 0 },
      google: { leads: 0, sales: 0, revenue: 0 },
      organic: { leads: 0, sales: 0, revenue: 0 },
      unknown: { leads: 0, sales: 0, revenue: 0 },
    };
    const dealsByRdId = new Map<string, any>();
    rdDeals.forEach((d: any) => {
      if (d.rd_deal_id) dealsByRdId.set(d.rd_deal_id, d);
    });
    rdDeals.forEach((d) => {
      const p = inferPlatform(d, platformRules).platform;
      // Meta já vem de tabLeads (insight_actions); deals sem plataforma identificada
      // ("unknown") são geralmente leads do Meta sem UTM — não contar para evitar dupla contagem.
      if (p === "meta" || p === "unknown") return;
      acc[p].leads += 1;
    });
    sales.forEach((s) => {
      if (s.status !== "confirmed" && s.status !== "pending") return;
      const p = inferPlatformWithDealFallback(s, dealsByRdId, platformRules).platform;
      acc[p].sales += 1;
      acc[p].revenue += s.net_revenue;
    });
    return (Object.keys(acc) as TopPlatform[])
      .map((k) => {
        const a = acc[k];
        const conv = a.leads > 0 ? (a.sales / a.leads) * 100 : 0;
        return { key: k, name: PLATFORM_LABELS[k], ...a, conv };
      })
      // Sempre esconder bucket "Não encontrado" no breakdown de leads (evita confusão com Meta sem UTM)
      .filter((p) => p.key !== "unknown" || p.sales > 0 || p.revenue > 0)
      .sort((a, b) => (b.revenue - a.revenue) || (b.leads - a.leads));
  }, [rdDeals, sales, platformRules, tabLeads]);


  const totalPlatformRev = platformBreakdown.reduce((s, p) => s + p.revenue, 0);
  const totalPlatformLeads = platformBreakdown.reduce((s, p) => s + p.leads, 0);

  // ============================================================
  // Daily series respecting the active tab
  // ============================================================
  const dailyData = useMemo(() => {
    type DailyRow = {
      date: string;
      spend: number;
      clicks: number;
      impressions: number;
      link_clicks: number;
      leads: number;
    };
    const map = new Map<string, DailyRow>();
    for (const r of objectiveInsights) {
      const e = map.get(r.date) || {
        date: r.date, spend: 0, clicks: 0, impressions: 0, link_clicks: 0, leads: 0,
      };
      e.spend += r.spend;
      e.clicks += r.clicks;
      e.impressions += r.impressions;
      map.set(r.date, e);
    }
    // Add link_clicks + leads per day from insight_actions, scoped per account.
    for (const acc of Object.keys(actionData.dailyByAccount)) {
      const evts = tabEventsForAccount(acc);
      const byDate = actionData.dailyByAccount[acc];
      for (const date of Object.keys(byDate)) {
        const e = map.get(date);
        if (!e) continue; // only days that exist in insights (i.e., had spend/impressions)
        const byAction = byDate[date];
        e.link_clicks += byAction["link_click"] || 0;
        // Native usa SOMENTE lead_grouped (bate com Meta — `lead` é inflado)
        const native = byAction[NATIVE_LEAD_GROUPED] || 0;
        if (objective === "messages") e.leads += byAction[MESSAGE_EVENT] || 0;
        else if (objective === "native_form") e.leads += native;
        else if (objective === "landing_page") {
          for (const evt of lpEventsForAccount(acc)) e.leads += byAction[evt] || 0;
        } else {
          e.leads += native;
          for (const evt of lpEventsForAccount(acc)) e.leads += byAction[evt] || 0;
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => {
        const ref = d.link_clicks > 0 ? d.link_clicks : d.clicks;
        return {
          ...d,
          cpl: d.leads > 0 ? d.spend / d.leads : 0,
          ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
          conversion: ref > 0 ? (d.leads / ref) * 100 : 0,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectiveInsights, actionData.dailyByAccount, lpConfigs, objective]);

  // ============================================================
  // KPIs by tab
  // ============================================================
  let kpis: { title: string; value: number; prefix?: string; suffix?: string; decimals: number; icon: React.ReactNode; tooltip?: string }[] = [];
  let funnelSteps: FunnelStepDef[] = [];

  const lpLeadTooltip = lpLeadActionsUsed.length > 0
    ? `Eventos somados: ${lpLeadActionsUsed.join(", ")} · excluindo campanhas apagadas/arquivadas (mesmo critério padrão do Gerenciador).`
    : `Excluindo campanhas apagadas/arquivadas (mesmo critério padrão do Gerenciador).`;

  const tabLeadsTooltip = `Soma de Forms nativo + Landing page por conta (eventos configurados em "Métricas personalizadas").`;
  const costPerLink = clickRef > 0 ? totalSpend / clickRef : 0;
  const tabConv = clickRef > 0 ? (tabLeads / clickRef) * 100 : 0;

  if (objective === "leads") {
    const cpl = tabLeads > 0 ? totalSpend / tabLeads : 0;
    kpis = [
      { title: "Leads", value: tabLeads, decimals: 0, icon: <Users className="h-4 w-4" />, tooltip: tabLeadsTooltip },
      { title: "Custo por Lead", value: cpl, prefix: "R$ ", decimals: 2, icon: <BarChart3 className="h-4 w-4" />, tooltip: tabLeadsTooltip },
      { title: "Custo por Clique no Link", value: costPerLink, prefix: "R$ ", decimals: 2, icon: <MousePointerClick className="h-4 w-4" /> },
      { title: "CTR", value: ctr, suffix: "%", decimals: 2, icon: <MousePointer className="h-4 w-4" /> },
      { title: "Taxa de Conversão", value: tabConv, suffix: "%", decimals: 2, icon: <ArrowRightLeft className="h-4 w-4" /> },
    ];
    funnelSteps = [
      { key: "impressions", label: "Impressões", value: totalImpressions, icon: <Eye className="h-5 w-5" />, color: "from-blue-500/20 to-blue-500/5", text: "text-blue-600" },
      { key: "link_clicks", label: "Cliques no link", value: clickRef, icon: <MousePointerClick className="h-5 w-5" />, color: "from-violet-500/20 to-violet-500/5", text: "text-violet-600" },
      { key: "leads", label: "Leads", value: tabLeads, icon: <Users className="h-5 w-5" />, color: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-600" },
      { key: "sales", label: "Vendas", value: confirmedCount, icon: <ShoppingBag className="h-5 w-5" />, color: "from-amber-500/20 to-amber-500/5", text: "text-amber-600" },
    ];
  } else if (objective === "native_form") {
    const lpvRate = objectiveMetrics.avgCTR;
    const costPerLPV = totalClicks > 0 ? totalSpend / totalClicks : 0;
    kpis = [
      { title: "Leads", value: nativeLeads, decimals: 0, icon: <Users className="h-4 w-4" /> },
      { title: "Custo por Lead", value: nativeLeads > 0 ? totalSpend / nativeLeads : 0, prefix: "R$ ", decimals: 2, icon: <BarChart3 className="h-4 w-4" /> },
      { title: "CTR", value: ctr, suffix: "%", decimals: 2, icon: <MousePointer className="h-4 w-4" /> },
      { title: "Taxa Visualização", value: lpvRate, suffix: "%", decimals: 2, icon: <Eye className="h-4 w-4" /> },
      { title: "Custo por Visualização", value: costPerLPV, prefix: "R$ ", decimals: 2, icon: <Eye className="h-4 w-4" /> },
      { title: "Conversão", value: clickRef > 0 ? (nativeLeads / clickRef) * 100 : 0, suffix: "%", decimals: 2, icon: <ArrowRightLeft className="h-4 w-4" /> },
    ];
    funnelSteps = [
      { key: "impressions", label: "Impressões", value: totalImpressions, icon: <Eye className="h-5 w-5" />, color: "from-blue-500/20 to-blue-500/5", text: "text-blue-600" },
      { key: "link_clicks", label: "Cliques no link", value: clickRef, icon: <MousePointerClick className="h-5 w-5" />, color: "from-violet-500/20 to-violet-500/5", text: "text-violet-600" },
      { key: "leads", label: "Leads", value: nativeLeads, icon: <Users className="h-5 w-5" />, color: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-600" },
      { key: "sales", label: "Vendas", value: confirmedCount, icon: <ShoppingBag className="h-5 w-5" />, color: "from-amber-500/20 to-amber-500/5", text: "text-amber-600" },
    ];
  } else if (objective === "landing_page") {
    const lpvRate = clickRef > 0 ? (lpViews / clickRef) * 100 : 0;
    const costPerLpView = lpViews > 0 ? totalSpend / lpViews : 0;
    const lpConv = lpViews > 0 ? (lpLeads / lpViews) * 100 : 0;
    const costPerLead = lpLeads > 0 ? totalSpend / lpLeads : 0;
    kpis = [
      { title: "Leads (Concluiu Forms)", value: lpLeads, decimals: 0, icon: <Users className="h-4 w-4" />, tooltip: lpLeadTooltip },
      { title: "Custo por Concluiu Forms", value: costPerLead, prefix: "R$ ", decimals: 2, icon: <BarChart3 className="h-4 w-4" />, tooltip: lpLeadTooltip },
      { title: "CTR", value: ctr, suffix: "%", decimals: 2, icon: <MousePointer className="h-4 w-4" /> },
      { title: "Taxa LP View", value: lpvRate, suffix: "%", decimals: 2, icon: <Eye className="h-4 w-4" /> },
      { title: "Custo por LP View", value: costPerLpView, prefix: "R$ ", decimals: 2, icon: <Eye className="h-4 w-4" /> },
      { title: "Conversão LP→Lead", value: lpConv, suffix: "%", decimals: 2, icon: <ArrowRightLeft className="h-4 w-4" /> },
    ];
    funnelSteps = [
      { key: "impressions", label: "Impressões", value: totalImpressions, icon: <Eye className="h-5 w-5" />, color: "from-blue-500/20 to-blue-500/5", text: "text-blue-600" },
      { key: "link_clicks", label: "Cliques no link", value: clickRef, icon: <MousePointerClick className="h-5 w-5" />, color: "from-violet-500/20 to-violet-500/5", text: "text-violet-600" },
      { key: "lp_view", label: "LP View", value: lpViews, icon: <Globe className="h-5 w-5" />, color: "from-cyan-500/20 to-cyan-500/5", text: "text-cyan-600" },
      { key: "leads", label: "Concluiu Forms", value: lpLeads, icon: <Users className="h-5 w-5" />, color: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-600" },
      { key: "sales", label: "Vendas", value: confirmedCount, icon: <ShoppingBag className="h-5 w-5" />, color: "from-amber-500/20 to-amber-500/5", text: "text-amber-600" },
    ];
  } else {
    // messages
    const conv = clickRef > 0 ? (messages / clickRef) * 100 : 0;
    const costPerMsg = messages > 0 ? totalSpend / messages : 0;
    kpis = [
      { title: "Mensagens", value: messages, decimals: 0, icon: <MessageCircle className="h-4 w-4" /> },
      { title: "Custo por Mensagem", value: costPerMsg, prefix: "R$ ", decimals: 2, icon: <BarChart3 className="h-4 w-4" /> },
      { title: "CTR", value: ctr, suffix: "%", decimals: 2, icon: <MousePointer className="h-4 w-4" /> },
      { title: "Conversão", value: conv, suffix: "%", decimals: 2, icon: <ArrowRightLeft className="h-4 w-4" /> },
    ];
    funnelSteps = [
      { key: "impressions", label: "Impressões", value: totalImpressions, icon: <Eye className="h-5 w-5" />, color: "from-blue-500/20 to-blue-500/5", text: "text-blue-600" },
      { key: "link_clicks", label: "Cliques no link", value: clickRef, icon: <MousePointerClick className="h-5 w-5" />, color: "from-violet-500/20 to-violet-500/5", text: "text-violet-600" },
      { key: "messages", label: "Mensagens", value: messages, icon: <MessageCircle className="h-5 w-5" />, color: "from-pink-500/20 to-pink-500/5", text: "text-pink-600" },
    ];
  }

  const stepOptions = funnelSteps.map((s) => ({ key: s.key, label: s.label }));
  const hidden = funnelHidden[objective] || [];
  const visibleStepKeys = funnelSteps.filter((s) => !hidden.includes(s.key)).map((s) => s.key);
  const handleStepsChange = (next: string[]) => {
    const removed = funnelSteps.map((s) => s.key).filter((k) => !next.includes(k));
    setFunnelHidden((prev) => ({ ...prev, [objective]: removed }));
  };

  const kpiGridCols = kpis.length >= 6 ? "lg:grid-cols-6" : kpis.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";

  return (
    <div className="space-y-6">
      {/* 1. KPIs principais */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <MetricCard title="Faturamento Líquido" value={salesMetrics.totalNet} icon={<DollarSign className="h-4 w-4" />} prefix="R$ " decimals={2} />
        <MetricCard title="Gastos com Anúncios" value={adMetrics.totalSpend} icon={<Coins className="h-4 w-4" />} prefix="R$ " decimals={2} />
        <MetricCard title="ROAS" value={roas} icon={<TrendingUp className="h-4 w-4" />} suffix="x" decimals={2} colorByValue />
        <MetricCard
          title="Lucro Líquido"
          value={profit}
          icon={<BarChart3 className="h-4 w-4" />}
          prefix="R$ "
          decimals={2}
          colorByValue
          tooltip="Faturamento líquido − gastos com anúncios − impostos. Não inclui custos de produto, equipe ou operação (não cadastrados no sistema)."
        />
      </div>

      {/* 2. KPIs financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PaymentChart byPayment={salesMetrics.byPayment} />

        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe2 className="h-4 w-4" /> Distribuição por Plataforma
              </CardTitle>
              {(() => {
                const totalSales = platformBreakdown.reduce((s, p) => s + p.sales, 0);
                const avgConv = totalPlatformLeads > 0 ? (totalSales / totalPlatformLeads) * 100 : 0;
                let label = "";
                if (platformView === "leads") label = `${totalPlatformLeads} leads`;
                else if (platformView === "revenue") label = `R$ ${totalPlatformRev.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                else label = `Conv. média ${avgConv.toFixed(2)}%`;
                return <span className="text-xs text-muted-foreground tabular-nums">{label}</span>;
              })()}
            </div>
            <Tabs value={platformView} onValueChange={(v) => setPlatformView(v as any)}>
              <TabsList className="h-8 w-full grid grid-cols-3">
                <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs">Receita</TabsTrigger>
                <TabsTrigger value="conv" className="text-xs">Conversão</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {(() => {
              const PLATFORM_ICONS: Record<TopPlatform, any> = {
                meta: Facebook,
                google: Chrome,
                organic: Globe,
                unknown: HelpCircle,
              };
              const isConv = platformView === "conv";
              const valueOf = (p: typeof platformBreakdown[number]) =>
                platformView === "leads" ? p.leads : platformView === "revenue" ? p.revenue : p.conv;
              const total = platformBreakdown.reduce((s, p) => s + valueOf(p), 0);
              const fmt = (v: number) =>
                platformView === "revenue"
                  ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : platformView === "conv"
                  ? `${v.toFixed(2)}%`
                  : v.toLocaleString("pt-BR");

              const chartData = platformBreakdown
                .map((p) => ({ name: p.name, key: p.key, value: valueOf(p) }))
                .filter((d) => d.value > 0);

              const maxConv = Math.max(...platformBreakdown.map((p) => p.conv), 0.0001);

              return (
                <div className="flex flex-col md:flex-row items-center gap-4">
                  {/* Left: donut (leads/revenue) or compact summary (conv) */}
                  {!isConv ? (
                    <div className="relative w-[170px] h-[170px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {chartData.map((d) => (
                              <Cell key={d.key} fill={PLATFORM_COLORS[d.key as TopPlatform]} />
                            ))}
                          </Pie>
                          <RTooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: any) => fmt(Number(v))}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</div>
                        <div className="text-sm font-semibold tabular-nums text-center px-2">{fmt(total)}</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Right: list */}
                  <div className={`flex-1 w-full space-y-1.5 ${isConv ? "" : "min-w-0"}`}>
                    {platformBreakdown
                      .filter((p) => !(isConv && p.key === "unknown"))
                      .map((p) => {
                      const v = valueOf(p);
                      const pct = !isConv && total > 0 ? (v / total) * 100 : 0;
                      const barPct = isConv ? (p.conv / maxConv) * 100 : pct;
                      const isUnknown = p.key === "unknown";
                      const color = PLATFORM_COLORS[p.key];
                      const Icon = PLATFORM_ICONS[p.key];
                      const Tag: any = isUnknown ? "div" : "button";
                      return (
                        <Tag
                          key={p.key}
                          {...(isUnknown ? {} : { onClick: () => setDrilldown(p.key as TopPlatform) })}
                          className={`w-full text-left rounded-md px-2 py-1.5 transition-colors ${isUnknown ? "" : "hover:bg-muted/40"}`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="text-xs font-medium truncate flex-1">{p.name}</div>
                            <div className="text-xs font-semibold tabular-nums shrink-0">{fmt(v)}</div>
                            {!isConv && (
                              <div className="text-[10px] text-muted-foreground tabular-nums w-10 text-right shrink-0">
                                {pct.toFixed(1)}%
                              </div>
                            )}
                          </div>
                          {isConv && (
                            <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                              <div
                                className="h-full rounded transition-all"
                                style={{ width: `${barPct}%`, backgroundColor: color }}
                              />
                            </div>
                          )}
                        </Tag>
                      );
                    })}
                    {(() => {
                      const unk = platformBreakdown.find((p) => p.key === "unknown");
                      if (!unk || (unk.sales === 0 && unk.revenue === 0)) return null;
                      return (
                        <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/40 pt-2">
                          {unk.sales} venda{unk.sales === 1 ? "" : "s"} sem plataforma identificada
                          ({fmt(unk.revenue)}). Atribua manualmente em <span className="font-medium">Campanhas → Vendas</span> para refinar.
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="Margem" value={profitMargin} icon={<Percent className="h-4 w-4" />} suffix="%" decimals={2} colorByValue />
          <MetricCard title="Recebíveis" value={salesMetrics.receivables} icon={<Receipt className="h-4 w-4" />} prefix="R$ " decimals={2} />
          <MetricCard title="Ticket Médio" value={ticketMedio} icon={<BadgeDollarSign className="h-4 w-4" />} prefix="R$ " decimals={2} />
          <MetricCard title="Lucro" value={profit} icon={<PiggyBank className="h-4 w-4" />} prefix="R$ " decimals={2} colorByValue />
        </div>
      </div>

      {/* 3. Performance das Campanhas */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-lg font-semibold">Performance de Campanhas</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <ObjectiveTabs value={objective} onChange={(v) => { setObjective(v); setPerfCampaignIds([]); }} />
            {objectiveCampaigns.length > 0 && (
              <CampaignMultiSelect
                campaigns={objectiveCampaigns}
                selectedIds={perfCampaignIds}
                onChange={setPerfCampaignIds}
                placeholder="Todas campanhas"
                className="h-8 text-xs min-w-[180px]"
              />
            )}
            <FunnelStepsSelect value={visibleStepKeys} onChange={handleStepsChange} options={stepOptions} />
          </div>
        </div>

        {objectiveInsights.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma campanha de {objective === "leads" ? "Leads" : objective === "native_form" ? "Formulário Nativo" : objective === "landing_page" ? "Landing page" : "Mensagens"} encontrada no período.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${kpiGridCols} sm:gap-3`}>
              {kpis.map((k) => (
                <MetricCard
                  key={k.title}
                  title={k.title}
                  value={k.value}
                  prefix={k.prefix}
                  suffix={k.suffix}
                  decimals={k.decimals}
                  icon={k.icon}
                  tooltip={k.tooltip}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. Funil de Conversão */}
      {objectiveInsights.length > 0 && (
        <CampaignFunnel steps={funnelSteps} visibleKeys={visibleStepKeys} />
      )}

      {/* 4.1 Origem geográfica (mapa por estado) */}
      <GeoOriginWidget />

      <PlatformDrilldownSheet platform={drilldown} onClose={() => setDrilldown(null)} />
      {dailyData.length > 0 && <PerformanceLineChart data={dailyData} />}

      {/* 5. Gráficos diários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ChartCard title="CPL Diário" data={dailyData} type="line" dataKey="cpl" formatLabel={(v: any) => `R$ ${Number(v).toFixed(2)}`} />
        <ChartCard title="Investimento Diário" data={dailyData} type="bar" dataKey="spend" color="hsl(221, 83%, 53%)" formatLabel={(v: any) => `R$ ${Number(v).toFixed(2)}`} />
        <ChartCard title={objective === "messages" ? "Mensagens por Dia" : "Leads por Dia"} data={dailyData} type="line" dataKey="leads" color="hsl(142, 71%, 45%)" />
        <ChartCard title={objective === "messages" ? "Conversão Clique → Mensagem" : "Conversão Clique → Lead"} data={dailyData} type="line" dataKey="conversion" color="hsl(38, 92%, 50%)" formatLabel={(v: any) => `${Number(v).toFixed(2)}%`} />
        <ChartCard title="CTR por Criativo" data={creativeData} type="bar" dataKey="ctr" xKey="name" color="hsl(262, 83%, 58%)" formatLabel={(v: any) => `${Number(v).toFixed(2)}%`} />
      </div>
    </div>
  );
}

export function CampaignsDetailWidget() {
  return <CampaignResultsTable />;
}
