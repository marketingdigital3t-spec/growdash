import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

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
  scope?: string;
  skipped?: boolean;
  reason?: string;
  synced?: number;
  errors?: unknown;
};

// A UI pode chamar esta função ao abrir, ao recuperar foco e a cada 15 minutos.
// A trava persistida garante que várias abas/dispositivos nunca multipliquem o
// consumo das APIs para a mesma conta/funil.
const CONTROLLED_SYNC_INTERVAL_MS = 15 * 60 * 1_000;
const RETRY_AFTER_FAILURE_MS = 2 * 60 * 1_000;
const LOCK_TTL_MS = 12 * 60 * 1_000;

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

    const today = dateInSaoPaulo(new Date());
    // Atualização automática toca somente o dia corrente. Intervalos históricos
    // continuam disponíveis nas rotas manuais/backfill, sem serem reprocessados.
    const startDate = body.startDate || today;
    const endDate = body.endDate || today;
    const scopeKey = body.adAccountId || "all";
    const includeMeta = body.includeMeta !== false;
    const includeRD = body.includeRD !== false;
    const includeBalance = body.includeBalance !== false;
    const force = body.force === true;
    const realtime = body.realtime !== false;
    const results: RunResult[] = [];

    if (includeBalance) {
      results.push(await runControlled({
        admin,
        userId: user.id,
        provider: "balance",
        scopeKey,
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
        scopeKey: `${scopeKey}:${today}`,
        force,
        run: async () => {
          // O horário depende dos totais diários; executar em sequência evita
          // corrida e discrepância entre cards e gráficos por hora.
          const insights = await invokeFunction(supabaseUrl, authHeader, "sync-meta-insights", {
            adAccountId: body.adAccountId,
            startDate,
            endDate,
            incremental: true,
            includeBreakdowns: false,
          });
          if (insights.error || insights.data?.error || insights.data?.success === false) return insights;

          const hourly = await invokeFunction(supabaseUrl, authHeader, "sync-meta-hourly", {
            adAccountId: body.adAccountId,
            startDate,
            endDate,
          });
          const errors = [insights.data?.errors, hourly.data?.errors, hourly.error].filter(Boolean);
          return {
            data: {
              success: !hourly.error && hourly.data?.success !== false,
              synced: Number(insights.data?.synced || 0) + Number(hourly.data?.synced || 0),
              errors: errors.length ? errors : undefined,
              error: hourly.error || hourly.data?.error,
            },
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
            force,
            run: () => invokeFunction(supabaseUrl, authHeader, "rd-sync-deals", {
              funnel_id: funnel.id,
              realtime,
              analytics_mode: realtime,
              start_date: realtime ? today : undefined,
              end_date: realtime ? today : undefined,
              max_pages: realtime ? 1 : 50,
              max_deals: realtime ? 200 : 3_000,
              trigger_source: realtime ? "auto_realtime" : "manual",
            }),
          }));
        }
      }
    }

    return json({
      success: results.every((result) => result.skipped || !result.errors),
      freshness_seconds: 15 * 60,
      synchronized_date: today,
      duration_ms: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

async function runControlled(args: {
  admin: ReturnType<typeof createClient>;
  userId: string;
  provider: SyncProvider;
  scopeKey: string;
  force: boolean;
  run: () => Promise<any>;
}): Promise<RunResult> {
  const { admin, userId, provider, scopeKey, force, run } = args;
  const now = new Date();
  const { data: current } = await admin
    .from("realtime_sync_state")
    .select("status,last_started_at,last_success_at,last_error,locked_until")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("scope_key", scopeKey)
    .maybeSingle();

  if (!force && current?.locked_until && new Date(current.locked_until).getTime() > now.getTime()) {
    return { provider, scope: scopeKey, skipped: true, reason: "Sincronização já em andamento." };
  }

  const reference = current?.status === "success" ? current.last_success_at : current?.last_started_at;
  const minInterval = current?.status === "failed" ? RETRY_AFTER_FAILURE_MS : CONTROLLED_SYNC_INTERVAL_MS;
  if (!force && reference) {
    const elapsed = now.getTime() - new Date(reference).getTime();
    if (elapsed < minInterval) {
      return {
        provider,
        scope: scopeKey,
        skipped: true,
        reason: `Dados ainda atuais; próxima atualização em ${Math.ceil((minInterval - elapsed) / 60_000)} min.`,
      };
    }
  }

  const lockedUntil = new Date(now.getTime() + LOCK_TTL_MS).toISOString();
  await admin.from("realtime_sync_state").upsert({
    user_id: userId,
    provider,
    scope_key: scopeKey,
    status: "running",
    last_started_at: now.toISOString(),
    locked_until: lockedUntil,
    updated_at: now.toISOString(),
  }, { onConflict: "user_id,provider,scope_key" });

  try {
    const response = await run();
    const payload = response?.data ?? response ?? {};
    const hasError = Boolean(response?.error || payload?.error || payload?.success === false);
    const finishedAt = new Date().toISOString();
    const error = hasError
      ? stringifyError(response?.error || payload?.error || payload?.errors || "Falha na sincronização")
      : null;

    await admin.from("realtime_sync_state").update({
      status: hasError ? "failed" : "success",
      last_finished_at: finishedAt,
      last_success_at: hasError ? current?.last_success_at ?? null : finishedAt,
      last_error: error,
      locked_until: null,
      updated_at: finishedAt,
    }).eq("user_id", userId).eq("provider", provider).eq("scope_key", scopeKey);

    return {
      provider,
      scope: scopeKey,
      synced: Number(payload?.synced || payload?.deals || payload?.updated || 0),
      errors: hasError ? error : undefined,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await admin.from("realtime_sync_state").update({
      status: "failed",
      last_finished_at: finishedAt,
      last_error: (error as Error).message,
      locked_until: null,
      updated_at: finishedAt,
    }).eq("user_id", userId).eq("provider", provider).eq("scope_key", scopeKey);
    return { provider, scope: scopeKey, errors: (error as Error).message };
  }
}

async function invokeFunction(supabaseUrl: string, authHeader: string, name: string, body: Record<string, unknown>) {
  const delays = [800, 2_000, 5_000];
  let last: { error?: unknown; data?: any } | null = null;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (response.ok) return { data };
      last = { error: data?.error || `${name} failed with HTTP ${response.status}`, data };
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === delays.length - 1) break;
      const retryAfter = Number(response.headers.get("Retry-After") || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1_000 : delays[attempt]);
    } catch (error) {
      last = { error: (error as Error).message };
      if (attempt === delays.length - 1) break;
      await sleep(delays[attempt]);
    }
  }
  return last || { error: `${name} failed` };
}

async function listAccessibleFunnels(admin: ReturnType<typeof createClient>, userId: string, adAccountId?: string) {
  let query = admin.from("rd_funnels")
    .select("id,ad_account_id,rd_funnel_id,name,user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("rd_funnel_id", "is", null);
  if (adAccountId) query = query.eq("ad_account_id", adAccountId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function dateInSaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function stringifyError(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 1_000);
  try { return JSON.stringify(value).slice(0, 1_000); } catch { return String(value).slice(0, 1_000); }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
