import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { canonicalMetaLeads, META_LEAD_ACTION_TYPES } from "../_shared/metaLeadMetrics.ts";
import { loadSiteEligibleMetaAdScopes } from "../_shared/metaLeadScope.ts";
import { findMetaSyncCoverage, findMetaSyncIssue, type MetaSyncCoverageRow } from "../../../src/lib/metaSyncCoverage.ts";
import { normalizeMetaAttributionWindow } from "../../../src/lib/metaInsightFacts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const protocolVersion = "2025-03-26";
const PAGE_SIZE = 1000;

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function actionTypes(siteActions: string[]) {
  return Array.from(new Set([...META_LEAD_ACTION_TYPES, ...siteActions]));
}

type AccountCoverage = {
  status: string;
  insight_rows: number;
  action_rows: number;
  blocks: { insights: string; actions: string };
  sync_issue?: { insights?: string; actions?: string };
  [key: string]: unknown;
};

async function readPages(query: any) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readMetaMetrics(admin: any, userId: string, args: Record<string, unknown>) {
  const accountIds = Array.isArray(args.account_ids)
    ? Array.from(new Set(args.account_ids.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];
  const campaignIds = Array.isArray(args.campaign_ids)
    ? Array.from(new Set(args.campaign_ids.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];
  const startDate = args.start_date;
  const endDate = args.end_date;
  if (!accountIds.length) throw new Error("account_ids precisa conter pelo menos um UUID interno autorizado.");
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error("start_date e end_date devem ser datas civis válidas e inclusivas (YYYY-MM-DD).");

  const { data: accounts, error: accountsError } = await admin.from("ad_accounts")
    .select("id,name,account_id,timezone_name,attribution_window")
    .eq("user_id", userId).in("id", accountIds);
  if (accountsError) throw accountsError;
  if ((accounts || []).length !== accountIds.length) throw new Error("Uma ou mais contas não existem ou não estão autorizadas.");

  const { data: lpConfigs, error: configError } = await admin.from("account_lp_config")
    .select("ad_account_id,action_type").in("ad_account_id", accountIds);
  if (configError) throw configError;
  const siteActionByAccount = Object.fromEntries((lpConfigs || []).map((row: any) => [row.ad_account_id, row.action_type || undefined]));
  const { data: syncCoverageRows, error: syncCoverageError } = await admin.from("meta_sync_scope_state")
    .select("ad_account_id,campaign_scope,start_date,end_date,covered_start_date,covered_end_date,timezone,attribution_window,status,block_status,last_error,error_code,last_finished_at,updated_at")
    .in("ad_account_id", accountIds)
    .lte("start_date", endDate)
    .gte("end_date", startDate);
  if (syncCoverageError) throw syncCoverageError;
  const coverageRows = (syncCoverageRows || []) as unknown as MetaSyncCoverageRow[];
  const insights: any[] = [];
  const actions: any[] = [];
  const accountCoverage: Record<string, AccountCoverage> = {};

  for (const account of accounts || []) {
    const attributionWindow = account.attribution_window || "account_default";
    let insightQuery = admin.from("insights")
      .select("ad_account_id,ad_id,adset_id,campaign_id,date,attribution_window,spend,impressions,reach,clicks")
      .eq("ad_account_id", account.id).gte("date", startDate).lte("date", endDate)
      .order("date", { ascending: true }).order("ad_id", { ascending: true });
    if (campaignIds.length) insightQuery = insightQuery.in("campaign_id", campaignIds);
    const accountInsights = await readPages(insightQuery);
    const correctInsights = accountInsights.filter((row) => normalizeMetaAttributionWindow(row.attribution_window) === normalizeMetaAttributionWindow(attributionWindow));
    const uniqueInsights = Array.from(new Map(correctInsights.map((row) => [`${row.ad_account_id}|${row.ad_id}|${row.date}|${row.attribution_window || "account_default"}`, row])).values());
    insights.push(...uniqueInsights);
    const accountScope = { accountId: account.id, timezone: account.timezone_name || "America/Sao_Paulo", attributionWindow };
    const insightScopeConfirmed = Boolean(findMetaSyncCoverage(coverageRows, accountScope, startDate, endDate, campaignIds, "insights"));
    const actionScopeConfirmed = Boolean(findMetaSyncCoverage(coverageRows, accountScope, startDate, endDate, campaignIds, "actions"));
    const insightIssue = !insightScopeConfirmed ? findMetaSyncIssue(coverageRows, accountScope, startDate, endDate, campaignIds, "insights") : null;
    const actionIssue = !actionScopeConfirmed ? findMetaSyncIssue(coverageRows, accountScope, startDate, endDate, campaignIds, "actions") : null;

    const adIds = Array.from(new Set(uniqueInsights.map((row) => row.ad_id).filter(Boolean)));
    let accountActions: any[] = [];
    for (let index = 0; index < adIds.length; index += 200) {
      let query = admin.from("insight_actions").select("ad_account_id,ad_id,date,action_type,value,attribution_window")
        .eq("ad_account_id", account.id)
        .in("ad_id", adIds.slice(index, index + 200)).in("action_type", actionTypes(siteActionByAccount[account.id] ? [siteActionByAccount[account.id]] : []))
        .gte("date", startDate).lte("date", endDate).order("date", { ascending: true });
      query = attributionWindow === "account_default"
        ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
        : query.eq("attribution_window", attributionWindow);
      accountActions.push(...await readPages(query));
    }
    actions.push(...accountActions);

    const siteScope = await loadSiteEligibleMetaAdScopes(admin, uniqueInsights);
    const canonical = canonicalMetaLeads(uniqueInsights, accountActions, { [account.id]: siteActionByAccount[account.id] }, siteScope.scopes, siteScope.conversationScopes);
    const spend = uniqueInsights.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const impressions = uniqueInsights.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    const reach = uniqueInsights.reduce((sum, row) => sum + Number(row.reach || 0), 0);
    const clicks = uniqueInsights.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const forms = canonical.reduce((sum, row) => sum + row.form_leads, 0);
    const site = canonical.reduce((sum, row) => sum + row.site_leads, 0);
    const conversations = canonical.reduce((sum, row) => sum + row.conversations, 0);
    // A row may be stale, partial, or left over from another attempt. Only the
    // persisted scope watermark confirms the requested period (including a real zero).
    const siteScopeComplete = siteScope.complete && !siteScope.error;
    const hasActionSnapshot = actionScopeConfirmed && siteScopeComplete;
    const hasInsightSnapshot = insightScopeConfirmed;
    accountCoverage[account.id] = {
      account_name: account.name,
      external_account_id: account.account_id,
      timezone: account.timezone_name || "America/Sao_Paulo",
      attribution_window: attributionWindow,
      requested_period: { start_date: startDate, end_date: endDate, inclusive: true },
      insight_rows: uniqueInsights.length,
      action_rows: accountActions.length,
      status: !hasInsightSnapshot ? "unavailable" : hasActionSnapshot ? "available" : "partial",
      blocks: {
        insights: insightScopeConfirmed ? "confirmed" : uniqueInsights.length ? "rows_present_unverified" : "unavailable",
        actions: actionScopeConfirmed ? "confirmed" : accountActions.length ? "rows_present_unverified" : "unavailable",
      },
      sync_issue: insightIssue?.last_error || actionIssue?.last_error ? {
        ...(insightIssue?.last_error ? { insights: insightIssue.last_error } : {}),
        ...(actionIssue?.last_error ? { actions: actionIssue.last_error } : {}),
      } : undefined,
      metrics: {
        spend: { value: hasInsightSnapshot ? spend : null, available: hasInsightSnapshot, reason: hasInsightSnapshot ? undefined : insightIssue?.last_error || "Insights sem cobertura confirmada para este recorte." },
        impressions: { value: hasInsightSnapshot ? impressions : null, available: hasInsightSnapshot },
        reach: { value: hasInsightSnapshot ? reach : null, available: hasInsightSnapshot, note: "Soma direcional das linhas diárias." },
        clicks: { value: hasInsightSnapshot ? clicks : null, available: hasInsightSnapshot },
        ctr: { value: hasInsightSnapshot && impressions > 0 ? clicks / impressions * 100 : null, available: hasInsightSnapshot && impressions > 0 },
        cpm: { value: hasInsightSnapshot && impressions > 0 ? spend / impressions * 1000 : null, available: hasInsightSnapshot && impressions > 0 },
        cpc: { value: hasInsightSnapshot && clicks > 0 ? spend / clicks : null, available: hasInsightSnapshot && clicks > 0 },
        form_leads: { value: hasActionSnapshot ? forms : null, available: hasActionSnapshot },
        site_leads: { value: hasActionSnapshot ? site : null, available: hasActionSnapshot, reason: siteActionByAccount[account.id] && !siteScopeComplete ? siteScope.error || "Catálogo Meta sem destino confirmado para todos os anúncios do recorte." : undefined },
        conversations: { value: hasActionSnapshot ? conversations : null, available: hasActionSnapshot },
        total_leads: { value: hasActionSnapshot ? forms + site + conversations : null, available: hasActionSnapshot, reason: hasActionSnapshot ? undefined : siteScope.error || (siteActionByAccount[account.id] && !siteScope.complete ? "Catálogo Meta sem destino confirmado para todos os anúncios do recorte." : actionIssue?.last_error) || "Ações de lead ainda não confirmadas neste recorte." },
        cpl: { value: hasInsightSnapshot && hasActionSnapshot && forms + site + conversations > 0 ? spend / (forms + site + conversations) : null, available: hasInsightSnapshot && hasActionSnapshot && forms + site + conversations > 0 },
      },
    };
  }

  const siteScope = await loadSiteEligibleMetaAdScopes(admin, insights);
  const canonical = canonicalMetaLeads(insights, actions, siteActionByAccount, siteScope.scopes, siteScope.conversationScopes);
  const spend = insights.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const impressions = insights.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const reach = insights.reduce((sum, row) => sum + Number(row.reach || 0), 0);
  const clicks = insights.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const allInsightsConfirmed = accountIds.length > 0 && Object.values(accountCoverage).every((coverage) => coverage.blocks.insights === "confirmed");
  const allActionsConfirmed = accountIds.length > 0 && Object.values(accountCoverage).every((coverage) => coverage.blocks.actions === "confirmed")
    && siteScope.complete && !siteScope.error;
    const forms = canonical.reduce((sum, row) => sum + Number(row.form_leads || 0), 0);
    const site = canonical.reduce((sum, row) => sum + Number(row.site_leads || 0), 0);
    const conversations = canonical.reduce((sum, row) => sum + Number(row.conversations || 0), 0);
  return {
    source: "Meta Marketing API snapshots",
    scope: { account_ids: accountIds, campaign_ids: campaignIds, start_date: startDate, end_date: endDate, attribution_window_by_account: Object.fromEntries((accounts || []).map((account: any) => [account.id, account.attribution_window || "account_default"])), timezone_by_account: Object.fromEntries((accounts || []).map((account: any) => [account.id, account.timezone_name || "America/Sao_Paulo"])) },
    status: !allInsightsConfirmed ? "unavailable" : allActionsConfirmed ? "available" : "partial",
    coverage_by_account: accountCoverage,
    metrics: {
      spend: { value: allInsightsConfirmed ? spend : null, available: allInsightsConfirmed },
      impressions: { value: allInsightsConfirmed ? impressions : null, available: allInsightsConfirmed },
      reach: { value: allInsightsConfirmed ? reach : null, available: allInsightsConfirmed, note: "Soma direcional das linhas diárias; não equivale ao alcance deduplicado da Meta." },
      clicks: { value: allInsightsConfirmed ? clicks : null, available: allInsightsConfirmed },
      ctr: { value: allInsightsConfirmed && impressions > 0 ? clicks / impressions * 100 : null, available: allInsightsConfirmed && impressions > 0 },
      cpm: { value: allInsightsConfirmed && impressions > 0 ? spend / impressions * 1000 : null, available: allInsightsConfirmed && impressions > 0 },
      cpc: { value: allInsightsConfirmed && clicks > 0 ? spend / clicks : null, available: allInsightsConfirmed && clicks > 0 },
      form_leads: { value: allActionsConfirmed ? forms : null, available: allActionsConfirmed },
      site_leads: { value: allActionsConfirmed ? site : null, available: allActionsConfirmed },
      conversations: { value: allActionsConfirmed ? conversations : null, available: allActionsConfirmed },
      total_leads: { value: allActionsConfirmed ? forms + site + conversations : null, available: allActionsConfirmed, reason: allActionsConfirmed ? undefined : "Ações de lead ainda não confirmadas para todas as contas deste recorte." },
      cpl: { value: allInsightsConfirmed && allActionsConfirmed && forms + site + conversations > 0 ? spend / (forms + site + conversations) : null, available: allInsightsConfirmed && allActionsConfirmed && forms + site + conversations > 0 },
    },
    completeness: { insight_rows: insights.length, action_rows: actions.length, legacy_insights_leads_used: false },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData.user) return json({ error: "UNAUTHORIZED" }, 401);
    const rpc = await req.json();
    const id = rpc?.id ?? null;
    if (rpc?.jsonrpc !== "2.0" || typeof rpc?.method !== "string") return json(rpcError(id, -32600, "Invalid JSON-RPC request"), 400);
    if (rpc.method === "notifications/initialized") return new Response(null, { status: 202, headers: corsHeaders });
    if (rpc.method === "initialize") return json({ jsonrpc: "2.0", id, result: { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "growdash-meta-traffic", version: "1.0.0" } } });
    if (rpc.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
    if (rpc.method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: [{
      name: "get_meta_traffic_metrics",
      description: "Consulta snapshots Meta por UUID interno de conta, campanhas opcionais e intervalo civil inclusivo. Leads = formulários + site + conversas iniciadas, com aliases equivalentes deduplicados. Nunca usa insights.leads.",
      inputSchema: { type: "object", additionalProperties: false, required: ["account_ids", "start_date", "end_date"], properties: {
        account_ids: { type: "array", minItems: 1, items: { type: "string", format: "uuid" }, description: "UUIDs internos de ad_accounts que o usuário autenticado pode acessar." },
        campaign_ids: { type: "array", items: { type: "string" }, description: "IDs de campanha Meta internos/externos conforme persistidos em insights.campaign_id." },
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date" },
      } },
    }] } });
    if (rpc.method === "tools/call") {
      const params = rpc.params || {};
      if (params.name !== "get_meta_traffic_metrics") return json(rpcError(id, -32602, "Unknown tool"), 400);
      try {
        const admin = createClient(url, serviceKey);
        const result = await readMetaMetrics(admin, userData.user.id, params.arguments || {});
        return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "META_METRICS_QUERY_FAILED";
        return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } });
      }
    }
    return json(rpcError(id, -32601, "Method not found"), 404);
  } catch (error) {
    console.error("meta-traffic-mcp", error);
    return json(rpcError(null, -32603, "Internal error"), 500);
  }
});
