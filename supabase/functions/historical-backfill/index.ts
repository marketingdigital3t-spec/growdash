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

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function consume() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, consume));
  return results;
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

function dateMonthsAgo(months: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

  const requestedRunId = typeof body.run_id === "string" ? body.run_id : null;
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  // A gateway timeout can leave only the audit row behind. Close those rows
  // before creating a new run so a failed historical request never blocks a
  // later resumable refresh forever. This changes audit state only; provider
  // data is never deleted here.
  const { data: runningRows, error: runningRowsError } = await admin
    .from("sync_backfill_runs")
    .select("id,started_at,status,summary")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(10);
  if (runningRowsError) return new Response(JSON.stringify({ error: runningRowsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const staleRuns = (runningRows || []).filter((row: any) => String(row.started_at || "") < staleBefore);
  for (const staleRun of staleRuns) {
    await admin.from("sync_backfill_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: "Execução histórica interrompida após expirar o tempo de execução; o cursor pode ser retomado.",
    }).eq("id", staleRun.id).eq("status", "running");
  }
  const activeRun = (runningRows || []).find((row: any) => !staleRuns.some((stale: any) => stale.id === row.id));

  let run: any;
  let runSummary: Record<string, any> = {};
  if (requestedRunId) {
    const { data: requestedRun, error: requestedRunError } = await admin
      .from("sync_backfill_runs")
      .select("id,user_id,status,summary,started_at")
      .eq("id", requestedRunId)
      .eq("user_id", userId)
      .maybeSingle();
    if (requestedRunError || !requestedRun) return new Response(JSON.stringify({ error: requestedRunError?.message || "Execução não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (requestedRun.status !== "running") return new Response(JSON.stringify({ ok: requestedRun.status === "success", status: requestedRun.status, run_id: requestedRun.id, summary: requestedRun.summary || {} }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    run = requestedRun;
    runSummary = requestedRun.summary || {};
  } else {
    if (activeRun) return new Response(JSON.stringify({ ok: false, status: "already_running", run_id: activeRun.id, message: "Já existe um backfill histórico em andamento." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const started = new Date().toISOString();
    const { data: createdRun, error: runError } = await admin.from("sync_backfill_runs").insert({ user_id: userId, status: "running", started_at: started }).select("id,user_id,status,summary,started_at").single();
    if (runError || !createdRun) return new Response(JSON.stringify({ error: runError?.message || "Não foi possível criar a execução" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    run = createdRun;
  }

  const items: Array<Record<string, unknown>> = [];
  let failures = 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  // Meta Insights has a practical provider limit of roughly 37 months. Keep
  // the default deterministic and bounded while still allowing an explicit
  // administrator-selected start date for older RD-only archives.
  const historicalStart = String(body.start_date || body.startDate || dateMonthsAgo(37));
  // A one-off operator run can temporarily include Meta even when the
  // existing UI sends rd_only=true. The flag is server-side only and is
  // removed after the historical repair; normal RD backfills remain RD-only.
  const forceMeta = Deno.env.get("HISTORICAL_BACKFILL_FORCE_META") === "true";
  const rdOnly = body.rd_only === true && !forceMeta;
  let incomplete = false;
  let metaAccountIndex = Number.isFinite(Number(runSummary.meta_account_index))
    ? Math.max(0, Number(runSummary.meta_account_index))
    : 0;
  let metaWindowStart = typeof runSummary.meta_window_start === "string" && runSummary.meta_window_start
    ? runSummary.meta_window_start
    : historicalStart;
  let rdFunnelIndex = Number.isFinite(Number(runSummary.rd_funnel_index))
    ? Math.max(0, Number(runSummary.rd_funnel_index))
    : 0;
  let metaAccountTotal = Number.isFinite(Number(runSummary.meta_account_total))
    ? Math.max(0, Number(runSummary.meta_account_total))
    : 0;

  try {
    if (!rdOnly) {
      // Keep the historical run account-complete, but never sync a manually
      // disconnected/blocked row. Legacy OAuth imports can leave duplicate
      // rows for the same Meta account; choose the newest usable row so the
      // same provider facts are not requested twice.
      const { data: accountRows, error: accountsError } = await admin
        .from("ad_accounts")
        .select("id,name,account_id,connection_status,oauth_health_status,access_token,created_at")
        .eq("user_id", userId)
        .not("connection_status", "in", "(disconnected,blocked)");
      if (accountsError) throw accountsError;
      const accountMap = new Map<string, any>();
      for (const account of accountRows || []) {
        const providerId = String(account.account_id || account.id).replace(/^act_/i, "");
        const hasToken = typeof account.access_token === "string" && account.access_token.trim().length > 0;
        const oauthBlocked = new Set(["permission_removed", "expired", "invalid"]).has(String(account.oauth_health_status || ""));
        if (oauthBlocked && !hasToken) continue;
        const current = accountMap.get(providerId);
        if (!current || String(account.created_at || "") > String(current.created_at || "")) accountMap.set(providerId, account);
      }
      const accounts = Array.from(accountMap.values());
      metaAccountTotal = accounts.length;
      if (metaAccountIndex < accounts.length) {
        const account = accounts[metaAccountIndex];
        const windowStart = metaWindowStart <= today ? metaWindowStart : historicalStart;
        const windowEnd = addDays(windowStart, 89) < today ? addDays(windowStart, 89) : today;
        const common = {
          adAccountId: account.id,
          startDate: windowStart,
          endDate: windowEnd,
          incremental: false,
          // Historical audience/placement/region data is part of the same
          // provider truth and must not be omitted from a complete backfill.
          includeBreakdowns: true,
          breakdownStartDate: windowStart,
          breakdownEndDate: windowEnd,
          triggerSource: "historical_backfill",
        };
        const [insight, lead, hourly] = await Promise.all([
          invoke(base, key, "sync-meta-insights", common),
          invoke(base, key, "sync-meta-leads", { adAccountId: account.id, startDate: windowStart, endDate: windowEnd, triggerSource: "historical_backfill" }),
          invoke(base, key, "sync-meta-hourly", { adAccountId: account.id, startDate: windowStart, endDate: windowEnd, triggerSource: "historical_backfill" }),
        ]);
        const insightSummary = itemSummary(insight);
        const leadSummary = itemSummary(lead);
        const hourlySummary = itemSummary(hourly);
        for (const [provider, summary] of [["meta_insights", insightSummary], ["meta_leads", leadSummary], ["meta_hourly", hourlySummary]] as const) {
          const ok = summary.ok;
          if (!ok) failures++;
          items.push({ run_id: run.id, user_id: userId, provider, account_id: account.id, window_start: windowStart, window_end: windowEnd, status: ok ? "success" : "partial", pages_read: summary.pages, records_read: summary.records, records_upserted: summary.records, duplicates: summary.duplicates, gaps: Array.isArray(summary.gaps) ? summary.gaps : [summary.gaps], details: summary.response, error_message: ok ? null : String(summary.response?.error || "Falha no provedor"), finished_at: new Date().toISOString() });
        }
        if (windowEnd === today) {
          metaAccountIndex += 1;
          metaWindowStart = historicalStart;
        } else {
          metaWindowStart = addDays(windowEnd, 1);
        }
      }
      else {
        metaAccountIndex = accounts.length;
      }
    }

    let funnelsQuery = admin.from("rd_funnels").select("id,user_id,name").eq("user_id", userId).eq("is_active", true).not("rd_funnel_id", "is", null);
    if (typeof body.funnel_id === "string") funnelsQuery = funnelsQuery.eq("id", body.funnel_id);
    const { data: funnels, error: funnelsError } = await funnelsQuery;
    if (funnelsError) throw funnelsError;
    const availableFunnels = funnels || [];
    const metaComplete = rdOnly || metaAccountIndex >= metaAccountTotal;
    if (metaComplete && rdFunnelIndex < availableFunnels.length) {
      const funnel = availableFunnels[rdFunnelIndex];
      // Keep each edge invocation short. rd-sync-deals persists the next page
      // cursor, so the following backfill tick safely continues the same full
      // history without waiting for every RD status in one gateway request.
      const result = await invoke(base, key, "rd-sync-deals", { funnel_id: funnel.id, service_user_id: userId, cron_trigger: true, analytics_mode: true, full_history: true, max_pages: 1, skip_enrichment: true, trigger_source: "historical_backfill" });
      const summary = itemSummary(result);
      if (!summary.ok) failures++;
      items.push({ run_id: run.id, user_id: userId, provider: "rd_deals", funnel_id: funnel.id, window_start: historicalStart, window_end: today, status: summary.ok ? "success" : "partial", pages_read: summary.pages, records_read: summary.records, records_upserted: summary.records, duplicates: summary.duplicates, gaps: Array.isArray(summary.gaps) ? summary.gaps : [summary.gaps], details: summary.response, error_message: summary.ok ? null : String(summary.response?.error || "Falha no RD"), finished_at: new Date().toISOString() });
      if (summary.response?.complete === false) incomplete = true;
      else rdFunnelIndex += 1;
    }

    if (items.length) {
      const { error } = await admin.from("sync_backfill_items").insert(items);
      if (error) throw error;
    }
    const previousItems = Number(runSummary.items || 0);
    const previousFailures = Number(runSummary.failures || 0);
    const done = metaComplete && rdFunnelIndex >= availableFunnels.length;
    const status = done && !incomplete ? (failures || previousFailures ? "partial" : "success") : "running";
    const summary = {
      items: previousItems + items.length,
      failures: previousFailures + failures,
      historicalStart,
      historicalEnd: today,
      incomplete: !done || incomplete,
      meta_account_index: metaAccountIndex,
      meta_window_start: metaWindowStart,
      meta_account_total: metaAccountTotal,
      rd_funnel_index: rdFunnelIndex,
      rd_funnel_total: availableFunnels.length,
    };
    await admin.from("sync_backfill_runs").update({ status, finished_at: status === "running" ? null : new Date().toISOString(), summary, error_message: status === "running" ? null : undefined }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: status === "success", status, run_id: run.id, items: items.length, failures, historicalStart, historicalEnd: today, incomplete }), { status: status === "partial" ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("sync_backfill_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", run.id);
    return new Response(JSON.stringify({ ok: false, status: "failed", run_id: run.id, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
