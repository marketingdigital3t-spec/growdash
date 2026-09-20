import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Result = { ok: boolean; status: number; body: Record<string, unknown> };

async function invoke(base: string, key: string, name: string, body: Record<string, unknown>): Promise<Result> {
  try {
    const response = await fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { response: text.slice(0, 2000) }; }
    return { ok: response.ok, status: response.status, body: parsed };
  } catch (error) {
    return { ok: false, status: 0, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

function itemSummary(result: Result) {
  const body = result.body as any;
  return {
    ok: result.ok,
    status: result.status,
    pages: Number(body.pages_processed ?? body.pages ?? 0),
    records: Number(body.deals ?? body.upserted ?? body.synced ?? body.total ?? 0),
    duplicates: Number(body.duplicates ?? 0),
    gaps: body.gaps ?? body.errors ?? [],
    response: body,
  };
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(base, key);
  const body = await req.json().catch(() => ({}));
  const auth = req.headers.get("Authorization") || "";
  const isService = auth === `Bearer ${key}`;
  const cronSecret = req.headers.get("x-cron-secret");
  const { data: validCronSecret } = await admin.rpc("verify_daily_incremental_sync_secret", { candidate: cronSecret });
  const isCron = !isService && validCronSecret === true;
  let userId: string | null = null;
  if (!isService && !isCron) {
    const caller = createClient(base, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data } = await caller.auth.getUser();
    if (!data.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    userId = data.user.id;
  }

  if ((isService || isCron) && typeof body.user_id === "string") userId = body.user_id;
  if (!userId) return new Response(JSON.stringify({ error: "user_id obrigatório para execução de serviço" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const started = new Date().toISOString();
  const { data: run, error: runError } = await admin.from("sync_backfill_runs").insert({ user_id: userId, status: "running", started_at: started }).select("id").single();
  if (runError || !run) return new Response(JSON.stringify({ error: runError?.message || "Não foi possível criar a execução" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const items: Array<Record<string, unknown>> = [];
  let failures = 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const historicalStart = String(body.start_date || body.startDate || "2000-01-01");

  try {
    const rdOnly = body.rd_only === true;
    if (!rdOnly) {
      const { data: accounts, error: accountsError } = await admin.from("ad_accounts").select("id,name").eq("user_id", userId).neq("connection_status", "disconnected");
      if (accountsError) throw accountsError;
      for (const account of accounts || []) {
      let windowStart = historicalStart;
      while (windowStart <= today) {
        const windowEnd = addDays(windowStart, 89) < today ? addDays(windowStart, 89) : today;
        const common = { adAccountId: account.id, startDate: windowStart, endDate: windowEnd, incremental: false, includeBreakdowns: false, triggerSource: "historical_backfill" };
        const insight = await invoke(base, key, "sync-meta-insights", common);
        const lead = await invoke(base, key, "sync-meta-leads", { adAccountId: account.id, startDate: windowStart, endDate: windowEnd, triggerSource: "historical_backfill" });
        const hourly = await invoke(base, key, "sync-meta-hourly", { adAccountId: account.id, startDate: windowStart, endDate: windowEnd, triggerSource: "historical_backfill" });
        const insightSummary = itemSummary(insight);
        const leadSummary = itemSummary(lead);
        const hourlySummary = itemSummary(hourly);
        for (const [provider, summary] of [["meta_insights", insightSummary], ["meta_leads", leadSummary], ["meta_hourly", hourlySummary]] as const) {
          const ok = summary.ok;
          if (!ok) failures++;
          items.push({ run_id: run.id, user_id: userId, provider, account_id: account.id, window_start: windowStart, window_end: windowEnd, status: ok ? "success" : "partial", pages_read: summary.pages, records_read: summary.records, records_upserted: summary.records, duplicates: summary.duplicates, gaps: Array.isArray(summary.gaps) ? summary.gaps : [summary.gaps], details: summary.response, error_message: ok ? null : String(summary.response?.error || "Falha no provedor"), finished_at: new Date().toISOString() });
        }
        if (windowEnd === today) break;
        windowStart = addDays(windowEnd, 1);
      }
      }
    }

    let funnelsQuery = admin.from("rd_funnels").select("id,user_id,name").eq("user_id", userId).eq("is_active", true).not("rd_funnel_id", "is", null);
    if (typeof body.funnel_id === "string") funnelsQuery = funnelsQuery.eq("id", body.funnel_id);
    const { data: funnels, error: funnelsError } = await funnelsQuery;
    if (funnelsError) throw funnelsError;
    for (const funnel of funnels || []) {
      const result = await invoke(base, key, "rd-sync-deals", { funnel_id: funnel.id, service_user_id: userId, cron_trigger: true, analytics_mode: true, full_history: true, trigger_source: "historical_backfill" });
      const summary = itemSummary(result);
      if (!summary.ok) failures++;
      items.push({ run_id: run.id, user_id: userId, provider: "rd_deals", funnel_id: funnel.id, window_start: historicalStart, window_end: today, status: summary.ok ? "success" : "partial", pages_read: summary.pages, records_read: summary.records, records_upserted: summary.records, duplicates: summary.duplicates, gaps: Array.isArray(summary.gaps) ? summary.gaps : [summary.gaps], details: summary.response, error_message: summary.ok ? null : String(summary.response?.error || "Falha no RD"), finished_at: new Date().toISOString() });
    }

    if (items.length) {
      const { error } = await admin.from("sync_backfill_items").insert(items);
      if (error) throw error;
    }
    const status = failures ? "partial" : "success";
    await admin.from("sync_backfill_runs").update({ status, finished_at: new Date().toISOString(), summary: { items: items.length, failures, historicalStart, historicalEnd: today } }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: !failures, status, run_id: run.id, items: items.length, failures, historicalStart, historicalEnd: today }), { status: failures ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("sync_backfill_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: false, status: "failed", run_id: run.id, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
