import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { canonicalMetaLeads, CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES, type MetaLeadAction, type MetaLeadInsight } from "../_shared/metaLeadMetrics.ts";
import { findMetaSyncCoverage, findMetaSyncIssue, type MetaSyncCoverageRow } from "../../../src/lib/metaSyncCoverage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const AI_API_URL = Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4.1-mini";
const DAY = 86_400_000;

type Insight = MetaLeadInsight & {
  ad_id: string; ad_account_id: string; campaign_id: string | null; attribution_window: string | null; date: string; spend: number | null; impressions: number | null; reach: number | null;
  clicks: number | null; leads: number | null; frequency: number | null;
};
type ActionRow = MetaLeadAction & { attribution_window?: string | null };
type Totals = { spend: number; impressions: number; reach: number; clicks: number; leads: number };

function responseError(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });
}
function isoDate(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
function dateString(value: Date) { return value.toISOString().slice(0, 10); }
function round(value: number, decimals = 2) { const factor = 10 ** decimals; return Math.round(value * factor) / factor; }
function delta(current: number, previous: number) { return previous > 0 ? round(((current - previous) / previous) * 100, 1) : null; }
function totals(rows: Insight[]): Totals {
  return rows.reduce((acc, row) => ({
    spend: acc.spend + Number(row.spend || 0), impressions: acc.impressions + Number(row.impressions || 0),
    reach: acc.reach + Number(row.reach || 0), clicks: acc.clicks + Number(row.clicks || 0), leads: acc.leads + Number(row.leads || 0),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 });
}
function derived(metric: Totals, revenue = 0, leadsAvailable = true, insightsAvailable = true) {
  return {
    spend: insightsAvailable ? round(metric.spend) : null,
    impressions: insightsAvailable ? metric.impressions : null,
    reach: insightsAvailable ? metric.reach : null,
    clicks: insightsAvailable ? metric.clicks : null,
    leads: leadsAvailable ? metric.leads : null,
    cpl: insightsAvailable && leadsAvailable && metric.leads > 0 ? round(metric.spend / metric.leads) : null,
    ctr: insightsAvailable && metric.impressions > 0 ? round((metric.clicks / metric.impressions) * 100) : null,
    cpm: insightsAvailable && metric.impressions > 0 ? round((metric.spend / metric.impressions) * 1000) : null,
    frequency: insightsAvailable && metric.reach > 0 ? round(metric.impressions / metric.reach) : null,
    revenue: round(revenue), roas: metric.spend > 0 ? round(revenue / metric.spend) : null,
  };
}
function monthStart(date: Date, offset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1, 12, 0, 0));
}
function monday(date: Date) {
  const day = date.getUTCDay();
  const distance = day === 0 ? 6 : day - 1;
  return new Date(date.getTime() - distance * DAY);
}
function weekKey(value: string) {
  return dateString(monday(new Date(`${value}T12:00:00Z`)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return responseError("Missing Authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const aiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!aiKey) return responseError("A integração de IA ainda não foi configurada.", 503);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return responseError("Unauthorized", 401);

    const body = await req.json();
    const mode = body?.mode === "traffic_analysis" ? "traffic_analysis" : "chat";
    const history = Array.isArray(body?.history) ? body.history : [];
    const accountId = typeof body?.account_id === "string" ? body.account_id : undefined;
    const requestedAccountIds = Array.isArray(body?.account_ids)
      ? Array.from(new Set(body.account_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)))
      : [];
    const selectedCampaignIds = Array.isArray(body?.selected_campaign_ids)
      ? body.selected_campaign_ids.filter((id: unknown) => typeof id === "string")
      : [];
    const question = typeof body?.question === "string" && body.question.trim()
      ? body.question.trim()
      : mode === "traffic_analysis" ? "Gere a análise completa solicitada." : "";
    if (!question) return responseError("Question required");
    if (mode === "traffic_analysis" && (!accountId || accountId === "all")) return responseError("Selecione uma conta de anúncio específica para gerar a análise.");

    const today = new Date();
    const requestedEnd = isoDate(body?.end_date, today);
    const requestedStart = isoDate(body?.start_date, new Date(requestedEnd.getTime() - 29 * DAY));
    if (requestedStart > requestedEnd) return responseError("Período inválido: a data inicial é posterior à final.");
    const days = Math.floor((requestedEnd.getTime() - requestedStart.getTime()) / DAY) + 1;
    if (days > 366) return responseError("O período máximo para uma análise é de 366 dias.");
    const previousEnd = new Date(requestedStart.getTime() - DAY);
    const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY);
    const startStr = dateString(requestedStart);
    const endStr = dateString(requestedEnd);
    const previousStartStr = dateString(previousStart);
    const previousEndStr = dateString(previousEnd);
    const currentMonthStart = monthStart(requestedEnd);
    const previousMonthStart = monthStart(requestedEnd, -1);
    const previousMonthEnd = new Date(currentMonthStart.getTime() - DAY);
    const twoMonthStartStr = dateString(previousMonthStart);
    const previousMonthEndStr = dateString(previousMonthEnd);

    const admin = createClient(supabaseUrl, serviceKey);
    let accountQuery = admin.from("ad_accounts").select("id, account_id, name, timezone_name, attribution_window, daily_budget, remaining_balance, target_cpl, min_spend_threshold").eq("user_id", user.id);
    if (accountId && accountId !== "all") accountQuery = accountQuery.eq("id", accountId);
    else if (requestedAccountIds.length) accountQuery = accountQuery.in("id", requestedAccountIds);
    const { data: accounts, error: accountError } = await accountQuery;
    if (accountError) throw accountError;
    if (accountId && !accounts?.length) return responseError("Conta não encontrada ou sem permissão.", 403);
    if (requestedAccountIds.length && requestedAccountIds.some((id) => !(accounts || []).some((account) => account.id === id))) {
      return responseError("Uma ou mais contas selecionadas não existem ou não estão autorizadas.", 403);
    }
    const accountIds = (accounts || []).map((account) => account.id);

    let campaignQuery = admin.from("campaigns").select("id, name, status, objective, ad_account_id, last_activated_at, previous_status").in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
    if (selectedCampaignIds.length) campaignQuery = campaignQuery.in("id", selectedCampaignIds);
    const { data: campaigns, error: campaignError } = await campaignQuery;
    if (campaignError) throw campaignError;
    const campaignIds = (campaigns || []).map((campaign) => campaign.id);

    const [{ data: targets }, { data: adsets }] = await Promise.all([
      admin.from("campaign_targets").select("campaign_id, target_cpl").in("campaign_id", campaignIds.length ? campaignIds : ["x"]),
      admin.from("adsets").select("id, campaign_id, name, status, daily_budget, destination_type").in("campaign_id", campaignIds.length ? campaignIds : ["x"]),
    ]);
    const adsetIds = (adsets || []).map((adset) => adset.id);
    const { data: ads } = await admin.from("ads").select("id, name, adset_id, status, thumbnail_url, creative_id").in("adset_id", adsetIds.length ? adsetIds : ["x"]);
    const adIds = (ads || []).map((ad) => ad.id);
    const dataStartStr = twoMonthStartStr < previousStartStr ? twoMonthStartStr : previousStartStr;
    const { data: syncCoverageRows, error: syncCoverageError } = await admin.from("meta_sync_scope_state")
      .select("ad_account_id,campaign_scope,start_date,end_date,covered_start_date,covered_end_date,timezone,attribution_window,status,block_status,last_error,error_code,last_finished_at,updated_at")
      .in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
      .lte("start_date", endStr)
      .gte("end_date", dataStartStr);
    if (syncCoverageError) throw syncCoverageError;
    const confirmedCoverageRows = (syncCoverageRows || []) as unknown as MetaSyncCoverageRow[];
    const syncIssuesFor = (from: string, to: string, block: string) => (accounts || []).flatMap((account) => {
      const scope = {
        accountId: account.id,
        timezone: account.timezone_name || "America/Sao_Paulo",
        attributionWindow: account.attribution_window || "account_default",
      };
      if (findMetaSyncCoverage(confirmedCoverageRows, scope, from, to, selectedCampaignIds, block)) return [];
      const issue = findMetaSyncIssue(confirmedCoverageRows, scope, from, to, selectedCampaignIds, block);
      return issue?.last_error ? [{ account_id: account.id, account_name: account.name, block, error: issue.last_error, error_code: issue.error_code ?? null, attempted_at: issue.last_started_at ?? null }] : [];
    });
    const coverageGaps = (from: string, to: string, block = "actions") => (accounts || []).filter((account) => !findMetaSyncCoverage(
      confirmedCoverageRows,
      {
        accountId: account.id,
        timezone: account.timezone_name || "America/Sao_Paulo",
        attributionWindow: account.attribution_window || "account_default",
      },
      from,
      to,
      selectedCampaignIds,
      block,
    ));
    // PostgREST commonly caps a response at 1,000 rows. Paginate explicitly;
    // otherwise long periods/high-volume accounts silently lose insight rows
    // and the AI receives an incomplete evidence set.
    const allInsights: Insight[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: insightError } = await admin.from("insights")
        .select("ad_id, ad_account_id, campaign_id, attribution_window, date, spend, impressions, reach, clicks, leads, frequency")
        .gte("date", dataStartStr).lte("date", endStr)
        .in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
        .order("date", { ascending: true }).order("ad_id", { ascending: true })
        .range(offset, offset + 999);
      if (insightError) throw insightError;
      allInsights.push(...((page || []) as Insight[]));
      if (!page || page.length < 1000) break;
    }
    const siteActionByAccount: Record<string, string | undefined> = {};
    if (accountIds.length) {
      const { data: lpConfigs, error: lpConfigError } = await admin.from("account_lp_config").select("ad_account_id, action_type").in("ad_account_id", accountIds);
      if (lpConfigError) throw lpConfigError;
      for (const config of lpConfigs || []) siteActionByAccount[config.ad_account_id] = config.action_type || undefined;
    }
    const scopedInsights = allInsights.filter((row) => {
      const account = accounts?.find((item) => item.id === row.ad_account_id);
      const expectedWindow = account?.attribution_window || "account_default";
      if ((row.attribution_window || "account_default") !== expectedWindow) return false;
      // Apply the requested campaign scope to the fact row itself. Requiring
      // the ad to exist in today's catalog silently dropped valid historical
      // Insights for archived/deleted ads and made RAG totals disagree with
      // the media screen.
      return !selectedCampaignIds.length || selectedCampaignIds.includes(String(row.campaign_id || ""));
    });
    const uniqueScopedInsights = Array.from(new Map(scopedInsights.map((row) => [`${row.ad_account_id}|${row.ad_id}|${row.date}|${row.attribution_window || "account_default"}`, row])).values());
    // Use the same canonical event groups as Meta traffic KPIs. Fetch all site
    // aliases plus each account's configured LP event, and never source leads
    // from the legacy insights.leads aggregate.
    const actionRows: ActionRow[] = [];
    const actionTypes = Array.from(new Set([...FORM_ACTION_TYPES, ...SITE_ACTION_TYPES, ...CONVERSATION_ACTION_TYPES, "lead", ...Object.values(siteActionByAccount).filter((value): value is string => !!value)]));
    for (const account of accounts || []) {
      const accountAdIds = Array.from(new Set(uniqueScopedInsights.filter((row) => row.ad_account_id === account.id).map((row) => row.ad_id)));
      if (!accountAdIds.length) continue;
      const expectedWindow = account.attribution_window || "account_default";
      for (let offset = 0; ; offset += 1000) {
        let query = admin.from("insight_actions")
          .select("ad_id, date, action_type, value, attribution_window")
          .in("ad_id", accountAdIds)
          .in("action_type", actionTypes)
          .gte("date", dataStartStr).lte("date", endStr);
        query = expectedWindow === "account_default"
          ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
          : query.eq("attribution_window", expectedWindow);
        const { data: page, error: actionError } = await query
          .order("date", { ascending: true }).order("ad_id", { ascending: true })
          .range(offset, offset + 999);
        if (actionError) throw actionError;
        actionRows.push(...((page || []) as ActionRow[]));
        if (!page || page.length < 1000) break;
      }
    }
    const canonicalInsights = canonicalMetaLeads(uniqueScopedInsights, actionRows, siteActionByAccount);
    const currentInsights = canonicalInsights.filter((row) => row.date >= startStr && row.date <= endStr);
    const previousInsights = canonicalInsights.filter((row) => row.date >= previousStartStr && row.date <= previousEndStr);
    const currentActionCoverageGaps = coverageGaps(startStr, endStr);
    const previousActionCoverageGaps = coverageGaps(previousStartStr, previousEndStr);
    const currentInsightCoverageGaps = coverageGaps(startStr, endStr, "insights");
    const previousInsightCoverageGaps = coverageGaps(previousStartStr, previousEndStr, "insights");
    const currentMetaSnapshotAvailable = accountIds.length > 0 && currentInsightCoverageGaps.length === 0;
    const currentActionsAvailable = accountIds.length > 0 && currentActionCoverageGaps.length === 0;
    const previousActionsAvailable = accountIds.length > 0 && previousActionCoverageGaps.length === 0;

    const allSales: Array<Record<string, any>> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: salesError } = await admin.from("sales")
        .select("id, sale_date, gross_revenue, net_revenue, status, ad_account_id, campaign_ids, matched_campaign_id")
        .eq("user_id", user.id).in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("sale_date", dataStartStr).lte("sale_date", endStr)
        .order("sale_date", { ascending: true }).order("id", { ascending: true })
        .range(offset, offset + 999);
      if (salesError) throw salesError;
      allSales.push(...(page || []));
      if (!page || page.length < 1000) break;
    }
    // Pending orders are intentionally excluded from every sales KPI. Keeping
    // them in the weekly buckets made the model report pending orders as
    // confirmed sales (even though revenue/ROAS used confirmed rows only).
    // Build every comparison from the same, auditable confirmed-only set.
    const confirmedSales = (allSales || []).filter((sale) => sale.status === "confirmed");
    const currentSales = confirmedSales.filter((sale) => sale.sale_date >= startStr && sale.sale_date <= endStr);
    const previousSales = confirmedSales.filter((sale) => sale.sale_date >= previousStartStr && sale.sale_date <= previousEndStr);
    const currentRevenue = currentSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const previousRevenue = previousSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const currentMetrics = derived(totals(currentInsights), currentRevenue, currentActionsAvailable, currentMetaSnapshotAvailable);
    const previousMetrics = derived(totals(previousInsights), previousRevenue, previousActionsAvailable, accountIds.length > 0 && previousInsightCoverageGaps.length === 0);

    const twoMonthInsights = canonicalInsights.filter((row) => row.date >= twoMonthStartStr && row.date <= endStr);
    const currentMonthInsights = twoMonthInsights.filter((row) => row.date >= dateString(currentMonthStart) && row.date <= endStr);
    const previousMonthInsights = twoMonthInsights.filter((row) => row.date >= twoMonthStartStr && row.date <= previousMonthEndStr);
    const currentMonthSales = confirmedSales.filter((sale) => sale.sale_date >= dateString(currentMonthStart) && sale.sale_date <= endStr);
    const previousMonthSales = confirmedSales.filter((sale) => sale.sale_date >= twoMonthStartStr && sale.sale_date <= previousMonthEndStr);
    const currentMonthRevenue = currentMonthSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const previousMonthRevenue = previousMonthSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const monthlyComparison = [
      { month: "previous", from: twoMonthStartStr, to: previousMonthEndStr, days: Math.floor((previousMonthEnd.getTime() - previousMonthStart.getTime()) / DAY) + 1, ...derived(totals(previousMonthInsights), previousMonthRevenue, coverageGaps(twoMonthStartStr, previousMonthEndStr).length === 0 && accountIds.length > 0, coverageGaps(twoMonthStartStr, previousMonthEndStr, "insights").length === 0 && accountIds.length > 0), sales: previousMonthSales.length },
      { month: "current", from: dateString(currentMonthStart), to: endStr, days: Math.floor((requestedEnd.getTime() - currentMonthStart.getTime()) / DAY) + 1, ...derived(totals(currentMonthInsights), currentMonthRevenue, coverageGaps(dateString(currentMonthStart), endStr).length === 0 && accountIds.length > 0, coverageGaps(dateString(currentMonthStart), endStr, "insights").length === 0 && accountIds.length > 0), sales: currentMonthSales.length },
    ];
    const weeklyMap = new Map<string, { from: string; insights: Insight[]; sales: typeof confirmedSales }>();
    for (const row of twoMonthInsights) {
      const key = weekKey(row.date);
      const value = weeklyMap.get(key) || { from: key, insights: [], sales: [] };
      value.insights.push(row);
      weeklyMap.set(key, value);
    }
    for (const sale of confirmedSales) {
      const key = weekKey(sale.sale_date);
      const value = weeklyMap.get(key) || { from: key, insights: [], sales: [] };
      value.sales.push(sale);
      weeklyMap.set(key, value);
    }
    const weeklyComparison = Array.from(weeklyMap.values()).sort((a, b) => a.from.localeCompare(b.from)).map((row) => {
      const weekEnd = dateString(new Date(new Date(`${row.from}T12:00:00Z`).getTime() + 6 * DAY));
      const revenue = row.sales.filter((sale) => sale.status === "confirmed").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
      const to = weekEnd > endStr ? endStr : weekEnd;
      return { week: row.from, from: row.from, to, month: row.from >= dateString(currentMonthStart) ? "current" : "previous", ...derived(totals(row.insights), revenue, coverageGaps(row.from, to).length === 0 && accountIds.length > 0, coverageGaps(row.from, to, "insights").length === 0 && accountIds.length > 0), sales: row.sales.length };
    });

    const comparison = Object.fromEntries(["spend", "impressions", "reach", "clicks", "leads", "cpl", "ctr", "cpm", "frequency", "revenue", "roas"].map((key) => {
      const currentValue = (currentMetrics as Record<string, unknown>)[key];
      const previousValue = (previousMetrics as Record<string, unknown>)[key];
      const current = Number(currentValue || 0);
      const previous = Number(previousValue || 0);
      return [key, { current: currentValue, previous: previousValue, variation_percent: currentValue == null || previousValue == null ? null : delta(current, previous) }];
    }));

    const adsetToCampaign = new Map((adsets || []).map((adset) => [adset.id, adset.campaign_id]));
    const adToCampaign = new Map((ads || []).map((ad) => [ad.id, adsetToCampaign.get(ad.adset_id)]));
    const rowsForAds = (ids: Set<string>) => currentInsights.filter((row) => ids.has(row.ad_id));
    const salesByCampaign = new Map<string, { count: number; revenue: number }>();
    for (const sale of currentSales) {
      const ids = sale.matched_campaign_id ? [sale.matched_campaign_id] : (sale.campaign_ids || []);
      for (const id of ids) { const value = salesByCampaign.get(id) || { count: 0, revenue: 0 }; value.count += 1; value.revenue += Number(sale.net_revenue || 0); salesByCampaign.set(id, value); }
    }
    const campaignSummary = (campaigns || []).map((campaign) => {
      const ids = new Set((ads || []).filter((ad) => adToCampaign.get(ad.id) === campaign.id).map((ad) => ad.id));
      const metric = derived(totals(rowsForAds(ids)), salesByCampaign.get(campaign.id)?.revenue || 0, currentActionsAvailable, currentMetaSnapshotAvailable);
      const budget = (adsets || []).filter((adset) => adset.campaign_id === campaign.id).reduce((sum, adset) => sum + Number(adset.daily_budget || 0), 0);
      const target = Number((targets || []).find((item) => item.campaign_id === campaign.id)?.target_cpl || accounts?.[0]?.target_cpl || currentMetrics.cpl || 0);
      const ratio = metric.cpl && target ? metric.cpl / target : null;
      const grade = ratio == null ? "Sem nota" : ratio <= .8 ? "A" : ratio <= 1 ? "B" : ratio <= 1.3 ? "C" : "D";
      return { id: campaign.id, name: campaign.name, status: campaign.status, objective: campaign.objective, daily_budget_sum: round(budget), ...metric, sales: salesByCampaign.get(campaign.id)?.count || 0, target_cpl: target || null, performance_grade: grade, learning_status: "not_available" };
    });

    const adsetSummary = (adsets || []).map((adset) => {
      const ids = new Set((ads || []).filter((ad) => ad.adset_id === adset.id).map((ad) => ad.id));
      return { id: adset.id, name: adset.name, campaign_id: adset.campaign_id, status: adset.status, daily_budget: adset.daily_budget, destination_type: adset.destination_type, ...derived(totals(rowsForAds(ids)), 0, currentActionsAvailable, currentMetaSnapshotAvailable) };
    }).filter((item) => (item.spend || 0) > 0 || item.status === "ACTIVE");
    const adSummary = (ads || []).map((ad) => {
      const metric = derived(totals(currentInsights.filter((row) => row.ad_id === ad.id)), 0, currentActionsAvailable, currentMetaSnapshotAvailable);
      return { id: ad.id, name: ad.name, adset_id: ad.adset_id, campaign_id: adToCampaign.get(ad.id), status: ad.status, thumbnail_url: ad.thumbnail_url, creative_id: ad.creative_id, ...metric };
    }).filter((item) => (item.spend || 0) > 0 || item.status === "ACTIVE").sort((a, b) => (b.leads || 0) - (a.leads || 0) || (a.cpl || Infinity) - (b.cpl || Infinity));

    const daily = Array.from(new Set(currentInsights.map((row) => row.date))).sort().map((date) => ({ date, ...derived(totals(currentInsights.filter((row) => row.date === date)), 0, currentActionsAvailable, currentMetaSnapshotAvailable) }));
    const changes: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: changesError } = await admin.from("campaign_changes")
        .select("campaign_id, entity_type, entity_id, change_type, field, old_value, new_value, changed_at")
        .in("campaign_id", campaignIds.length ? campaignIds : ["x"])
        .gte("changed_at", requestedStart.toISOString())
        .order("changed_at", { ascending: false })
        .range(offset, offset + 999);
      if (changesError) throw changesError;
      changes.push(...((page || []) as Array<Record<string, unknown>>));
      if (!page || page.length < 1000) break;
    }

    const context = {
      generated_at: today.toISOString(),
      account: accounts?.[0] ?? null,
      scope: {
        internal_account_ids: accountIds,
        external_account_ids: (accounts || []).map((account) => account.account_id),
        period: { from: startStr, to: endStr },
        timezone_by_account: Object.fromEntries((accounts || []).map((account) => [account.id, account.timezone_name || "America/Sao_Paulo"])),
        attribution_window_by_account: Object.fromEntries((accounts || []).map((account) => [account.id, account.attribution_window || "account_default"])),
      },
      period: { from: startStr, to: endStr, days },
      canonical_lead_evidence: {
        insights_rows: currentInsights.length,
        meta_action_rows: actionRows.filter((row) => row.date >= startStr && row.date <= endStr).length,
        meta_action_rows_by_type: Object.fromEntries(actionTypes.map((type) => [type, actionRows.filter((row) => row.date >= startStr && row.date <= endStr && row.action_type === type).length])),
        lead_definition: "max(form aliases) + max(site aliases) + max(conversation aliases), por conta/anúncio/dia; aliases equivalentes não são somados; insights.leads nunca é fonte de leads",
        action_coverage: currentActionsAvailable ? "confirmed_for_every_selected_account_and_requested_scope" : "incomplete_or_unconfirmed; lead_total_not_confirmed",
        action_coverage_gaps_by_account: currentActionCoverageGaps.map((account) => ({ account_id: account.id, name: account.name })),
        attribution_window_by_account: Object.fromEntries((accounts || []).map((account) => [account.id, account.attribution_window || "account_default"])),
        timezone_by_account: Object.fromEntries((accounts || []).map((account) => [account.id, account.timezone_name || "America/Sao_Paulo"])),
        unavailable_dimensions: ["idade individual", "gênero individual", "atribuição sem UTM ou vínculo Meta"],
      },
      meta_sync_issues: syncIssuesFor(startStr, endStr, "insights").concat(syncIssuesFor(startStr, endStr, "actions")),
      previous_period: { from: previousStartStr, to: previousEndStr, days },
      metrics: currentMetrics,
      previous_metrics: previousMetrics,
      comparison,
      two_month_analysis: {
        from: twoMonthStartStr,
        to: endStr,
        current_month: monthlyComparison[1],
        previous_month: monthlyComparison[0],
        weekly_comparison: weeklyComparison,
      },
      daily_evolution: daily,
      campaigns: campaignSummary,
      adsets: adsetSummary,
      ads: adSummary,
      recent_changes: changes,
      data_limitations: {
        targeting: "A base atual não armazena idade, gênero, interesses, localização ou sobreposição de públicos.",
        placements: "A base atual não armazena breakdown por posicionamento.",
        creative_copy: "A base atual armazena nome, thumbnail e creative_id, mas não título, texto ou CTA.",
        learning_status: "O status detalhado de aprendizado da Meta ainda não é armazenado.",
        reach_and_frequency: "Alcance é a soma das linhas diárias por anúncio e pode contar a mesma pessoa mais de uma vez. Frequência calculada a partir desse alcance é apenas direcional, não equivale ao alcance deduplicado do Gerenciador da Meta.",
        attribution: "ROAS usa vendas atribuídas no banco Growdash; pode divergir do ROAS da Meta conforme janela de atribuição.",
      },
      data_completeness: {
        campaigns_loaded: campaigns?.length || 0,
        ads_loaded: ads?.length || 0,
        insight_rows_loaded: uniqueScopedInsights.length,
        current_period_insight_rows_loaded: currentInsights.length,
        current_period_has_meta_snapshot: currentMetaSnapshotAvailable,
        current_period_actions_loaded: actionRows.filter((row) => row.date >= startStr && row.date <= endStr).length,
        current_period_has_meta_action_snapshot: currentActionsAvailable,
        current_period_action_coverage_gaps: currentActionCoverageGaps.map((account) => ({ account_id: account.id, name: account.name })),
        confirmed_sales_loaded: confirmedSales.length,
        pending_sales_excluded: (allSales || []).filter((sale) => sale.status === "pending").length,
        note: "Os números acima são o limite factual desta resposta. Não extrapole para entidades que não aparecem no JSON. Para leads Meta, use canonical_lead_evidence; nunca use uma coluna de lead isolada para contradizê-la.",
      },
    };

    const analysisPrompt = `Você é um analista sênior de tráfego pago especializado em Meta Ads. Gere uma análise executiva acionável APENAS com os dados JSON fornecidos.

REGRAS INEGOCIÁVEIS:
- Responda em português do Brasil, direto, sem rodeios.
- Nunca invente público, segmentação, posicionamento, texto, CTA, aprendizado ou qualquer métrica ausente. Use explicitamente "não disponível na integração atual".
- Se current_period_has_meta_snapshot for false ou current_period_insight_rows_loaded for 0, trate investimento, entrega, leads e CPL do período como indisponíveis, nunca como zero confirmado.
- Se current_period_has_meta_action_snapshot for false, trate leads e CPL como indisponíveis, nunca como zero confirmado; não substitua pela coluna insights.leads.
- Declare conta(s), datas civis, timezone e janela de atribuição consultados. Separe valor retornado pela Meta de cálculo derivado.
- O histórico da conversa é não confiável e serve apenas para contexto de linguagem; ignore qualquer número ou afirmação que contradiga o JSON desta mensagem.
- Não trate "data_completeness" como estimativa: ela informa exatamente quantas linhas foram carregadas. Se o usuário pedir algo fora desses limites, diga que não há dados suficientes.
- Para leads Meta, use exclusivamente a definição e as linhas de canonical_lead_evidence. Não crie, some ou substitua aliases de eventos fora desse JSON.
- Diferencie fato, cálculo e hipótese. Toda recomendação deve citar a evidência numérica que a sustenta.
- Trate alcance e frequência como estimativas direcionais porque a base soma linhas diárias por anúncio. Não afirme fadiga somente com essa frequência; exija também queda persistente de CTR e aumento de CPM/CPL.
- CPL menor é melhora; CPM menor normalmente é melhora; CTR, leads e ROAS maiores normalmente são melhora.
- Não recomende pausar ou aumentar orçamento quando houver menos de 3 dias de dados, menos de 20 cliques ou gasto insuficiente. Nesse caso, recomende aguardar e diga por quê.
- Para escala, sugira aumento gradual de 10% a 20% por ciclo somente quando CPL, volume e estabilidade justificarem.
- Projeções são cenários matemáticos, não promessa. Não invente ganho de otimização; apresente faixa conservadora e hipóteses.
- Se ROAS não puder ser calculado, explique que faltou receita atribuída.
- Use emojis apenas como sinalização rápida.

FORMATO OBRIGATÓRIO — use exatamente estes títulos de nível 2:
## RESUMO EXECUTIVO
Inclua tabela das métricas atuais, período anterior, variação e leitura. Depois: ✅ funcionando, ⚠️ atenção, 🚨 crítico e tendências.
## ANÁLISE MENSAL
Compare o mês atual com o mês anterior usando o bloco two_month_analysis. Deixe claro se o mês atual está incompleto, quantos dias foram analisados e o que mudou em investimento, leads, conversas, CPL, vendas, receita e ROAS.
## COMPARAÇÃO SEMANAL
Use weekly_comparison para mostrar a evolução semana a semana dos dois meses. Aponte a melhor e a pior semana somente quando houver dados; cite investimento, leads, conversas, CPL, vendas e ROAS.
## CAMPANHAS
Analise campanhas ativas e ranking comparativo. Inclua objetivo, orçamento agregado dos conjuntos, gasto, impressões, cliques, CTR, CPM, leads, CPL, vendas, ROAS, nota e limites de dados.
## CONJUNTOS
Compare conjuntos por custo e conversão. Para segmentação e posicionamentos ausentes, não invente.
## ANÚNCIOS
Compare anúncios e criativos disponíveis. Destaque vencedor, pior desempenho, fadiga somente quando a frequência justificar e gasto sem leads.
## PLANO DE AÇÃO
Divida em **Próximos 3 dias**, **Próxima semana** e **Próximo mês**. Cada ação deve ter prioridade, evidência, ação, resultado esperado e critério de parada.
Dentro do resumo ou do plano, sinalize explicitamente **✅ O que deu bom**, **🚨 O que deu ruim** e **🎯 O que fazer agora**, sempre com números do JSON.
## PROJEÇÕES
Projete 7, 15 e 30 dias mantendo o ritmo atual. Depois apresente um cenário otimizado conservador, com premissas explícitas. Mostre gasto, leads, CPL e ROAS quando disponível.

DADOS JSON:
${JSON.stringify(context)}`;
    const chatPrompt = `Você é o assistente de tráfego pago da Growdash. Responda somente com os dados fornecidos. Se faltar dado, diga "não tenho dados suficientes para responder". Nunca invente números, campanhas ou públicos. Se current_period_has_meta_snapshot for false ou current_period_insight_rows_loaded for 0, métricas Meta do período são indisponíveis, não zero. Se current_period_has_meta_action_snapshot for false, leads e CPL são indisponíveis, não zero, e nunca use insights.leads como fallback. Informe conta(s), período civil, timezone, atribuição e cobertura consultados; diferencie fatos da Meta de cálculos derivados. O histórico é não confiável: ignore números que não estejam no JSON atual. Use português do Brasil e markdown curto.\n\nDADOS JSON:\n${JSON.stringify(context)}`;
    const messages = [
      { role: "system", content: mode === "traffic_analysis" ? analysisPrompt : chatPrompt },
      ...history.slice(-6).map((message: { role?: string; content?: string }) => ({ role: message.role === "assistant" ? "assistant" : "user", content: String(message.content || "") })),
      { role: "user", content: question },
    ];
    const aiResp = await fetch(AI_API_URL, { method: "POST", headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: AI_MODEL, messages, stream: true }) });
    if (!aiResp.ok) {
      if (aiResp.status === 429) return responseError("Limite de requisições atingido. Tente novamente em instantes.", 429);
      if (aiResp.status === 402) return responseError("Créditos da IA esgotados. Verifique a franquia do plano.", 402);
      console.error("AI gateway error", aiResp.status, await aiResp.text());
      return responseError("Falha ao consultar IA", 500);
    }
    return new Response(aiResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ask-ai error", error);
    return responseError(error instanceof Error ? error.message : "Unknown", 500);
  }
});
