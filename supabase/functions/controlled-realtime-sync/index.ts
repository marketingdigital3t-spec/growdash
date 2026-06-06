import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SyncProvider = "meta" | "rd" | "balance";

type SyncBody = {
  adAccountId?: string;
  startDate?: string;
  endDate?: string;
  includeMeta?: boolean;
  includeRD?: boolean;
  includeBalance?: boolean;
  force?: boolean;
  realtime?: boolean;
};

type RunResult = {
  provider: SyncProvider;
  skipped?: boolean;
  reason?: string;
  synced?: number;
  errors?: unknown;
};

const CONTROLLED_SYNC_INTERVAL_MS = 10_000;
const META_INTERVAL_MS = CONTROLLED_SYNC_INTERVAL_MS;
const RD_INTERVAL_MS = CONTROLLED_SYNC_INTERVAL_MS;
const BALANCE_INTERVAL_MS = CONTROLLED_SYNC_INTERVAL_MS;
const LOCK_TTL_MS = 90_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    let body: SyncBody = {};
    try { body = await req.json(); } catch { body = {}; }

    const today = new Date().toISOString().slice(0, 10);
    const startDate = body.startDate || today;
    const endDate = body.endDate || today;
    const scopeKey = body.adAccountId || "all";
    const includeMeta = body.includeMeta !== false;
    const includeRD = body.includeRD !== false;
    const includeBalance = body.includeBalance !== false;
    const force = !!body.force;
    const realtime = body.realtime !== false;

    const results: RunResult[] = [];

    if (includeBalance) {
      results.push(await runControlled({
        admin,
        userId: user.id,
        provider: "balance",
        scopeKey,
        minIntervalMs: BALANCE_INTERVAL_MS,
        force,
        run: () => invokeFunction(supabaseUrl, authHeader, "sync-meta-balance", {
          adAccountId: body.adAccountId,
        }),
      }));
    }

    if (includeMeta) {
      results.push(await runControlled({
        admin,
        userId: user.id,
        provider: "meta",
        scopeKey: `${scopeKey}:${startDate}:${endDate}`,
        minIntervalMs: META_INTERVAL_MS,
        force,
        run: async () => {
          const [insights, hourly] = await Promise.all([
            invokeFunction(supabaseUrl, authHeader, "sync-meta-insights", {
              adAccountId: body.adAccountId,
              startDate,
              endDate,
            }),
            invokeFunction(supabaseUrl, authHeader, "sync-meta-hourly", {
              adAccountId: body.adAccountId,
              startDate,
              endDate,
            }),
          ]);
          return {
            success: !insights.error && !hourly.error,
            synced: Number(insights.data?.synced || 0) + Number(hourly.data?.synced || 0),
            errors: [insights.data?.errors, hourly.data?.errors, insights.error, hourly.error].filter(Boolean),
          };
        },
      }));
    }

    if (includeRD) {
      const funnels = await listAccessibleFunnels(admin, user.id, body.adAccountId);
      if (funnels.length === 0) {
        results.push({ provider: "rd", skipped: true, reason: "Nenhum funil RD vinculado para sincronizar." });
      } else {
        for (const funnel of funnels) {
          results.push(await runControlled({
            admin,
            userId: user.id,
            provider: "rd",
            scopeKey: String(funnel.id),
            minIntervalMs: RD_INTERVAL_MS,
            force,
            run: () => invokeFunction(supabaseUrl, authHeader, "rd-sync-deals", {
              funnel_id: funnel.id,
              realtime,
              max_pages: realtime ? 1 : 50,
              max_deals: realtime ? 40 : null,
              trigger_source: realtime ? "auto_realtime" : "manual",
            }),
          }));
        }
      }
    }

    return json({
      success: results.every((r) => r.skipped || !r.errors),
      duration_ms: Date.now() - startedAt,
      results,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function runControlled(args: {
  admin: ReturnType<typeof createClient>;
  userId: string;
  provider: SyncProvider;
  scopeKey: string;
  minIntervalMs: number;
  force: boolean;
  run: () => Promise<any>;
}): Promise<RunResult> {
  const { admin, userId, provider, scopeKey, minIntervalMs, force, run } = args;
  const now = new Date();

  const { data: current } = await admin
    .from("realtime_sync_state")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("scope_key", scopeKey)
    .maybeSingle();

  if (!force && current?.locked_until && new Date(current.locked_until).getTime() > now.getTime()) {
    return { provider, skipped: true, reason: "Sincronização já em andamento." };
  }

  if (!force && current?.last_started_at) {
    const elapsed = now.getTime() - new Date(current.last_started_at).getTime();
    if (elapsed < minIntervalMs) {
      return {
        provider,
        skipped: true,
        reason: `Intervalo mínimo ativo (${Math.ceil((minIntervalMs - elapsed) / 1000)}s restantes).`,
      };
    }
  }

  const lockedUntil = new Date(now.getTime() + LOCK_TTL_MS).toISOString();
  const baseState = {
    user_id: userId,
    provider,
    scope_key: scopeKey,
    status: "running",
    last_started_at: now.toISOString(),
    locked_until: lockedUntil,
    updated_at: now.toISOString(),
  };

  await admin.from("realtime_sync_state").upsert(baseState, {
    onConflict: "user_id,provider,scope_key",
  });

  try {
    const response = await run();
    const hasError = !!response.error || !!response.data?.error;
    const finishedAt = new Date().toISOString();

    await admin
      .from("realtime_sync_state")
      .update({
        status: hasError ? "failed" : "success",
        last_finished_at: finishedAt,
        last_success_at: hasError ? current?.last_success_at ?? null : finishedAt,
        last_error: hasError ? stringifyError(response.error || response.data?.error || response.data?.errors) : null,
        locked_until: null,
        updated_at: finishedAt,
      })
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("scope_key", scopeKey);

    return {
      provider,
      synced: Number(response.data?.synced || 0),
      errors: hasError ? response.error || response.data?.error || response.data?.errors : undefined,
    };
  } catch (e) {
    const finishedAt = new Date().toISOString();
    await admin
      .from("realtime_sync_state")
      .update({
        status: "failed",
        last_finished_at: finishedAt,
        last_error: (e as Error).message,
        locked_until: null,
        updated_at: finishedAt,
      })
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("scope_key", scopeKey);

    return { provider, errors: (e as Error).message };
  }
}

async function invokeFunction(supabaseUrl: string, authHeader: string, name: string, body: Record<string, unknown>) {
  const attempts = 3;
  const delays = [800, 2_000, 5_000];
  let last: { error?: unknown; data?: any } | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let data: any = null;
      try { data = await res.json(); } catch { data = null; }

      if (res.ok) return { data };

      last = { error: data?.error || `${name} failed with HTTP ${res.status}`, data };
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt === attempts - 1) break;

      const retryAfter = Number(res.headers.get("Retry-After") || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1000 : delays[attempt]);
    } catch (error) {
      last = { error: (error as Error).message };
      if (attempt === attempts - 1) break;
      await sleep(delays[attempt]);
    }
  }

  return last || { error: `${name} failed` };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function listAccessibleFunnels(admin: ReturnType<typeof createClient>, userId: string, adAccountId?: string) {
  let q = admin
    .from("rd_funnels")
    .select("id, ad_account_id, rd_funnel_id, name, user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("rd_funnel_id", "is", null);

  if (adAccountId) q = q.eq("ad_account_id", adAccountId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

function stringifyError(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 1000);
  try { return JSON.stringify(value).slice(0, 1000); } catch { return String(value).slice(0, 1000); }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
