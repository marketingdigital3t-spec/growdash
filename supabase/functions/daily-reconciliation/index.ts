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
  const { data: run } = await admin
    .from("job_runs")
    .insert({ job_name: jobName, status: "running", trigger_source: "cron" })
    .select("id")
    .single();
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

  const results: unknown[] = [];

  // 1) Reconcile sales <-> RD deals (full backfill window)
  results.push(await runJob("reconcile-sales-rd", async () => {
    const r = await invokeFn("reconcile-sales-rd", { days: 90 });
    if (!r.ok) throw new Error(`reconcile failed: ${r.status} ${JSON.stringify(r.data)}`);
    const created = (r.data as any)?.created ?? 0;
    return { processed: created, metadata: r.data as any };
  }));

  // 2) Enrich states from RD — loop up to 10 batches (≈2000 deals)
  results.push(await runJob("rd-enrich-states", async () => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const r = await invokeFn("rd-enrich-states", { limit: 200 });
      if (!r.ok) throw new Error(`enrich failed: ${r.status}`);
      const updated = (r.data as any)?.updated ?? 0;
      total += updated;
      if (updated < 50) break; // nothing significant left
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

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
