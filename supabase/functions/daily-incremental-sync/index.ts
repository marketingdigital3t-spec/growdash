import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

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
  name: string;
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
  const watermark = previousEnd ? new Date(previousEnd) : new Date(end.getTime() - 15 * 60_000);
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
): Promise<FunctionResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
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
    const semanticFailure = parsed.success === false || parsed.ok === false;
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

function applyReportedFailure(result: FunctionResult): FunctionResult {
  const body = result.body || {};
  const errors = Array.isArray(body.errors) ? body.errors : [];
  const failedAccounts = Number(body.failedAccounts ?? body.failed_accounts ?? 0);
  const skippedDisconnected = Number(body.skipped_disconnected ?? body.skippedDisconnected ?? 0);
  const accountErrors = Array.isArray(body.accounts)
    ? body.accounts.some((account: any) => Boolean(account?.error) || (Array.isArray(account?.errors) && account.errors.length > 0))
    : false;
  const hasReportedFailure = errors.length > 0 || failedAccounts > 0 || skippedDisconnected > 0 || accountErrors;
  return hasReportedFailure ? { ...result, ok: false } : result;
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
      .eq("status", "success")
      .not("window_end", "is", null)
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
    // Both Meta jobs are exact-date and use idempotent upserts. They may run in
    // parallel because they persist to independent fact tables.
    const [metaInsightsRaw, metaLeadsRaw, metaHourlyRaw] = await Promise.all([
      callFunction(supabaseUrl, serviceKey, "sync-meta-insights", {
        startDate: syncWindow.startDate,
        endDate: syncWindow.endDate,
        incremental: true,
        includeBreakdowns: false,
        triggerSource: "quarter_hour_incremental",
      }),
      callFunction(supabaseUrl, serviceKey, "sync-meta-leads", {
        startDate: syncWindow.startDate,
        endDate: syncWindow.endDate,
        triggerSource: "quarter_hour_incremental",
      }),
      callFunction(supabaseUrl, serviceKey, "sync-meta-hourly", {
        startDate: syncWindow.startDate,
        endDate: syncWindow.endDate,
        triggerSource: "quarter_hour_incremental",
      }),
    ]);
    const metaInsights = applyReportedFailure(metaInsightsRaw);
    const metaLeads = applyReportedFailure(metaLeadsRaw);
    const metaHourly = applyReportedFailure(metaHourlyRaw);

    const { data: integrations, error: integrationsError } = await admin
      .from("integrations")
      .select("user_id")
      .eq("provider", "rd_station_crm")
      .eq("is_active", true);
    if (integrationsError) throw integrationsError;

    const ownerIds = Array.from(
      new Set((integrations ?? []).map((row) => String(row.user_id))),
    );
    let rdTargets: RdTarget[] = [];
    if (ownerIds.length) {
      const { data: funnels, error: funnelsError } = await admin
        .from("rd_funnels")
        .select("id,user_id,name")
        .in("user_id", ownerIds)
        .eq("is_active", true)
        .not("rd_funnel_id", "is", null);
      if (funnelsError) throw funnelsError;
      rdTargets = (funnels ?? []) as RdTarget[];
    }

    // Keep a low concurrency to respect RD API rate limits while avoiding one
    // slow funnel blocking all other connected accounts.
    const rdResults = await mapWithConcurrency(rdTargets, 2, async (funnel) => {
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
          max_deals: 10000,
          max_pages: 50,
          trigger_source: "quarter_hour_incremental",
        },
      );
      return {
        funnelId: funnel.id,
        funnelName: funnel.name,
        userId: funnel.user_id,
        ...result,
      };
    });

    // Stage changes on existing deals arrive through the RD webhook. The
    // heavyweight open-deal reconciliation is intentionally opt-in so it
    // cannot block the 15-minute watermark window or create overlapping runs.
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
      { run_id: run.id, trigger_source: "quarter_hour_incremental" },
    );
    const allOk = metaInsights.ok && metaLeads.ok && metaHourly.ok && rdResync.ok && rdMetricReconciliation.ok && rdFailed.length === 0;
    const status = allOk ? "success" : "partial";
    const finishedAt = new Date().toISOString();

    const rdSummary = {
      requested: rdResults.length,
      succeeded: rdResults.length - rdFailed.length,
      failed: rdFailed.length,
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
        status: allOk ? 200 : 207,
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
