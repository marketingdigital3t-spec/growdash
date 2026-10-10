import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const admin = createClient(supabaseUrl, serviceKey);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type Auth = { user: { id: string }; client: ReturnType<typeof createClient> };
type Account = { id: string; account_id: string; name: string; access_token: string | null; connection_status: string | null };
type Insight = { ad_id: string; spend: number | null; leads: number | null; date: string };
type Deal = { utm_id: string | null; utm_campaign: string | null; stage_bucket: string | null; win: boolean; amount_total: number | null };

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
  const start = typeof body.start_date === "string" ? body.start_date : day(7);
  const end = typeof body.end_date === "string" ? body.end_date : day(1);
  const trigger = body.trigger === "manual" ? "manual" : "scheduled";
  const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
  if (!workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
  const { data: settings } = await admin.from("traffic_agent_settings").upsert({ workspace_id: workspace.id }, { onConflict: "workspace_id" }).select("*").single();
  if (settings?.execution_mode === "paused") return json({ status: "paused", reason: "EXECUTION_PAUSED" });

  await admin.from("traffic_agent_runtime").upsert({ workspace_id: workspace.id, status: "analyzing", browser_status: "disconnected", last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const { data: accounts, error: accountsError } = await admin.from("ad_accounts").select("id,account_id,name,access_token,connection_status").eq("user_id", user.id);
  if (accountsError) return json({ status: "failed", error: "ACCOUNT_QUERY_FAILED" }, 500);

  const actions: string[] = [];
  const analyzed: Array<Record<string, unknown>> = [];
  for (const account of (accounts || []) as Account[]) {
    if (account.connection_status === "disconnected" || !account.access_token) continue;
    const { data: campaigns } = await admin.from("campaigns").select("id,name,status,ad_account_id").eq("ad_account_id", account.id);
    const campaignIds = (campaigns || []).map((campaign) => campaign.id);
    if (!campaignIds.length) continue;
    const { data: adsets } = await admin.from("adsets").select("id,name,status,daily_budget,campaign_id").in("campaign_id", campaignIds);
    const adsetRows = adsets || [];
    const adsetIds = adsetRows.map((adset) => adset.id);
    if (!adsetIds.length) continue;
    const { data: ads } = await admin.from("ads").select("id,name,status,adset_id").in("adset_id", adsetIds);
    const adsById = new Map((ads || []).map((ad) => [ad.id, ad]));
    const adIds = (ads || []).map((ad) => ad.id);
    if (!adIds.length) continue;
    const { data: insights } = await admin.from("insights").select("ad_id,spend,leads,date").in("ad_id", adIds).gte("date", start).lte("date", end);
    const { data: deals } = await admin.from("rd_deals").select("utm_id,utm_campaign,stage_bucket,win,amount_total").eq("ad_account_id", account.id).or(`lead_created_at.gte.${start},closed_at.gte.${start}`).lte("updated_at", `${end}T23:59:59Z`);
    const dealsByAd = new Map<string, { opportunities: number; sales: number; revenue: number }>();
    for (const deal of (deals || []) as Deal[]) {
      const key = deal.utm_id || "campaign-only";
      const current = dealsByAd.get(key) || { opportunities: 0, sales: 0, revenue: 0 };
      if (deal.win) { current.sales += 1; current.revenue += num(deal.amount_total); } else if (deal.stage_bucket && ["opportunity", "qualified", "proposal"].includes(deal.stage_bucket.toLowerCase())) current.opportunities += 1;
      dealsByAd.set(key, current);
    }
    const byAd = new Map<string, { spend: number; leads: number; dates: Set<string> }>();
    for (const insight of (insights || []) as Insight[]) {
      const current = byAd.get(insight.ad_id) || { spend: 0, leads: 0, dates: new Set<string>() };
      current.spend += num(insight.spend); current.leads += num(insight.leads); current.dates.add(insight.date);
      byAd.set(insight.ad_id, current);
    }
    const byAdset = new Map<string, { spend: number; leads: number; opportunities: number; sales: number; revenue: number; dates: Set<string> }>();
    for (const [adId, adMetrics] of byAd) {
      const ad = adsById.get(adId);
      if (!ad) continue;
      const current = byAdset.get(ad.adset_id) || { spend: 0, leads: 0, opportunities: 0, sales: 0, revenue: 0, dates: new Set<string>() };
      const deal = dealsByAd.get(adId) || { opportunities: 0, sales: 0, revenue: 0 };
      current.spend += adMetrics.spend; current.leads += adMetrics.leads; current.opportunities += deal.opportunities; current.sales += deal.sales; current.revenue += deal.revenue;
      for (const date of adMetrics.dates) current.dates.add(date);
      byAdset.set(ad.adset_id, current);
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
    analyzed.push({ account_id: account.id, name: account.name, adsets: adsetRows.length, insights: (insights || []).length });
  }
  await admin.from("traffic_agent_runtime").update({ status: "waiting_approval", last_analysis_at: new Date().toISOString(), next_analysis_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), last_error: null, updated_at: new Date().toISOString(), metadata: { trigger, period: { start, end }, niche: settings?.strategy_niche || "estetica", execution_mode: "approval_required", accounts_analyzed: analyzed.length, actions: actions.length } }).eq("workspace_id", workspace.id);
  return json({ status: "completed", mode: "approval_required", niche: settings?.strategy_niche || "estetica", period: { start, end, timezone: "America/Sao_Paulo" }, accounts_analyzed: analyzed.length, actions: actions.length, accounts: analyzed });
});
