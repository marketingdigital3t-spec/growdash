import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { canonicalMetaLeads } from "../_shared/metaLeadMetrics.ts";
import { findMetaSyncCoverage, type MetaSyncCoverageRow } from "../../../src/lib/metaSyncCoverage.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ratio = (a: number | null, b: number | null, factor = 1) => a !== null && b !== null && b > 0 ? a / b * factor : null;

function zonedBoundary(date: string, timeZone: string, endOfDay = false) {
  const [year, month, day] = date.split("-").map(Number);
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant.getTime();
  };
  let resolved = new Date(localAsUtc - offsetAt(new Date(localAsUtc)));
  resolved = new Date(localAsUtc - offsetAt(resolved));
  return resolved.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const accountId = String(body?.account_id || "");
    if (!accountId) throw new Error("account_id required");
    const requestedDate = typeof body?.date === "string" ? body.date : null;
    const { data: memberships } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).eq("status", "active");
    const workspaceIds = (memberships || []).map((membership) => membership.workspace_id);
    if (!workspaceIds.length) throw new Error("Workspace not found");
    const { data: account } = await admin.from("ad_accounts")
      .select("id, workspace_id, name, timezone_name, attribution_window, last_sync_success_at")
      .eq("id", accountId).in("workspace_id", workspaceIds).maybeSingle();
    if (!account) throw new Error("Account not found in the current workspace");
    const timezone = account.timezone_name || "America/Sao_Paulo";
    const date = requestedDate || new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("date must be a valid civil date in YYYY-MM-DD format");
    const attributionWindow = account.attribution_window || "account_default";
    const { data: coverageRows, error: coverageError } = await admin.from("meta_sync_scope_state")
      .select("ad_account_id,campaign_scope,start_date,end_date,covered_start_date,covered_end_date,timezone,attribution_window,status,block_status,last_error,error_code,last_finished_at,updated_at")
      .eq("ad_account_id", accountId).lte("start_date", date).gte("end_date", date);
    if (coverageError) throw coverageError;
    const coverage = (coverageRows || []) as unknown as MetaSyncCoverageRow[];
    const scope = { accountId, timezone, attributionWindow };
    const insightsConfirmed = Boolean(findMetaSyncCoverage(coverage, scope, date, date, [], "insights"));
    const actionsConfirmed = Boolean(findMetaSyncCoverage(coverage, scope, date, date, [], "actions"));
    const pageSize = 1000;
    const rows: any[] = [];
    for (let page = 0; ; page++) {
      let query = admin.from("insights").select("ad_account_id,ad_id,date,attribution_window,spend,impressions,reach,clicks")
        .eq("ad_account_id", accountId).eq("date", date);
      query = attributionWindow === "account_default" ? query.or("attribution_window.eq.account_default,attribution_window.is.null") : query.eq("attribution_window", attributionWindow);
      const { data, error } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if ((data || []).length < pageSize) break;
    }
    const mediaRows = rows as Array<Record<string, unknown>>;
    const sums = mediaRows.reduce((sum: Record<string, number>, row: Record<string, unknown>) => ({ spend: sum.spend + number(row.spend), impressions: sum.impressions + number(row.impressions), reach: sum.reach + number(row.reach), clicks: sum.clicks + number(row.clicks) }), { spend: 0, impressions: 0, reach: 0, clicks: 0 });
    const actionRows: any[] = [];
    const adIds = Array.from(new Set(mediaRows.map((row) => String(row.ad_id || "")).filter(Boolean)));
    for (let offset = 0; offset < adIds.length; offset += 200) {
      for (let page = 0; ; page++) {
        let query = admin.from("insight_actions").select("ad_account_id,ad_id,date,action_type,value,attribution_window")
          .eq("ad_account_id", accountId)
          .in("ad_id", adIds.slice(offset, offset + 200)).eq("date", date);
        query = attributionWindow === "account_default" ? query.or("attribution_window.eq.account_default,attribution_window.is.null") : query.eq("attribution_window", attributionWindow);
        const { data, error } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        actionRows.push(...(data || []));
        if ((data || []).length < pageSize) break;
      }
    }
    const { data: lpConfig, error: lpError } = await admin.from("account_lp_config")
      .select("action_type").eq("ad_account_id", accountId).maybeSingle();
    if (lpError) throw lpError;
    const leadsByAd = canonicalMetaLeads(
      mediaRows.map((row) => ({ ad_id: String(row.ad_id), ad_account_id: accountId, date: String(row.date), leads: null })),
      actionRows.map((row) => ({ ad_account_id: accountId, ad_id: String(row.ad_id), date: String(row.date), action_type: String(row.action_type || ""), value: number(row.value) })),
      { [accountId]: lpConfig?.action_type || undefined },
    );
    const media = {
      spend: insightsConfirmed ? sums.spend : null,
      impressions: insightsConfirmed ? sums.impressions : null,
      reach: insightsConfirmed ? sums.reach : null,
      clicks: insightsConfirmed ? sums.clicks : null,
      leads: actionsConfirmed ? leadsByAd.reduce((sum, row) => sum + Number(row.leads || 0), 0) : null,
      leads_status: actionsConfirmed ? "confirmed" : "unavailable",
      leads_reason: actionsConfirmed ? undefined : "Ações Meta sem cobertura confirmada para esta conta, data e atribuição.",
    };
    const { count: rdLeads } = await admin.from("rd_deals").select("id", { count: "exact", head: true }).eq("ad_account_id", accountId).gte("lead_created_at", zonedBoundary(date, timezone)).lte("lead_created_at", zonedBoundary(date, timezone, true));
    const { data: sales } = await admin.from("sales").select("net_revenue, quantity").eq("ad_account_id", accountId).eq("sale_date", date).in("status", ["confirmed", "pending"]);
    const saleCount = (sales || []).reduce((sum, sale) => sum + number(sale.quantity), 0);
    const revenue = (sales || []).reduce((sum, sale) => sum + number(sale.net_revenue), 0);
    const metrics = { ...media, rdLeads: rdLeads || 0, sales: saleCount, revenue, ctr: ratio(sums.clicks, sums.impressions, 100), cpm: ratio(sums.spend, sums.impressions, 1000), cpc: ratio(sums.spend, sums.clicks), cpl: media.leads === null ? null : ratio(sums.spend, media.leads), cac: ratio(sums.spend, saleCount), roas: ratio(revenue, sums.spend), frequency: ratio(sums.impressions, sums.reach), rdCoverage: media.leads ? ratio(rdLeads || 0, media.leads, 100) : null };
    let executiveSummary = metrics.leads === null
      ? `${account.name}: leads Meta indisponíveis; sincronização sem cobertura confirmada para ${date}.`
      : `${account.name}: R$ ${sums.spend.toFixed(2)} investidos, ${metrics.leads} leads Meta, ${metrics.rdLeads} leads RD, CPL ${metrics.cpl === null ? "indisponível" : `R$ ${metrics.cpl.toFixed(2)}`} e ROAS ${metrics.roas === null ? "indisponível" : `${metrics.roas.toFixed(2)}x`}.`;
    const aiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    const aiUrl = Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions";
    const aiModel = Deno.env.get("AI_MODEL") || "gpt-4.1-mini";
    if (aiKey) {
      const ai = await fetch(aiUrl, { method: "POST", headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: aiModel, messages: [{ role: "system", content: "Você é o resumo executivo diário da Growdash. Responda em português, até 100 palavras, use somente os números fornecidos, destaque risco e uma ação. Valores null significam indisponível, nunca zero. Não invente dados." }, { role: "user", content: JSON.stringify({ account: account.name, date, timezone, attribution_window: attributionWindow, metrics }) }] }) });
      if (ai.ok) executiveSummary = (await ai.json())?.choices?.[0]?.message?.content || executiveSummary;
    }
    const payload = { workspace_id: account.workspace_id, ad_account_id: accountId, snapshot_date: date, account_timezone: timezone, attribution_window: attributionWindow, source_freshness: { meta: account.last_sync_success_at, generated_at: new Date().toISOString() }, unified_metrics: metrics, executive_summary: executiveSummary, model: aiKey ? aiModel : "deterministic-fallback" };
    const { error: upsertError } = await admin.from("intelligence_snapshots").upsert(payload, { onConflict: "workspace_id,ad_account_id,snapshot_date,attribution_window" });
    if (upsertError) throw upsertError;
    return new Response(JSON.stringify({ snapshot_date: date, account_id: accountId, metrics, executive_summary: executiveSummary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
