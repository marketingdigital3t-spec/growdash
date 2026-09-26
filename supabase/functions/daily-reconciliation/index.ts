import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function invokeFn(name: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, data };
}

async function runJob(jobName: string, fn: () => Promise<{ processed: number; metadata?: Record<string, unknown> }>) {
  const { data: run, error: runInsertError } = await admin
    .from("job_runs")
    .insert({ job_name: jobName, status: "running", trigger_source: "cron" })
    .select("id")
    .single();
  if (runInsertError || !run) throw runInsertError || new Error(`Não foi possível registrar o job ${jobName}`);
  const runId = run?.id;
  try {
    const { processed, metadata } = await fn();
    await admin
      .from("job_runs")
      .update({ status: "success", finished_at: new Date().toISOString(), processed_count: processed, metadata: metadata ?? null })
      .eq("id", runId);
    return { jobName, ok: true, processed, metadata };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("job_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), error_message: msg })
      .eq("id", runId);
    return { jobName, ok: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("DAILY_RECONCILIATION_CRON_SECRET") || Deno.env.get("CRON_SECRET");
  const isService = Boolean(bearer && bearer === SERVICE_ROLE);
  const isCron = Boolean(cronSecret && req.headers.get("x-cron-secret") === cronSecret);
  if (!isService && !isCron) {
    console.warn("daily-reconciliation: unauthorized caller", {
      hasBearer: Boolean(bearer),
      hasCronSecret: Boolean(req.headers.get("x-cron-secret")),
    });
    return new Response(JSON.stringify({ error: "Unauthorized cron request" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: unknown[] = [];
  const { data: rdUsers, error: rdUsersError } = await admin
    .from("rd_account_connections")
    .select("user_id")
    .eq("status", "connected")
    .not("api_token", "is", null);
  if (rdUsersError) return new Response(JSON.stringify({ ok: false, error: "Não foi possível listar conexões RD", details: rdUsersError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const serviceUserIds = Array.from(new Set((rdUsers || []).map((row) => row.user_id).filter(Boolean)));

  // 1) Reconcile sales <-> RD deals (full backfill window)
  results.push(await runJob("reconcile-sales-rd", async () => {
    let processed = 0;
    const metadata: Record<string, unknown> = { users: serviceUserIds.length, results: [] };
    for (const service_user_id of serviceUserIds) {
      const r = await invokeFn("reconcile-sales-rd", { days: 90, service_user_id });
      if (!r.ok) throw new Error(`reconcile failed for ${service_user_id}: ${r.status} ${JSON.stringify(r.data)}`);
      processed += Number((r.data as any)?.created ?? 0);
      (metadata.results as unknown[]).push({ service_user_id, result: r.data });
    }
    return { processed, metadata };
  }));

  // 2) Enrich states from RD — loop up to 10 batches (≈2000 deals)
  results.push(await runJob("rd-enrich-states", async () => {
    let total = 0;
    for (const service_user_id of serviceUserIds) {
      for (let i = 0; i < 10; i++) {
        const r = await invokeFn("rd-enrich-states", { limit: 200, service_user_id });
        if (!r.ok) throw new Error(`enrich failed for ${service_user_id}: ${r.status}`);
        const updated = (r.data as any)?.updated ?? 0;
        total += updated;
        if (updated < 50) break; // nothing significant left
      }
    }
    return { processed: total };
  }));

  // 2.5) Sync real form submissions (Meta Lead Center)
  results.push(await runJob("sync-meta-leads", async () => {
    const r = await invokeFn("sync-meta-leads", { days: 7 });
    if (!r.ok) throw new Error(`sync-meta-leads failed: ${r.status} ${JSON.stringify(r.data)}`);
    const upserted = (r.data as any)?.upserted ?? 0;
    return { processed: upserted, metadata: r.data as any };
  }));

  // 3) Retry Meta sync for accounts with errors or stale syncs (>24h)
  results.push(await runJob("meta-sync-retry", async () => {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: accounts } = await admin
      .from("ad_accounts")
      .select("id, name, last_sync_success_at, last_sync_error_code")
      .or(`last_sync_success_at.is.null,last_sync_success_at.lt.${cutoff},last_sync_error_code.not.is.null`);

    let retried = 0;
    const errors: string[] = [];
    for (const acc of accounts ?? []) {
      // Retry once; sync function handles its own state
      const r = await invokeFn("sync-meta-insights", { ad_account_id: acc.id, days: 7 });
      if (r.ok) retried++;
      else errors.push(`${acc.name}: ${r.status}`);
    }
    return { processed: retried, metadata: { candidates: accounts?.length ?? 0, errors } };
  }));

  const failed = results.filter((result) => (result as { ok?: boolean })?.ok === false).length;
  return new Response(JSON.stringify({ ok: failed === 0, status: failed === 0 ? "success" : "partial", results }), {
    status: failed === 0 ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
