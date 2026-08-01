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

function previousSaoPauloDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const localMidnightUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  );
  return new Date(localMidnightUtc - 86400000).toISOString().slice(0, 10);
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
  try {
    const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { response: raw.slice(0, 4000) };
    }
    return {
      ok: response.ok,
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
  }
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
  const requestedDate = requestBody?.targetDate ?? requestBody?.target_date;
  const targetDate = isService && isIsoDate(requestedDate)
    ? requestedDate
    : previousSaoPauloDate();
  const triggerSource = isService ? "service_role" : "pg_cron";
  const startedAt = new Date().toISOString();

  const { data: run, error: runError } = await admin
    .from("daily_incremental_sync_runs")
    .insert({
      target_date: targetDate,
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
    const [metaInsights, metaLeads] = await Promise.all([
      callFunction(supabaseUrl, serviceKey, "sync-meta-insights", {
        startDate: targetDate,
        endDate: targetDate,
        incremental: true,
        includeBreakdowns: false,
        triggerSource: "daily_previous_day",
      }),
      callFunction(supabaseUrl, serviceKey, "sync-meta-leads", {
        startDate: targetDate,
        endDate: targetDate,
        triggerSource: "daily_previous_day",
      }),
    ]);

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
          start_date: targetDate,
          end_date: targetDate,
          max_deals: 10000,
          max_pages: 50,
          trigger_source: "daily_previous_day",
        },
      );
      return {
        funnelId: funnel.id,
        funnelName: funnel.name,
        userId: funnel.user_id,
        ...result,
      };
    });

    const rdFailed = rdResults.filter((result) => !result.ok);
    const allOk = metaInsights.ok && metaLeads.ok && rdFailed.length === 0;
    const status = allOk ? "success" : "partial";
    const finishedAt = new Date().toISOString();

    const rdSummary = {
      requested: rdResults.length,
      succeeded: rdResults.length - rdFailed.length,
      failed: rdFailed.length,
      results: rdResults,
    };
    await admin
      .from("daily_incremental_sync_runs")
      .update({
        status,
        finished_at: finishedAt,
        meta_insights: metaInsights,
        meta_leads: metaLeads,
        rd: rdSummary,
        error_message: allOk
          ? null
          : "Uma ou mais fontes concluíram com erro; consulte os detalhes da execução.",
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: allOk,
        status,
        targetDate,
        timezone: "America/Sao_Paulo",
        historicalDataPreserved: true,
        meta: { insights: metaInsights, leads: metaLeads },
        rd: rdSummary,
      }),
      {
        status: allOk ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("daily_incremental_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", run.id);

    return new Response(JSON.stringify({ error: message, targetDate }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
