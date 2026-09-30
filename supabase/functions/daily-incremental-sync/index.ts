import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { listAuthorizedRDConnections } from "../_shared/rdConnection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type FunctionResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  body: Record<string, unknown>;
};

type RdTarget = {
  id: string;
  user_id: string;
  rd_connection_id: string;
  name: string;
  rd_funnel_id: string;
};

function saoPauloDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

type SyncWindow = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  mode: "incremental" | "historical" | "manual";
};

function dateWindow(targetDate: string): SyncWindow {
  const start = new Date(`${targetDate}T00:00:00-03:00`);
  const end = new Date(`${targetDate}T23:59:59.999-03:00`);
  return { start, end, startDate: targetDate, endDate: targetDate, mode: "historical" };
}

function incrementalWindow(now: Date, previousEnd?: string | null): SyncWindow {
  const end = now;
  // Re-read a small overlap so a provider that updates a record at the edge of
  // a window cannot leave a gap. The upserts/deduplication make this safe.
  const parsedPrevious = previousEnd ? new Date(previousEnd) : null;
  // A stale successful run must never make the next five-minute cycle scan
  // days of history. Partial runs still advance the watermark for the
  // sources that completed; their explicit status remains visible to the UI
  // and unresolved records are retried by webhook/manual reconciliation.
  const previousIsRecent = parsedPrevious && Number.isFinite(parsedPrevious.getTime())
    ? end.getTime() - parsedPrevious.getTime() <= 15 * 60_000
    : false;
  const watermark = previousIsRecent && parsedPrevious
    ? parsedPrevious
    : new Date(end.getTime() - 5 * 60_000);
  // Keep a small overlap around the five-minute cadence. Upserts make the
  // overlap idempotent and prevent edge events from being lost.
  const start = new Date(watermark.getTime() - 5 * 60_000);
  return {
    start,
    end,
    startDate: saoPauloDate(start),
    endDate: saoPauloDate(end),
    mode: "incremental",
  };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00-03:00`));
}

async function callFunction(
  baseUrl: string,
  serviceKey: string,
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = 45_000,
): Promise<FunctionResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { response: raw.slice(0, 4000) };
    }
    const semanticFailure = parsed.success === false || parsed.ok === false || parsed.status === "partial" || parsed.status === "failed" || parsed.status === "blocked";
    return {
      // Some gateways normalize non-2xx function responses. Respect the
      // function's explicit success/ok contract as well as HTTP status.
      ok: response.ok && !semanticFailure,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function applyReportedFailure(result: FunctionResult, critical = true): FunctionResult {
  const body = result.body || {};
  const errors = Array.isArray(body.errors) ? body.errors : [];
  const failedAccounts = Number(body.failedAccounts ?? body.failed_accounts ?? 0);
  const skippedDisconnected = Number(body.skipped_disconnected ?? body.skippedDisconnected ?? 0);
  const accountErrors = Array.isArray(body.accounts)
    ? body.accounts.some((account: any) => Boolean(account?.error) || (Array.isArray(account?.errors) && account.errors.length > 0))
    : false;
  // skipped_disconnected is expected when the workspace retains historical
  // rows for disabled accounts. It is not a failure of the active-account
  // snapshot and must not make the five-minute run partial by itself.
  const hasReportedFailure = errors.length > 0 || failedAccounts > 0 || accountErrors;
  const nonSuccessStatus = critical
    ? ["partial", "failed", "blocked", "stale_snapshot"].includes(String(body.status || ""))
    : ["failed", "blocked", "stale_snapshot"].includes(String(body.status || ""));
  return hasReportedFailure || nonSuccessStatus ? { ...result, ok: false } : result;
}

function aggregateMetaResults(
  results: Array<{ account_id: string; insights: FunctionResult; leads: FunctionResult; hourly: FunctionResult }>,
  key: "insights" | "leads" | "hourly",
): FunctionResult {
  const selected = results.map((result) => result[key]);
  const failed = selected.filter((result) => !result.ok);
  const errors = selected.flatMap((result) => {
    const values = [result.body?.error, result.body?.errors].filter(Boolean);
    return values.map((value) => typeof value === "string" ? value : JSON.stringify(value));
  });
  return {
    ok: selected.length > 0 && failed.length === 0,
    status: selected.length === 0 ? 204 : failed.length === selected.length ? 500 : failed.length > 0 ? 207 : 200,
    durationMs: selected.reduce((sum, result) => sum + result.durationMs, 0),
    body: {
      success: failed.length === 0,
      status: selected.length === 0 ? "skipped" : failed.length === 0 ? "success" : failed.length === selected.length ? "failed" : "partial",
      accounts: results.length,
      failed_accounts: failed.length,
      errors: errors.length ? errors : undefined,
      account_results: results.map((result) => ({ account_id: result.account_id, ok: result[key].ok, status: result[key].body?.status, error: result[key].body?.error || result[key].body?.errors })),
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get("Authorization") || "";
  const isService = authHeader === `Bearer ${serviceKey}`;
  const cronSecret = req.headers.get("x-cron-secret");

  if (!isService) {
    const { data: secretIsValid, error: secretError } = await admin.rpc(
      "verify_daily_incremental_sync_secret",
      { candidate: cronSecret },
    );
    if (secretError || secretIsValid !== true) {
      return new Response(
        JSON.stringify({ error: "Unauthorized cron request" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  const requestBody = await req.json().catch(() => ({}));
  // Do not let a slow provider create an unbounded pile of overlapping runs.
  // Mark only genuinely stale rows as failed; a recent running row owns the
  // current watermark and must finish before another window starts.
  await admin
    .from("daily_incremental_sync_runs")
    .update({ status: "failed", finished_at: new Date().toISOString(), error_message: "Execução excedeu o tempo máximo e foi encerrada pelo próximo ciclo." })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 30 * 60_000).toISOString());
  const { data: activeRun } = await admin
    .from("daily_incremental_sync_runs")
    .select("id,started_at")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (activeRun) {
    return new Response(JSON.stringify({ success: false, status: "skipped", reason: "Já existe uma sincronização incremental em andamento.", runId: activeRun.id }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const requestedDate = requestBody?.targetDate ?? requestBody?.target_date;
  const now = new Date();
  let syncWindow: SyncWindow;
  if (isService && isIsoDate(requestedDate)) {
    syncWindow = dateWindow(requestedDate);
    syncWindow.mode = "manual";
  } else {
    const { data: previousRun } = await admin
      .from("daily_incremental_sync_runs")
      .select("window_end,finished_at")
      .in("status", ["success", "partial"])
      .not("window_end", "is", null)
      .not("finished_at", "is", null)
      .order("window_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    syncWindow = incrementalWindow(now, previousRun?.window_end);
  }
  const targetDate = syncWindow.startDate;
  const triggerSource = isService ? "service_role" : "pg_cron";
  const startedAt = new Date().toISOString();

  const { data: run, error: runError } = await admin
    .from("daily_incremental_sync_runs")
    .insert({
      target_date: targetDate,
      window_start: syncWindow.start.toISOString(),
      window_end: syncWindow.end.toISOString(),
      sync_mode: syncWindow.mode,
      trigger_source: triggerSource,
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (runError) {
    return new Response(JSON.stringify({ error: runError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Meta facts are synchronized account-by-account and in dependency order.
    // Running Insights, lead records and hourly facts for every account in
    // parallel caused hourly rows to observe an incomplete daily snapshot and
    // made a slow account affect the watermark of all others.
    const { data: metaAccounts, error: metaAccountsError } = await admin
      .from("ad_accounts")
      .select("id,timezone_name,attribution_window,connection_status")
      .neq("connection_status", "disconnected");
    if (metaAccountsError) throw metaAccountsError;

    const metaAccountResults: Array<{ account_id: string; timezone: string; attribution_window: string; insights: FunctionResult; leads: FunctionResult; hourly: FunctionResult }> = [];
    for (const account of (metaAccounts || []) as any[]) {
      const timezone = String(account.timezone_name || "America/Sao_Paulo");
      const attributionWindow = String(account.attribution_window || "account_default");
      const campaignScope = "all-campaigns";
      const scopePayload = {
        ad_account_id: account.id,
        campaign_scope: campaignScope,
        start_date: syncWindow.startDate,
        end_date: syncWindow.endDate,
        timezone,
        attribution_window: attributionWindow,
        status: "running",
        last_started_at: startedAt,
        covered: false,
        last_error: null,
        updated_at: startedAt,
      };
      await admin.from("meta_sync_scope_state").upsert(scopePayload, {
        onConflict: "ad_account_id,campaign_scope,start_date,end_date,timezone,attribution_window",
      });

      const accountScope = { adAccountIds: [account.id] };
      const insights = applyReportedFailure(await callFunction(supabaseUrl, serviceKey, "sync-meta-insights", {
        ...accountScope,
        startDate: syncWindow.startDate,
        endDate: syncWindow.endDate,
        timezone,
        attributionWindow,
        incremental: true,
        includeBreakdowns: false,
        triggerSource: "five_minute_incremental",
      }));
      const leads = insights.ok
        ? applyReportedFailure(await callFunction(supabaseUrl, serviceKey, "sync-meta-leads", {
          ...accountScope,
          startDate: syncWindow.startDate,
          endDate: syncWindow.endDate,
          triggerSource: "five_minute_incremental",
        }), false)
        : { ok: false, status: 0, durationMs: 0, body: { error: "Insights parcial; leads preservados do último snapshot válido." } };
      const hourly = insights.ok
        ? applyReportedFailure(await callFunction(supabaseUrl, serviceKey, "sync-meta-hourly", {
          ...accountScope,
          startDate: syncWindow.startDate,
          endDate: syncWindow.endDate,
          timezone,
          attributionWindow,
          triggerSource: "five_minute_incremental",
        }), false)
        : { ok: false, status: 0, durationMs: 0, body: { error: "Insights parcial; hourly preservado do último snapshot válido." } };
      const accountOk = insights.ok;
      const accountErrors = [insights.body?.error, insights.body?.errors, leads.body?.error, leads.body?.errors, hourly.body?.error, hourly.body?.errors]
        .filter(Boolean).map((value) => typeof value === "string" ? value : JSON.stringify(value)).join("; ") || null;
      const finished = new Date().toISOString();
      await admin.from("meta_sync_scope_state").update({
        status: accountOk ? "success" : "partial",
        last_finished_at: finished,
        last_success_at: accountOk ? finished : undefined,
        last_valid_snapshot_at: accountOk ? finished : undefined,
        last_error: accountErrors,
        covered: accountOk,
        updated_at: finished,
      }).eq("ad_account_id", account.id).eq("campaign_scope", campaignScope)
        .eq("start_date", syncWindow.startDate).eq("end_date", syncWindow.endDate)
        .eq("timezone", timezone).eq("attribution_window", attributionWindow);
      metaAccountResults.push({ account_id: account.id, timezone, attribution_window: attributionWindow, insights, leads, hourly });
    }
    const metaInsights = aggregateMetaResults(metaAccountResults, "insights");
    const metaLeads = aggregateMetaResults(metaAccountResults, "leads");
    const metaHourly = aggregateMetaResults(metaAccountResults, "hourly");

    const rdConnections = await listAuthorizedRDConnections(admin);
    const ownerIds = Array.from(new Set(rdConnections.map((row) => String(row.user_id))));
    let rdTargets: RdTarget[] = [];
    let duplicateMappingCount = 0;
    if (ownerIds.length) {
      const { data: funnels, error: funnelsError } = await admin
        .from("rd_funnels")
        .select("id,user_id,rd_connection_id,name,rd_funnel_id")
        .in("rd_connection_id", rdConnections.map((connection) => connection.id))
        .eq("is_active", true)
        .not("rd_funnel_id", "is", null);
      if (funnelsError) throw funnelsError;
      const candidates = (funnels ?? []) as RdTarget[];
      // Process every active local mapping. A duplicate external funnel ID is
      // an audit problem, but selecting one mapping based on local row counts
      // silently discarded an entire account/funnel from reconciliation.
      rdTargets = candidates;
      const duplicateTargets = candidates.filter((funnel, index) => candidates.some((other, otherIndex) => otherIndex < index && other.rd_connection_id === funnel.rd_connection_id && other.rd_funnel_id === funnel.rd_funnel_id));
      duplicateMappingCount = duplicateTargets.length;
      if (duplicateTargets.length > 0) {
        console.warn("Duplicate local RD funnel mappings detected", duplicateTargets.map((funnel) => ({ id: funnel.id, rd_funnel_id: funnel.rd_funnel_id, name: funnel.name })));
      }
    }

    // RD applies a shared rate limit per connection. Serialize funnels within
    // one connection, while allowing independent connections to progress in
    // parallel so the five-minute cycle does not get stuck behind one account.
    const targetsByConnection = Array.from(rdTargets.reduce((groups, target) => {
      const key = target.rd_connection_id || `legacy:${target.user_id}`;
      const group = groups.get(key) || [];
      group.push(target);
      groups.set(key, group);
      return groups;
    }, new Map<string, RdTarget[]>()).values());
    const syncTarget = async (funnel: RdTarget) => {
      const result = await callFunction(
        supabaseUrl,
        serviceKey,
        "rd-sync-deals",
        {
          funnel_id: funnel.id,
          service_user_id: funnel.user_id,
          cron_trigger: true,
          analytics_mode: true,
          start_date: syncWindow.startDate,
          end_date: syncWindow.endDate,
          trigger_source: "five_minute_incremental",
          rd_connection_id: funnel.rd_connection_id,
        },
        120_000,
      );
      return {
        funnelId: funnel.id,
        funnelName: funnel.name,
        userId: funnel.user_id,
        ...result,
      };
    };
    // RD and PostgREST share the same account-level pressure during a cycle.
    // Running independent connections in parallel looked faster but caused
    // statement timeouts when a large funnel was reconciling at the same time.
    // Keep one funnel at a time; the bounded five-minute window is safer than
    // overlapping writers and produces a complete, observable run per funnel.
    const groupedResults = await mapWithConcurrency(
      targetsByConnection,
      1,
      async (group) => {
        const results = [];
        for (const funnel of group) results.push(await syncTarget(funnel));
        return results;
      },
    );
    const rdResults = groupedResults.flat();

    // Stage changes on existing deals arrive through the RD webhook. The
    // heavyweight open-deal reconciliation is intentionally opt-in so it
    // cannot block the five-minute watermark window or create overlapping runs.
    // It can still be requested explicitly by an authenticated service call.
    const runHeavyResync = requestBody?.include_resync === true && isService;
    const rdResync = runHeavyResync
      ? await callFunction(
        supabaseUrl,
        serviceKey,
        "rd-resync-cron",
        { trigger: "explicit_incremental_resync" },
      )
      : {
        ok: true,
        status: 204,
        durationMs: 0,
        body: { skipped: "heavy_resync_requires_explicit_service_request" },
      };
    const rdFailed = rdResults.filter((result) => !result.ok);
    const rdMetricReconciliation = await callFunction(
      supabaseUrl,
      serviceKey,
      "rd-reconcile-metrics",
      { run_id: run.id, trigger_source: "five_minute_incremental" },
    );
    // Insights is the primary KPI snapshot. Leads/forms and hourly remain
    // observable auxiliary blocks and are retried without downgrading valid
    // daily investment/delivery data to a global partial state.
    const allOk = metaInsights.ok && rdResync.ok && rdMetricReconciliation.ok && rdFailed.length === 0 && duplicateMappingCount === 0;
    const status = allOk ? "success" : "partial";
    const finishedAt = new Date().toISOString();

    const rdSummary = {
      requested: rdResults.length,
      succeeded: rdResults.length - rdFailed.length,
      failed: rdFailed.length,
      duplicate_mappings: duplicateMappingCount,
      results: rdResults,
    };
    const { error: runUpdateError } = await admin
      .from("daily_incremental_sync_runs")
      .update({
        status,
        finished_at: finishedAt,
        meta_insights: metaInsights,
        meta_leads: metaLeads,
        meta_hourly: metaHourly,
        rd: rdSummary,
        rd_metric_reconciliation: rdMetricReconciliation,
        rd_resync: rdResync,
        error_message: allOk
          ? null
          : "Uma ou mais fontes concluíram com erro; consulte os detalhes da execução.",
      })
      .eq("id", run.id);
    if (runUpdateError) throw runUpdateError;

    return new Response(
      JSON.stringify({
        success: allOk,
        status,
        targetDate,
        windowStart: syncWindow.start.toISOString(),
        windowEnd: syncWindow.end.toISOString(),
        syncMode: syncWindow.mode,
        timezone: "America/Sao_Paulo",
        historicalDataPreserved: true,
        meta: { insights: metaInsights, leads: metaLeads },
        hourly: metaHourly,
        rd: rdSummary,
        rdMetricReconciliation: rdMetricReconciliation,
        rdResync,
      }),
      {
        // Partial coverage is a valid structured result. Return it as JSON
        // with HTTP 200 so callers can read errors, coverage and snapshots.
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : (typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error));
    await admin
      .from("daily_incremental_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", run.id);

    return new Response(JSON.stringify({
      error: message,
      targetDate,
      windowStart: syncWindow.start.toISOString(),
      windowEnd: syncWindow.end.toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
