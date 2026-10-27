import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAuthorizedAdAccounts } from "../_shared/adAccountAccess.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const admin = createClient(supabaseUrl, serviceKey);
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type Auth = { user: { id: string }; client: any };
type Account = { id: string; account_id: string; name: string; access_token: string | null; connection_status: string | null };
type Insight = { ad_id: string; spend: number | null; leads: number | null; date: string; impressions?: number | null; reach?: number | null; clicks?: number | null; ctr?: number | null; cpm?: number | null; frequency?: number | null; ad_name?: string | null };
type Deal = { utm_id: string | null; meta_ad_id: string | null; meta_campaign_id: string | null; meta_adset_id: string | null; utm_campaign: string | null; stage_bucket: string | null; win: boolean; amount_total: number | null };

async function caller(req: Request): Promise<Auth | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const client = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser();
  return user ? { user, client } : null;
}

function day(offset = 0) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() - offset * 86_400_000)); }
function num(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function safe(value: unknown) { return typeof value === "string" ? value.slice(0, 2000) : value; }

function ratio(value: number, base: number, factor = 1) { return base > 0 ? (value / base) * factor : 0; }

function sumInsight(rows: Insight[]) {
  const spend = rows.reduce((sum, row) => sum + num(row.spend), 0);
  const impressions = rows.reduce((sum, row) => sum + num(row.impressions), 0);
  const reach = rows.reduce((sum, row) => sum + num(row.reach), 0);
  const clicks = rows.reduce((sum, row) => sum + num(row.clicks), 0);
  const leads = rows.reduce((sum, row) => sum + num(row.leads), 0);
  return { spend, impressions, reach, clicks, leads, ctr: ratio(clicks, impressions, 100), cpm: ratio(spend, impressions, 1000), cpl: ratio(spend, leads), frequency: ratio(impressions, reach) };
}

async function executeMetaChange(account: Account, entityId: string, changes: { status?: "ACTIVE" | "PAUSED"; daily_budget?: number }) {
  if (!account.access_token) return { ok: false, error: "META_TOKEN_UNAVAILABLE" };
  const payload = new URLSearchParams({ access_token: account.access_token });
  if (changes.status) payload.set("status", changes.status);
  if (changes.daily_budget != null) payload.set("daily_budget", String(Math.round(changes.daily_budget * 100)));
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${entityId}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.error) return { ok: false, error: safe(result?.error?.message || `META_HTTP_${response.status}`) };
  return { ok: true, result };
}

async function recordFailure(workspaceId: string, proposalId: string, message: string) {
  await admin.from("traffic_action_audit").insert({ workspace_id: workspaceId, proposal_id: proposalId, event_type: "failed", error_message: message });
  await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposalId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const auth = await caller(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const { user } = auth;
  const body = await req.json().catch(() => ({}));
  let selectedAccountId = typeof body.account_id === "string" ? body.account_id : "";
  const start = typeof body.start_date === "string" ? body.start_date : day(7);
  const end = typeof body.end_date === "string" ? body.end_date : day(1);
  const trigger = body.trigger === "manual" ? "manual" : "scheduled";
  let { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
  if (!workspace) {
    const { data: membership } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (membership?.workspace_id) {
      const { data: memberWorkspace } = await admin.from("workspaces").select("id").eq("id", membership.workspace_id).maybeSingle();
      workspace = memberWorkspace;
    }
  }
  if (!workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
  const { data: settings } = await admin.from("traffic_agent_settings").upsert({ workspace_id: workspace.id }, { onConflict: "workspace_id" }).select("*").single();
  if (settings?.execution_mode === "paused") return json({ status: "paused", reason: "EXECUTION_PAUSED" });

  await admin.from("traffic_agent_runtime").upsert({ workspace_id: workspace.id, status: "analyzing", browser_status: "disconnected", last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const resolvedAccounts = await resolveAuthorizedAdAccounts(admin, user.id, {
    accountIds: selectedAccountId ? [selectedAccountId] : [],
    select: "id,account_id,name,user_id,workspace_id,access_token,connection_status,metadata,created_at",
  });
  const accounts = resolvedAccounts.filter((account) => !account.workspace_id || account.workspace_id === workspace.id);
  if (!selectedAccountId && (accounts || []).length !== 1) {
    return json({ error: "ACCOUNT_SELECTION_REQUIRED", accounts_available: accounts?.length || 0 }, 400);
  }
  if (!selectedAccountId && accounts?.[0]?.id) selectedAccountId = accounts[0].id;

  const actions: string[] = [];
  const analyzed: Array<Record<string, unknown>> = [];
  for (const account of (accounts || []) as Account[]) {
    if (account.connection_status === "disconnected" || !account.access_token) continue;
    const { data: campaigns, error: campaignsError } = await admin.from("campaigns").select("id,name,status,ad_account_id").eq("ad_account_id", account.id);
    if (campaignsError) return json({ status: "unavailable", error: "CAMPAIGNS_QUERY_FAILED", source: safe(campaignsError.message) }, 503);
    const campaignIds = (campaigns || []).map((campaign) => campaign.id);
    if (!campaignIds.length) continue;
    const { data: adsets, error: adsetsError } = await admin.from("adsets").select("id,name,status,daily_budget,campaign_id").in("campaign_id", campaignIds);
    if (adsetsError) return json({ status: "unavailable", error: "ADSETS_QUERY_FAILED", source: safe(adsetsError.message) }, 503);
    const adsetRows = adsets || [];
    const adsetIds = adsetRows.map((adset) => adset.id);
    if (!adsetIds.length) continue;
    const { data: ads, error: adsError } = await admin.from("ads").select("id,name,status,adset_id").in("adset_id", adsetIds);
    if (adsError) return json({ status: "unavailable", error: "ADS_QUERY_FAILED", source: safe(adsError.message) }, 503);
    const adsById = new Map((ads || []).map((ad) => [ad.id, ad]));
    const adIds = (ads || []).map((ad) => ad.id);
    if (!adIds.length) continue;
    const { data: insights, error: insightsError } = await admin.from("insights").select("ad_id,spend,leads,date,impressions,reach,clicks,ctr,cpm,frequency,ad_name").in("ad_id", adIds).gte("date", start).lte("date", end);
    if (insightsError) return json({ status: "unavailable", error: "INSIGHTS_QUERY_FAILED", source: safe(insightsError.message) }, 503);
    const { data: deals, error: dealsError } = await admin.from("rd_deals").select("utm_id,meta_ad_id,meta_campaign_id,meta_adset_id,utm_campaign,stage_bucket,win,amount_total").eq("ad_account_id", account.id).or(`lead_created_at.gte.${start},closed_at.gte.${start}`).lte("updated_at", `${end}T23:59:59Z`);
    if (dealsError) return json({ status: "unavailable", error: "RD_DEALS_QUERY_FAILED", source: safe(dealsError.message) }, 503);
    const dealsByAd = new Map<string, { opportunities: number; sales: number; revenue: number }>();
    for (const deal of (deals || []) as Deal[]) {
      const keys = [deal.meta_ad_id, deal.utm_id].filter((value): value is string => Boolean(value));
      if (keys.length === 0) continue;
      const current = dealsByAd.get(keys[0]) || { opportunities: 0, sales: 0, revenue: 0 };
      if (deal.win) { current.sales += 1; current.revenue += num(deal.amount_total); } else if (deal.stage_bucket && ["opportunity", "qualified", "proposal"].includes(deal.stage_bucket.toLowerCase())) current.opportunities += 1;
      for (const key of keys) dealsByAd.set(key, current);
    }
    const byAd = new Map<string, { spend: number; leads: number; dates: Set<string>; rows: Insight[] }>();
    for (const insight of (insights || []) as Insight[]) {
      const current = byAd.get(insight.ad_id) || { spend: 0, leads: 0, dates: new Set<string>(), rows: [] };
      current.spend += num(insight.spend); current.leads += num(insight.leads); current.dates.add(insight.date);
      current.rows.push(insight);
      byAd.set(insight.ad_id, current);
    }
    const byAdset = new Map<string, { spend: number; leads: number; opportunities: number; sales: number; revenue: number; dates: Set<string> }>();
    let experimentsPlanned = 0;
    for (const [adId, adMetrics] of byAd) {
      const ad = adsById.get(adId);
      if (!ad) continue;
      const current = byAdset.get(ad.adset_id) || { spend: 0, leads: 0, opportunities: 0, sales: 0, revenue: 0, dates: new Set<string>() };
      const deal = dealsByAd.get(adId) || { opportunities: 0, sales: 0, revenue: 0 };
      current.spend += adMetrics.spend; current.leads += adMetrics.leads; current.opportunities += deal.opportunities; current.sales += deal.sales; current.revenue += deal.revenue;
      for (const date of adMetrics.dates) current.dates.add(date);
      byAdset.set(ad.adset_id, current);
    }

    const accountMetrics = sumInsight((insights || []) as Insight[]);
    const qualifiedDeals = (deals || []).filter((deal: Deal) => ["qualified", "sql", "opportunity", "proposal", "client"].includes(String(deal.stage_bucket || "").toLowerCase()));
    const opportunityDeals = (deals || []).filter((deal: Deal) => ["sql", "opportunity", "proposal"].includes(String(deal.stage_bucket || "").toLowerCase()));
    const salesDeals = (deals || []).filter((deal: Deal) => Boolean(deal.win));
    const attributedDeals = (deals || []).filter((deal: Deal) => Boolean(deal.meta_ad_id || deal.utm_id));
    const snapshotPayload = {
      workspace_id: workspace.id,
      ad_account_id: account.id,
      source: "meta_rd",
      start_date: start,
      end_date: end,
      timezone: "America/Sao_Paulo",
      attribution_window: "account_default",
      freshness_minutes: 0,
      quality: "confirmed",
      attribution_coverage: accountMetrics.leads > 0 ? Math.min(1, attributedDeals.length / accountMetrics.leads) : 0,
      metrics: { ...accountMetrics, deals: deals?.length || 0, qualifiedLeads: qualifiedDeals.length, opportunities: opportunityDeals.length, sales: salesDeals.length, revenue: salesDeals.reduce((sum, deal) => sum + num(deal.amount_total), 0) },
      graph: { campaign_ids: campaignIds, adset_ids: adsetIds, ad_ids: adIds },
    };
    const { data: snapshot } = await admin.from("growth_snapshots").insert(snapshotPayload).select("id").maybeSingle();

    // Detect creative deterioration from the same account window. The
    // experiment is only planned here; publishing is handled by the guarded
    // experiment executor after assets pass policy review.
    const referenceCpl = accountMetrics.cpl || num(settings?.target_cpl);
    for (const [adId, adMetrics] of byAd) {
      const rows = [...adMetrics.rows].sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length < 4) continue;
      const split = Math.max(1, rows.length - 3);
      const before = sumInsight(rows.slice(0, split));
      const recent = sumInsight(rows.slice(split));
      const ctrDrop = before.ctr > 0 ? (recent.ctr - before.ctr) / before.ctr : 0;
      const cplRise = before.cpl > 0 ? (recent.cpl - before.cpl) / before.cpl : 0;
      const fatigued = ctrDrop <= -0.2 || cplRise >= 0.2 || (recent.frequency >= 3 && recent.ctr < before.ctr);
      if (!fatigued) continue;
      const ad = adsById.get(adId);
      if (!ad) continue;
      const hypothesis = `Variar o criativo ${ad.name} com base em queda de CTR/CPL.`;
      const idempotencyKey = `fatigue:${account.id}:${adId}:${end}`;
      const { data: existingExperiment } = await admin.from("growth_experiments").select("id,status").eq("workspace_id", workspace.id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existingExperiment && !["stopped", "rolled_back", "blocked"].includes(existingExperiment.status)) continue;
      const { error: experimentError } = await admin.from("growth_experiments").upsert({ workspace_id: workspace.id, ad_account_id: account.id, source_campaign_id: adsetRows.find((row) => row.id === ad.adset_id)?.campaign_id || null, source_adset_id: ad.adset_id, source_ad_id: adId, hypothesis, idempotency_key: idempotencyKey, status: "planned", reference_cpl: referenceCpl, test_budget: Math.min(referenceCpl || 0, num(settings?.hard_test_cap || 500)), account_budget_cap: num(settings?.test_budget_fraction || 0.1) * num(accountMetrics.spend || settings?.max_daily_budget_change || 0), window_hours: num(settings?.test_window_hours || 72), source_snapshot_id: snapshot?.id || null, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,idempotency_key" });
      if (!experimentError) experimentsPlanned += 1;
    }

    for (const adset of adsetRows) {
      const metrics = byAdset.get(adset.id);
      if (!metrics || !metrics.spend) continue;
      const roas = metrics.revenue / metrics.spend;
      const enoughEvidence = metrics.dates.size >= num(settings?.min_evidence_days || 3);
      const canPause = enoughEvidence && settings?.auto_pause_enabled !== false && metrics.spend >= num(settings?.min_spend_for_pause || 150) && metrics.opportunities === 0 && metrics.sales === 0 && String(adset.status).toUpperCase() !== "PAUSED";
      const canScale = enoughEvidence && settings?.auto_budget_enabled !== false && metrics.sales >= num(settings?.min_sales_for_scale || 1) && roas >= num(settings?.target_roas || 2) && num(adset.daily_budget) > 0;
      if (!canPause && !canScale) continue;
      const change = canPause ? { status: "PAUSED" as const } : { daily_budget: Math.min(num(adset.daily_budget) * 1.1, num(adset.daily_budget) + num(settings?.max_daily_budget_change || 500)) };
      const action = canPause ? "pause_adset" : "increase_adset_budget_10_percent";
      const fingerprint = `${action}:${account.id}:${adset.id}:${start}:${end}`;
      const diagnosis = canPause ? `Conjunto ${adset.name} gastou R$ ${metrics.spend.toFixed(2)} sem oportunidade qualificada ou venda RD no período.` : `Conjunto ${adset.name} gerou ${metrics.sales} venda(s) RD, receita de R$ ${metrics.revenue.toFixed(2)} e ROAS comercial ${roas.toFixed(2)}x.`;
      const evidence = { niche: settings?.strategy_niche || "estetica", period: { start, end, timezone: "America/Sao_Paulo" }, spend: metrics.spend, leads: metrics.leads, opportunities: metrics.opportunities, sales: metrics.sales, revenue: metrics.revenue, roas, evidence_days: metrics.dates.size, rule: action, source: "Meta insights + RD Station" };
      // Analysis is autonomous; execution is never autonomous. The database
      // trigger also rejects executing/executed proposals without approval.
      const initialStatus = "awaiting_approval";
      const { data: existing } = await admin.from("traffic_action_proposals").select("id,status").eq("workspace_id", workspace.id).eq("fingerprint", fingerprint).maybeSingle();
      if (existing && ["executed", "executing", "awaiting_approval", "approved"].includes(existing.status)) continue;
      const { data: proposal, error } = await admin.from("traffic_action_proposals").upsert({ workspace_id: workspace.id, fingerprint, ad_account_id: account.id, entity_type: "adset", entity_id: adset.id, entity_name: adset.name, status: initialStatus, diagnosis, evidence, proposed_action: canPause ? "Pausar conjunto" : "Aumentar orçamento diário em 10%", current_value: { status: adset.status, daily_budget: adset.daily_budget }, proposed_value: change, expected_impact: canPause ? "Interromper desperdício sem evidência comercial." : "Capturar mais volume de uma unidade que já gera vendas no RD.", risk: canPause ? "low" : "medium", valid_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "workspace_id,fingerprint" }).select("id").single();
      if (error || !proposal) continue;
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "created", new_value: change, evidence });
      actions.push(proposal.id);
    }
    analyzed.push({ account_id: account.id, name: account.name, adsets: adsetRows.length, insights: (insights || []).length, experiments: experimentsPlanned });
  }
  await admin.from("traffic_agent_runtime").update({ status: "waiting_approval", last_analysis_at: new Date().toISOString(), next_analysis_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), last_error: null, updated_at: new Date().toISOString(), metadata: { trigger, period: { start, end }, niche: settings?.strategy_niche || "estetica", execution_mode: "approval_required", accounts_analyzed: analyzed.length, actions: actions.length } }).eq("workspace_id", workspace.id);
  return json({ status: "completed", mode: settings?.autonomy_mode || "autonomous_guarded", niche: settings?.strategy_niche || "estetica", period: { start, end, timezone: "America/Sao_Paulo" }, accounts_analyzed: analyzed.length, actions: actions.length, proposals_created: actions.length, experiments_planned: analyzed.reduce((sum, item) => sum + Number(item.experiments || 0), 0), accounts: analyzed });
});
