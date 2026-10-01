import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SyncProvider = "meta" | "rd" | "balance";

type SyncBody = {
  adAccountId?: string;
  adAccountIds?: string[];
  campaignIds?: string[];
  funnelIds?: string[];
  startDate?: string;
  endDate?: string;
  timezone?: string;
  attributionWindow?: string;
  includeMeta?: boolean;
  includeRD?: boolean;
  includeBalance?: boolean;
  force?: boolean;
  realtime?: boolean;
};

type RunResult = {
  provider: SyncProvider;
  status?: "success" | "partial" | "failed";
  scope?: string;
  skipped?: boolean;
  reason?: string;
  synced?: number;
  errors?: unknown;
  warnings?: unknown;
  block_status?: Record<string, unknown>;
  synced_at?: string;
  freshness_seconds?: number | null;
};

// A UI pode chamar esta função ao abrir, ao recuperar foco e a cada minuto.
// A trava persistida garante que várias abas/dispositivos nunca multipliquem o
// consumo das APIs para a mesma conta/funil.
const CONTROLLED_SYNC_INTERVAL_MS = 5 * 60 * 1_000;
const RETRY_AFTER_FAILURE_MS = 60 * 1_000;
const LOCK_TTL_MS = 7 * 60 * 1_000;

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
    const startDate = body.startDate || today;
    const endDate = body.endDate || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      return json({ error: "startDate/endDate inválidos; use YYYY-MM-DD e um intervalo crescente." }, 400);
    }
    const accountScope = (body.adAccountIds?.length ? body.adAccountIds : body.adAccountId ? [body.adAccountId] : []).sort().join(",") || "all";
    const campaignScope = (body.campaignIds || []).slice().sort().join(",") || "all-campaigns";
    const scopeKey = `${accountScope}:${campaignScope}:${startDate}:${endDate}:${body.attributionWindow || "account_default"}:${body.timezone || "account"}`;
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
          adAccountIds: body.adAccountIds,
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
            adAccountIds: body.adAccountIds,
            campaignIds: body.campaignIds,
            startDate,
            endDate,
            timezone: body.timezone,
            attributionWindow: body.attributionWindow,
            // Omitting dates lets sync-meta-insights resolve "today" in each
            incremental: true,
            includeBreakdowns: false,
          });
          if (insights.error || insights.data?.error || ["failed", "blocked"].includes(String(insights.data?.status || ""))) return insights;
          if (insights.data?.status === "partial") return { data: { ...insights.data, success: true, status: "partial" } };

          // Leads/forms are an auxiliary Meta resource. Run it after the
          // daily snapshot, but do not invalidate daily KPIs when its token,
          // permission or form discovery is temporarily unavailable.
          const leads = await invokeFunction(supabaseUrl, authHeader, "sync-meta-leads", {
            adAccountId: body.adAccountId,
            adAccountIds: body.adAccountIds,
            startDate,
            endDate,
            triggerSource: "controlled_realtime",
          });

          const hourly = await invokeFunction(supabaseUrl, authHeader, "sync-meta-hourly", {
            adAccountId: body.adAccountId,
            adAccountIds: body.adAccountIds,
            campaignIds: body.campaignIds,
            startDate,
            endDate,
            timezone: body.timezone,
            attributionWindow: body.attributionWindow,
          });
          const warnings = [
            leads.error || leads.data?.error,
            leads.data?.errors,
            leads.data?.status === "partial" ? "Leads/forms Meta parcialmente atualizados." : null,
            hourly.data?.errors,
            hourly.data?.status === "partial" ? "Distribuição horária Meta parcialmente atualizada." : null,
            hourly.error,
          ].filter(Boolean);
          const status = insights.data?.status === "partial"
            ? "partial"
            : insights.data?.status === "failed"
              ? "failed"
              : "success";
          return {
            data: {
              // The controlled result is successful when the primary daily
              // snapshot is successful. Auxiliary warnings remain structured
              // and are retried on the next cycle without a red global state.
              success: true,
              status,
              synced: Number(insights.data?.synced || 0) + Number(hourly.data?.synced || 0),
              warnings: warnings.length ? warnings : undefined,
              block_status: {
                insights: insights.data?.status || "success",
                leads: leads.data?.status || (leads.error ? "error" : "success"),
                hourly: hourly.data?.status || (hourly.error ? "error" : "success"),
              },
            },
          };
        },
      }));
    }

    if (includeRD) {
      // RD funnels are an independent source. A selected Meta account must
      // never hide or suppress another active RD pipeline.
      const funnels = await listAccessibleFunnels(admin, user.id, body.funnelIds);
      if (funnels.length === 0) {
        results.push({ provider: "rd", skipped: true, reason: "Nenhum funil RD vinculado para sincronizar." });
      } else {
        for (const funnel of funnels) {
          results.push(await runControlled({
            admin,
            userId: user.id,
            provider: "rd",
            scopeKey: `funnel:${funnel.id}:${startDate}:${endDate}:${body.timezone || "America/Sao_Paulo"}`,
            force,
            run: () => invokeFunction(supabaseUrl, authHeader, "rd-sync-deals", {
              funnel_id: funnel.id,
              start_date: startDate,
              end_date: endDate,
              realtime,
              analytics_mode: realtime,
              // No explicit dates: the current RD pipeline is a snapshot of
              // all open/current deals, not a lead-entry report for São Paulo.
              // Analytics mode walks every RD status segment and up to the
              // complete bounded page budget instead of only the first 200
              // records. This keeps all connected funnels represented in the
              // near-realtime snapshot; manual full_history remains the
              // authoritative unbounded reconciliation.
              // The five-minute cycle must stay bounded. Full pagination is
              // reserved for the historical/backfill job; otherwise one
              // large funnel keeps the whole UI in "syncing" and no snapshot
              // is refreshed for any other account.
              max_pages: realtime ? 3 : 50,
              max_deals: realtime ? 200 : 3_000,
              trigger_source: realtime ? "auto_realtime" : "manual",
            }),
          }));
        }
      }
    }

    const metaResult = results.find((result) => result.provider === "meta");
    const warnings = results.flatMap((result) => {
      if (result.provider !== "meta" || result.warnings == null) return [];
      return Array.isArray(result.warnings) ? result.warnings : [result.warnings];
    });
    return json({
      success: results.every((result) => result.skipped || result.status !== "failed"),
      status: results.some((result) => result.status === "failed")
        ? "failed"
        : results.some((result) => result.status === "partial") ? "partial" : "success",
      // Consumers that monitor one provider must not infer its health from
      // another provider's pending pages. Keep the aggregate for audit
      // screens, while exposing the per-provider statuses explicitly.
      meta_status: metaResult?.status || (metaResult?.skipped ? "skipped" : "unknown"),
      rd_status: results.find((result) => result.provider === "rd")?.status || "skipped",
      balance_status: results.find((result) => result.provider === "balance")?.status || "skipped",
      freshness_seconds: metaResult?.freshness_seconds ?? null,
      synced_at: metaResult?.synced_at || new Date().toISOString(),
      scope: {
        ad_account_ids: body.adAccountIds?.length ? body.adAccountIds : body.adAccountId ? [body.adAccountId] : [],
        campaign_ids: body.campaignIds || [],
        start_date: startDate,
        end_date: endDate,
        attribution_window: body.attributionWindow || "account_default",
        timezone: body.timezone || "account",
      },
      synchronized_date: endDate,
      duration_ms: Date.now() - startedAt,
      warnings: warnings.length ? warnings : undefined,
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

  // A forced refresh may bypass the five-minute freshness interval, but it
  // must never bypass an active lock. Doing so creates concurrent writers and
  // can mix partial snapshots from different runs.
  if (current?.locked_until && new Date(current.locked_until).getTime() > now.getTime()) {
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
  const { data: acquired, error: lockError } = await admin.rpc("acquire_realtime_sync_lock", {
    p_user_id: userId,
    p_provider: provider,
    p_scope_key: scopeKey,
    p_now: now.toISOString(),
    p_locked_until: lockedUntil,
  });
  if (lockError) throw lockError;
  if (!acquired) return { provider, scope: scopeKey, skipped: true, reason: "Sincronização já está em andamento." };

  try {
    const response = await run();
    const payload = response?.data ?? response ?? {};
    // RD serializa a sincronização por funil. Um 409/ already_running é um
    // lock legítimo de outra execução, não uma falha de credencial ou dados.
    if (String(payload?.status || "") === "already_running" || String(payload?.status || "") === "running") {
      await admin.from("realtime_sync_state").update({
        status: "success",
        last_finished_at: new Date().toISOString(),
        last_error: null,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("provider", provider).eq("scope_key", scopeKey);
      return { provider, scope: scopeKey, status: "success", skipped: true, reason: payload?.message || "Sincronização já está em andamento." };
    }
    const partial = String(payload?.status || "") === "partial";
    const hasError = Boolean(response?.error || payload?.error || payload?.success === false || ["failed", "blocked", "stale_snapshot"].includes(String(payload?.status || "")));
    const finishedAt = new Date().toISOString();
    const error = hasError
      ? stringifyError(response?.error || payload?.error || payload?.errors || "Falha na sincronização")
      : null;

    await admin.from("realtime_sync_state").update({
      status: hasError ? "failed" : partial ? "partial" : "success",
      last_finished_at: finishedAt,
      last_success_at: hasError || partial ? current?.last_success_at ?? null : finishedAt,
      last_error: hasError
        ? error
        : partial
          ? stringifyError(payload?.errors || "Resposta parcial; snapshot anterior preservado.")
          : null,
      locked_until: null,
      updated_at: finishedAt,
    }).eq("user_id", userId).eq("provider", provider).eq("scope_key", scopeKey);

    return {
      provider,
      status: hasError ? "failed" : partial ? "partial" : "success",
      scope: scopeKey,
      synced: Number(payload?.synced || payload?.deals || payload?.updated || 0),
      errors: hasError || partial
        ? (error || stringifyError(payload?.errors || "Resposta parcial; snapshot anterior preservado."))
        : undefined,
      warnings: payload?.warnings,
      block_status: payload?.block_status,
      synced_at: typeof payload?.synced_at === "string" ? payload.synced_at : finishedAt,
      freshness_seconds: payload?.freshness_seconds == null ? null : Number(payload.freshness_seconds),
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
    return { provider, scope: scopeKey, status: "failed", errors: (error as Error).message };
  }
}

async function invokeFunction(supabaseUrl: string, authHeader: string, name: string, body: Record<string, unknown>) {
  const delays = [800, 2_000, 5_000];
  let last: { error?: unknown; data?: any } | null = null;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json().catch(() => null);
      if (response.ok) return { data };
      if (response.status === 409 && data?.status === "already_running") {
        return { data: { ...data, success: true, status: "running" } };
      }
      last = { error: data?.error || `${name} failed with HTTP ${response.status}`, data };
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === delays.length - 1) break;
      const retryAfter = Number(response.headers.get("Retry-After") || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1_000 : delays[attempt]);
    } catch (error) {
      last = { error: error instanceof DOMException && error.name === "AbortError" ? `${name} excedeu 45s; snapshot anterior preservado.` : (error as Error).message };
      if (attempt === delays.length - 1) break;
      await sleep(delays[attempt]);
    }
  }
  return last || { error: `${name} failed` };
}

async function listAccessibleFunnels(admin: ReturnType<typeof createClient>, userId: string, requestedFunnelIds?: string[]) {
  // A CRM reader may use a funnel owned by another account through
  // user_rd_funnel_access. The previous owner-only query silently skipped
  // those funnels during automatic sync, while the CRM itself could display
  // their already-stored deals.
  const { data: grants, error: grantsError } = await admin
    .from("user_rd_funnel_access")
    .select("rd_funnel_id")
    .eq("user_id", userId);
  if (grantsError) throw grantsError;
  const grantedIds = (grants || []).map((row: any) => String(row.rd_funnel_id)).filter(Boolean);

  let query = admin.from("rd_funnels")
    .select("id,ad_account_id,rd_funnel_id,name,user_id")
    .eq("is_active", true)
    .not("rd_funnel_id", "is", null);
  if (grantedIds.length) {
    query = query.or(`user_id.eq.${userId},id.in.(${grantedIds.join(",")})`);
  } else {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const accessible = data || [];
  if (!requestedFunnelIds?.length) return accessible;
  const requested = new Set(requestedFunnelIds);
  return accessible.filter((funnel: any) => requested.has(String(funnel.id)) || requested.has(String(funnel.rd_funnel_id)));
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
