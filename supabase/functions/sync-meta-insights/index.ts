import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { datesSafeToReconcile, staleActionFactsForDailySnapshot, staleAdIdsForDailySnapshot } from "../_shared/metaInsightReconciliation.ts";
import { CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, META_LEAD_ACTION_TYPES, SITE_ACTION_TYPES, resolveMetaLeadParts } from "../_shared/metaLeadMetrics.ts";
import { isMetaMessagingDestination } from "../../../src/lib/metaLeadScope.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function connectionStatusForMetaError(errorCode: number | undefined, retryable: boolean) {
  if (errorCode === 190) return "expired";
  // A retryable Graph failure is an operational sync problem, not proof that
  // OAuth was revoked. Keep the account eligible for the next worker cycle.
  if (retryable) return "connected";
  // Permission and account access errors remain visible as a connection error
  // and require an explicit correction in Meta.
  if ([10, 100, 200].includes(Number(errorCode))) return "error";
  return "connected";
}

const FORM_ACTIONS = [...FORM_ACTION_TYPES];
const SITE_ACTIONS = [...SITE_ACTION_TYPES];
// Persist only canonical form, site and started-conversation actions. Auxiliary
// connections and replies stay out of the lead evidence set.
const TRACKED_META_LEAD_ACTIONS = [...META_LEAD_ACTION_TYPES];
const PURCHASE_ACTIONS = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

function preferredAction(actions: any[], aliases: string[]) {
  const values = aliases
    .map((alias) => actions.find((item: any) => item.action_type === alias))
    .filter(Boolean)
    .map((item: any) => Math.max(0, Number(item.value || 0)));
  return values.length ? Math.max(...values) : 0;
}

function canonicalLeadParts(actions: any[], lpAction: string | null, destinationType?: string | null) {
  const values: Record<string, number> = {};
  for (const action of actions) {
    const type = String(action.action_type || "");
    values[type] = Math.max(Number(values[type] || 0), Math.max(0, Number(action.value || 0)));
  }
  const siteDestinationConfirmed = String(destinationType || "").toUpperCase() === "WEBSITE";
  return resolveMetaLeadParts(values, lpAction || undefined, siteDestinationConfirmed, isMetaMessagingDestination(destinationType));
}

function canonicalResult(objective: string | null, optimizationGoal: string | null, actions: any[], lpAction: string | null, destinationType?: string | null) {
  const objectiveKey = String(objective || "").toUpperCase();
  const goalKey = String(optimizationGoal || "").toUpperCase();
  const leads = canonicalLeadParts(actions, lpAction, destinationType);
  if (objectiveKey.includes("SALES") || objectiveKey.includes("CONVERSION") || goalKey.includes("PURCHASE")) {
    return { type: "purchase", value: preferredAction(actions, PURCHASE_ACTIONS) };
  }
  if (objectiveKey.includes("TRAFFIC") || goalKey.includes("LANDING_PAGE_VIEW")) {
    return { type: "landing_page_view", value: preferredAction(actions, ["landing_page_view", "link_click"]) };
  }
  if (objectiveKey.includes("ENGAGEMENT") || objectiveKey.includes("MESSAGING") || goalKey.includes("CONVERSATION")) {
    return { type: "conversations", value: leads.conversations };
  }
  if (objectiveKey.includes("AWARENESS") || goalKey.includes("REACH")) {
    return { type: "reach", value: 0 };
  }
  // The canonical Meta lead KPI is the sum of the three disjoint components.
  // Conversations are intentionally included here so result cards and
  // `insights.leads` cannot disagree with the action totals used by the UI.
  return { type: "leads", value: leads.forms + leads.site + leads.conversations };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    // Cron-only path: pg_cron invokes with the service role key. Client-controlled
    // body flags are NOT trusted for skipping auth.
    const isCron = bearer.length > 0 && bearer === supabaseServiceKey;

    let userId: string | null = null;
    if (!isCron) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const adAccountId = typeof body.adAccountId === "string" ? body.adAccountId : undefined;
    const adAccountIds = Array.isArray(body.adAccountIds)
      ? body.adAccountIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const campaignIds = Array.isArray(body.campaignIds)
      ? body.campaignIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const requestedAttributionWindow = typeof body.attributionWindow === "string" ? body.attributionWindow.trim() : "";
    const includeBreakdowns = body.includeBreakdowns === true;
    const requestedBreakdownStartDate = typeof body.breakdownStartDate === "string" ? body.breakdownStartDate : undefined;
    const requestedBreakdownEndDate = typeof body.breakdownEndDate === "string" ? body.breakdownEndDate : undefined;
    const incremental = body.incremental === true;
    // A sincronização sem intervalo é sempre incremental. Backfills continuam
    // enviando startDate/endDate explicitamente e preservam todo o histórico.
    const requestedStartDate = body.startDate;
    const requestedEndDate = body.endDate;
    const syncStartedAt = new Date().toISOString();
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
    const graphBase = `https://graph.facebook.com/${graphVersion}`;

    let accountsQuery = supabaseAdmin.from("ad_accounts").select("*");
    if (adAccountId) accountsQuery = accountsQuery.eq("id", adAccountId);
    else if (adAccountIds.length > 0) accountsQuery = accountsQuery.in("id", adAccountIds);
    if (userId) accountsQuery = accountsQuery.eq("user_id", userId);
    const { data: allAccounts, error: accError } = await accountsQuery;
    if (accError) throw accError;

    const blockedStatuses = new Set(["disconnected", "blocked"]);
    const blockedOAuthStatuses = new Set(["permission_removed", "expired", "invalid"]);
    // An OAuth health flag can be stale after a successful reconnect (the
    // token is replaced before the monitoring cycle clears the old flag).
    // Do not discard an account that still has a token: let the Graph API be
    // the authority. A real 190/permission response below will mark it
    // invalid and block it; this prevents valid accounts from returning the
    // misleading "all accounts blocked" result and leaving today's metrics at
    // zero.
    const disconnectedAccounts = (allAccounts || []).filter((account: any) => {
      const hasToken = typeof account.access_token === "string" && account.access_token.trim().length > 0;
      // A manual disconnect is an explicit user decision. It must remain out
      // of every automatic sync until OAuth reconnects it, even if an old
      // token/error is still stored on the row.
      const manuallyDisabled = blockedStatuses.has(String(account.connection_status || ""));
      return manuallyDisabled ||
        (blockedOAuthStatuses.has(String(account.oauth_health_status || "")) && !hasToken);
    });
    const accounts = (allAccounts || []).filter((account: any) => !disconnectedAccounts.some((blocked: any) => blocked.id === account.id));

    if (!accounts || accounts.length === 0) {
      const blocked = disconnectedAccounts?.length || 0;
      return new Response(
        JSON.stringify({
          success: blocked === 0,
          status: blocked === 0 ? "success" : "blocked",
          message: blocked === 0 ? "Nenhuma conta de anúncio ativa encontrada" : "Todas as contas de anúncio selecionadas estão bloqueadas",
          error: blocked === 0 ? undefined : "Todas as contas Meta selecionadas estão bloqueadas ou sem permissão válida.",
          synced: 0,
          accounts: 0,
          skipped_disconnected: blocked,
          synced_at: null,
          freshness_seconds: null,
          scope: { ad_account_ids: adAccountIds.length ? adAccountIds : adAccountId ? [adAccountId] : [], start_date: requestedStartDate || null, end_date: requestedEndDate || null },
        }),
        // Keep the structured blocked status available to Supabase clients;
        // HTTP 200 does not mean the sync succeeded, `status` carries that.
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSynced = 0;
    let totalPages = 0;
    let lastCursor: string | null = null;
    const errors: string[] = [];
    let needsReauth = false;
    let failedAccounts = 0;
    const accountResults: any[] = [];

    for (const account of accounts) {
      const attemptedAt = new Date().toISOString();
      let accountHadError = false;
      // Insights is the primary KPI snapshot. Auxiliary audience breakdowns
      // may fail independently without invalidating the daily media facts.
      const auxiliaryErrors: string[] = [];
      let accountLockScopeKey: string | null = null;
      let accountLockAcquired = false;
      let metaRunId: string | null = null;
      let accountPagesProcessed = 0;
      let contractInsightsWritten = 0;
      let contractActionsWritten = 0;
      let contractBreakdownsWritten = 0;
      const recordPagination = (result: { pages?: number; lastCursor?: string; truncated?: boolean; repeatedCursor?: boolean }, label = "consulta") => {
        totalPages += Number(result.pages || 0);
        accountPagesProcessed += Number(result.pages || 0);
        if (result.lastCursor) lastCursor = result.lastCursor;
        if (result.truncated || result.repeatedCursor) {
          const message = `Conta ${account.name} ${label}: paginação incompleta; o snapshot anterior foi preservado.`;
          if (label === "insights") {
            accountHadError = true;
            errors.push(message);
          } else {
            auxiliaryErrors.push(message);
            errors.push(message);
          }
        }
      };
      try {
        const effectiveTimezone = account.timezone_name || "America/Sao_Paulo";
        const accountToday = new Intl.DateTimeFormat("en-CA", {
          timeZone: effectiveTimezone,
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        // Calendar scopes are inclusive business dates. Never let a browser
        // timezone conversion turn "Hoje" into a future Meta day; Meta has no
        // facts for that day yet and would otherwise look like a false zero.
        const requestedStart = typeof requestedStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate)
          ? requestedStartDate
          : accountToday;
        const requestedEnd = typeof requestedEndDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedEndDate)
          ? requestedEndDate
          : accountToday;
        const endDate = requestedEnd > accountToday ? accountToday : requestedEnd;
        const startDate = requestedStart > endDate ? endDate : requestedStart;
        // Audience reports multiply Graph API calls. Keep their range scoped
        // to the visible dashboard period, independent from media backfills.
        const breakdownStartDate = requestedBreakdownStartDate || startDate;
        const breakdownEndDate = requestedBreakdownEndDate || endDate;
        const attributionWindows = requestedAttributionWindow && requestedAttributionWindow !== "account_default"
          ? requestedAttributionWindow.split(",").map((value: string) => value.trim()).filter(Boolean)
          : account.attribution_window && account.attribution_window !== "account_default"
          ? String(account.attribution_window).split(",").map((value: string) => value.trim()).filter(Boolean)
          : [];
        const effectiveAttributionWindow = attributionWindows.length ? attributionWindows.join(",") : "account_default";
        const attributionParam = attributionWindows.length
          ? `&action_attribution_windows=${encodeURIComponent(JSON.stringify(attributionWindows))}`
          : "";
        const accessToken = account.access_token;
        const rawAccountId = account.account_id;
        const metaAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`;

        // Additive audit record for the canonical contract. Legacy tables and
        // their writes remain unchanged throughout this rollout.
        const { data: metaRun, error: metaRunError } = await supabaseAdmin
          .from("meta_sync_runs")
          .insert({
            ad_account_id: String(account.id),
            status: "running",
            triggered_by: isCron ? "cron" : "manual",
            period_start: startDate,
            period_end: endDate,
          })
          .select("id")
          .single();
        if (metaRunError) throw new Error(`execução Meta da conta ${account.name}: ${metaRunError.message}`);
        metaRunId = metaRun?.id || null;

        const updateMetaRun = async (status: "running" | "completed" | "partial" | "failed", errorMessage: string | null = null) => {
          if (!metaRunId) return;
          await supabaseAdmin.from("meta_sync_runs").update({
            status,
            pages_processed: accountPagesProcessed,
            insights_written: contractInsightsWritten,
            actions_written: contractActionsWritten,
            breakdowns_written: contractBreakdownsWritten,
            errors_total: auxiliaryErrors.length + (accountHadError ? 1 : 0),
            error_message: errorMessage,
            finished_at: status === "running" ? null : new Date().toISOString(),
          }).eq("id", metaRunId);
        };

        // Every writer (manual, cron or backfill) takes the same per-account
        // lock. The coordinator lock alone is not enough because direct
        // function calls could otherwise write the same facts concurrently.
        // Overlapping date windows for the same account can reconcile the
        // same facts. Lock at account level so a wider/older sync cannot race
        // a selected-day refresh and erase its newly persisted rows.
        accountLockScopeKey = `meta-account:${account.id}`;
        const { data: acquired, error: lockError } = await supabaseAdmin.rpc("acquire_realtime_sync_lock", {
          p_user_id: account.user_id,
          p_provider: "meta",
          p_scope_key: accountLockScopeKey,
          p_now: new Date().toISOString(),
          p_locked_until: new Date(Date.now() + 7 * 60_000).toISOString(),
        });
        if (lockError) throw lockError;
        if (!acquired) {
          errors.push(`Conta ${account.name}: sincronização já está em andamento; snapshot preservado.`);
          await updateMetaRun("failed", `Conta ${account.name}: sincronização já está em andamento; snapshot preservado.`);
          continue;
        }
        accountLockAcquired = true;
        await writeMetaScopeState(supabaseAdmin, {
          accountId: account.id,
          campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
          startDate,
          endDate,
          timezone: effectiveTimezone,
          attributionWindow: effectiveAttributionWindow,
          status: "syncing",
          lastAttemptAt: attemptedAt,
          blockStatus: { insights: { status: "syncing" }, actions: { status: "pending" }, hourly: { status: "pending" }, breakdowns: { status: "pending" } },
        });

        console.log(`Syncing: ${account.name} (${metaAccountId})`);

        // 1. Fetch campaigns (incluindo arquivadas/finalizadas)
        const campaignStatusFilter = encodeURIComponent(JSON.stringify([{
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"],
        }]));
        const adsetStatusFilter = encodeURIComponent(JSON.stringify([{
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "CAMPAIGN_PAUSED", "IN_PROCESS", "WITH_ISSUES"],
        }]));
        const adStatusFilter = encodeURIComponent(JSON.stringify([{
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "IN_PROCESS", "WITH_ISSUES"],
        }]));
        const campaignsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/campaigns?fields=id,name,objective,effective_status,daily_budget,lifetime_budget&filtering=${campaignStatusFilter}&access_token=${accessToken}&limit=200`
        );
        recordPagination(campaignsRes);
        if (campaignsRes.error) {
          const message = `Conta ${account.name} catálogo de campanhas: ${campaignsRes.error}`;
          auxiliaryErrors.push(message);
          errors.push(message);
          // Catalog enrichment is deliberately non-blocking. Insights below
          // is the source of truth for spend/delivery and must still run when
          // Meta denies or times out the campaign catalog.
          console.warn(message);
        }
        const campaigns = campaignsRes.data;
        console.log(`Found ${campaigns.length} campaigns (incl. archived/completed)`);

        // Batch upsert campaigns + detect status changes / track last_activated_at
        if (campaigns.length > 0) {
          const ids = campaigns.map((c: any) => c.id);
          const { data: prevCampaigns } = await supabaseAdmin
            .from("campaigns").select("id, status, last_activated_at").in("id", ids);
          const prevMap = new Map((prevCampaigns || []).map((c: any) => [c.id, c]));

          const campaignChanges: any[] = [];
          const upsertRows = campaigns.map((c: any) => {
            const newStatus = c.effective_status || null;
            const prev = prevMap.get(c.id);
            const prevStatus = prev?.status ?? null;
            let last_activated_at = prev?.last_activated_at ?? null;
            if (newStatus === "ACTIVE" && prevStatus !== "ACTIVE") {
              last_activated_at = new Date().toISOString();
              if (prevStatus) {
                campaignChanges.push({
                  campaign_id: c.id, entity_type: "campaign", entity_id: c.id,
                  change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus,
                });
              }
            } else if (prevStatus && newStatus && prevStatus !== newStatus) {
              campaignChanges.push({
                campaign_id: c.id, entity_type: "campaign", entity_id: c.id,
                change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus,
              });
            }
            return {
              id: c.id, name: c.name, ad_account_id: account.id,
              objective: c.objective || null, status: newStatus,
              daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
              lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
              previous_status: prevStatus, last_activated_at,
            };
          });
          try {
            throwIfError(await supabaseAdmin.from("campaigns").upsert(upsertRows, { onConflict: "id" }), `campanhas da conta ${account.name}`);
          } catch (error) {
            const message = `Conta ${account.name} catálogo de campanhas: ${(error as Error).message}`;
            auxiliaryErrors.push(message);
            errors.push(message);
            console.warn(message);
          }
          if (campaignChanges.length > 0) {
            try {
              throwIfError(await supabaseAdmin.from("campaign_changes").insert(campaignChanges), `histórico de campanhas da conta ${account.name}`);
            } catch (error) {
              const message = `Conta ${account.name} histórico de campanhas: ${(error as Error).message}`;
              auxiliaryErrors.push(message);
              errors.push(message);
              console.warn(message);
            }
          }
        }

        // 2. Fetch adsets (incluindo arquivadas)
        const adsetsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/adsets?fields=id,name,campaign_id,daily_budget,effective_status,destination_type,optimization_goal&filtering=${adsetStatusFilter}&access_token=${accessToken}&limit=200`
        );
        recordPagination(adsetsRes);
        if (adsetsRes.error) {
          const message = `Conta ${account.name} conjuntos: ${adsetsRes.error}`;
          errors.push(message);
          auxiliaryErrors.push(message);
        }
        const adsetsList = adsetsRes.data;
        if (adsetsList.length > 0) {
          console.log(`Found ${adsetsList.length} adsets`);
          const ids = adsetsList.map((a: any) => a.id);
          const { data: prev } = await supabaseAdmin
            .from("adsets").select("id, status, last_activated_at, campaign_id, destination_type, optimization_goal").in("id", ids);
          const prevMap = new Map((prev || []).map((a: any) => [a.id, a]));
          const changes: any[] = [];
          const rows = adsetsList.map((a: any) => {
            const newStatus = a.effective_status || null;
            const p = prevMap.get(a.id);
            const prevStatus = p?.status ?? null;
            let last_activated_at = p?.last_activated_at ?? null;
            if (newStatus === "ACTIVE" && prevStatus !== "ACTIVE") {
              last_activated_at = new Date().toISOString();
              if (prevStatus) changes.push({ campaign_id: a.campaign_id, entity_type: "adset", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            } else if (prevStatus && newStatus && prevStatus !== newStatus) {
              changes.push({ campaign_id: a.campaign_id, entity_type: "adset", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            }
            return {
              id: a.id, name: a.name, campaign_id: a.campaign_id,
              daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
              status: newStatus, previous_status: prevStatus, last_activated_at,
              // Meta can omit destination_type/optimization_goal for archived
              // sets. Preserve the last confirmed catalog value so a partial
              // catalog response cannot make canonical lead classification
              // incomplete and leave stale lead totals in place.
              destination_type: a.destination_type ?? p?.destination_type ?? null,
              optimization_goal: a.optimization_goal ?? p?.optimization_goal ?? null,
            };
          });
          try {
            throwIfError(await supabaseAdmin.from("adsets").upsert(rows, { onConflict: "id" }), `conjuntos da conta ${account.name}`);
            if (changes.length > 0) throwIfError(await supabaseAdmin.from("campaign_changes").insert(changes), `histórico de conjuntos da conta ${account.name}`);
          } catch (error) {
            const message = `Conta ${account.name} catálogo de conjuntos: ${(error as Error).message}`;
            errors.push(message);
            auxiliaryErrors.push(message);
            console.warn(message);
          }
        }

        // 3. Fetch ads (incluindo arquivados)
        const adsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/ads?fields=id,name,adset_id,effective_status,creative{id,thumbnail_url,image_url}&filtering=${adStatusFilter}&access_token=${accessToken}&limit=200`
        );
        recordPagination(adsRes);
        if (adsRes.error) {
          const message = `Conta ${account.name} anúncios: ${adsRes.error}`;
          errors.push(message);
          auxiliaryErrors.push(message);
        }
        const adsList = adsRes.data;
        if (adsList.length > 0) {
          console.log(`Found ${adsList.length} ads`);
          const ids = adsList.map((a: any) => a.id);
          const { data: prev } = await supabaseAdmin
            .from("ads").select("id, status, last_activated_at, adset_id").in("id", ids);
          const prevMap = new Map((prev || []).map((a: any) => [a.id, a]));
          // Need campaign_id for change log: fetch adsets
          const adsetIds = [...new Set(adsList.map((a: any) => a.adset_id).filter(Boolean))];
          const { data: adsetRows } = await supabaseAdmin
            .from("adsets").select("id, campaign_id").in("id", adsetIds);
          const adsetCampaign = new Map((adsetRows || []).map((r: any) => [r.id, r.campaign_id]));
          const changes: any[] = [];
          const rows = adsList.map((a: any) => {
            const newStatus = a.effective_status || null;
            const p = prevMap.get(a.id);
            const prevStatus = p?.status ?? null;
            let last_activated_at = p?.last_activated_at ?? null;
            const campaignId = adsetCampaign.get(a.adset_id);
            if (newStatus === "ACTIVE" && prevStatus !== "ACTIVE") {
              last_activated_at = new Date().toISOString();
              if (prevStatus && campaignId) changes.push({ campaign_id: campaignId, entity_type: "ad", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            } else if (prevStatus && newStatus && prevStatus !== newStatus && campaignId) {
              changes.push({ campaign_id: campaignId, entity_type: "ad", entity_id: a.id, change_type: "status", field: "status", old_value: prevStatus, new_value: newStatus });
            }
            return {
              id: a.id, name: a.name, adset_id: a.adset_id,
              creative_id: a.creative?.id || null,
              thumbnail_url: a.creative?.thumbnail_url || a.creative?.image_url || null,
              status: newStatus, previous_status: prevStatus, last_activated_at,
            };
          });
          try {
            throwIfError(await supabaseAdmin.from("ads").upsert(rows, { onConflict: "id" }), `anúncios da conta ${account.name}`);
            if (changes.length > 0) throwIfError(await supabaseAdmin.from("campaign_changes").insert(changes), `histórico de anúncios da conta ${account.name}`);
          } catch (error) {
            const message = `Conta ${account.name} catálogo de anúncios: ${(error as Error).message}`;
            errors.push(message);
            auxiliaryErrors.push(message);
            console.warn(message);
          }
        }

        // 3.5 O histórico de atividades dos últimos 60 dias é pesado. Ele roda
        // apenas em sincronizações manuais/backfill; o ciclo de 15 min atualiza
        // somente entidades e métricas do dia.
        if (!incremental) try {
          const since = Math.floor((Date.now() - 60 * 86400000) / 1000); // last 60d
          const until = Math.floor(Date.now() / 1000);
          let activitiesUrl = `${graphBase}/${metaAccountId}/activities?fields=event_time,event_type,translated_event_type,object_id,object_name,object_type,extra_data&since=${since}&until=${until}&access_token=${accessToken}&limit=200`;
          const seenActivityPages = new Set<string>();
          const activityRows: any[] = [];
          // map adset->campaign and ad->campaign for activity attribution
          const { data: allAdsets } = await supabaseAdmin.from("adsets").select("id, campaign_id");
          const adsetToCampaign = new Map((allAdsets || []).map((r: any) => [String(r.id), r.campaign_id]));
          const { data: allAds } = await supabaseAdmin.from("ads").select("id, adset_id");
          const adToCampaign = new Map(
            (allAds || []).map((r: any) => [String(r.id), adsetToCampaign.get(String(r.adset_id))])
          );
          const validCampaignIds = new Set(campaigns.map((c: any) => String(c.id)));

          while (activitiesUrl) {
            if (seenActivityPages.has(activitiesUrl)) {
              console.warn("Activities pagination cursor repeated; stopping safely.");
              break;
            }
            seenActivityPages.add(activitiesUrl);
            const actData = await fetchMeta(activitiesUrl);
            if (actData.error) {
              const message = `Conta ${account.name} atividades: ${actData.error.message}`;
              errors.push(message);
              auxiliaryErrors.push(message);
              console.warn(message);
              break;
            }
            for (const ev of (actData.data || [])) {
              const objType = String(ev.object_type || "").toLowerCase();
              const objId = String(ev.object_id || "");
              let campaignId: string | null = null;
              let entityType = "campaign";
              if (objType.includes("campaign") || validCampaignIds.has(objId)) {
                if (validCampaignIds.has(objId)) { campaignId = objId; entityType = "campaign"; }
              } else if (objType.includes("adset") || objType.includes("ad set")) {
                campaignId = adsetToCampaign.get(objId) ?? null;
                entityType = "adset";
              } else if (objType.includes("ad")) {
                campaignId = adToCampaign.get(objId) ?? null;
                entityType = "ad";
              }
              if (!campaignId) continue;
              const extra = ev.extra_data ? (typeof ev.extra_data === "string" ? safeParse(ev.extra_data) : ev.extra_data) : null;
              activityRows.push({
                campaign_id: campaignId,
                entity_type: entityType,
                entity_id: objId || null,
                changed_at: ev.event_time ? new Date(ev.event_time).toISOString() : new Date().toISOString(),
                change_type: ev.event_type || "update",
                field: extra?.field ?? null,
                old_value: extra?.old_value != null ? String(extra.old_value).slice(0, 500) : null,
                new_value: extra?.new_value != null ? String(extra.new_value).slice(0, 500) : null,
                note: ev.translated_event_type || ev.object_name || null,
              });
            }
            activitiesUrl = actData.paging?.next || "";
          }

          if (activityRows.length > 0) {
            // Dedup against existing rows (campaign_id + entity_id + changed_at + change_type)
            const campaignIds = [...new Set(activityRows.map((r) => r.campaign_id))];
            const { data: existing } = await supabaseAdmin
              .from("campaign_changes")
              .select("campaign_id, entity_id, changed_at, change_type")
              .in("campaign_id", campaignIds)
              .gte("changed_at", new Date(since * 1000).toISOString());
            const seen = new Set(
              (existing || []).map((r: any) => `${r.campaign_id}|${r.entity_id ?? ""}|${r.changed_at}|${r.change_type}`)
            );
            const fresh = activityRows.filter(
              (r) => !seen.has(`${r.campaign_id}|${r.entity_id ?? ""}|${r.changed_at}|${r.change_type}`)
            );
            if (fresh.length > 0) {
              for (let i = 0; i < fresh.length; i += 200) {
                throwIfError(await supabaseAdmin.from("campaign_changes").insert(fresh.slice(i, i + 200)), `atividades da conta ${account.name}`);
              }
              console.log(`Inserted ${fresh.length} activity rows for ${account.name}`);
            }
          }
        } catch (actErr) {
          console.warn(`Activity log fetch failed: ${(actErr as Error).message}`);
        }

        // 4. Buscar insights a nível de CONTA (não depende da listagem de campanhas)
        //    Captura inclusive ads de campanhas arquivadas/finalizadas
        const campaignFilter = campaignIds.length
          ? `&filtering=${encodeURIComponent(JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]))}`
          : "";
        const insightsRes = await fetchMetaPaginated(
          `${graphBase}/${metaAccountId}/insights?fields=ad_id,ad_name,adset_id,campaign_id,spend,impressions,reach,clicks,inline_link_clicks,unique_inline_link_clicks,ctr,cpm,frequency,actions,action_values&level=ad&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}${attributionParam}&action_report_time=impression&use_unified_attribution_setting=true${campaignFilter}&access_token=${accessToken}&limit=500`
        );
        recordPagination(insightsRes, "insights");
        if (insightsRes.error) {
          const message = `Conta ${account.name} insights: ${insightsRes.error}`;
          errors.push(message);
          failedAccounts++;
          const tokenExpired = insightsRes.errorCode === 190;
          needsReauth ||= tokenExpired;
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              connection_status: connectionStatusForMetaError(insightsRes.errorCode, Boolean(insightsRes.retryable)),
              last_sync_error: insightsRes.error,
              last_sync_error_code: insightsRes.errorCode ?? null,
              last_sync_attempt_at: attemptedAt,
            })
            // Preserve an explicit manual deactivation made during the sync.
            .eq("id", account.id)
            .neq("connection_status", "disconnected");
          await writeMetaScopeState(supabaseAdmin, {
            accountId: account.id,
            campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
            startDate,
            endDate,
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            status: "error",
            lastAttemptAt: attemptedAt,
            pagesProcessed: insightsRes.pages || 0,
            errorCode: insightsRes.errorCode ?? null,
            errorMessage: message,
            blockStatus: {
              insights: {
                status: "error",
                reasonCode: "meta_graph_api_error",
                errorMessage: insightsRes.error,
                errorCode: insightsRes.errorCode ?? null,
                errorSubcode: insightsRes.errorSubcode ?? null,
                httpStatus: insightsRes.httpStatus ?? null,
                pagesProcessed: insightsRes.pages || 0,
              },
              actions: { status: "pending" },
              hourly: { status: "pending" },
              breakdowns: { status: "pending" },
            },
          });
          if (accountLockAcquired && accountLockScopeKey) {
            await supabaseAdmin.from("realtime_sync_state").update({ locked_until: null, updated_at: new Date().toISOString() })
              .eq("user_id", account.user_id).eq("provider", "meta").eq("scope_key", accountLockScopeKey);
          }
          await updateMetaRun("failed", message);
          accountResults.push({
            internalAccountId: account.id,
            externalAccountId: metaAccountId,
            requestedPeriod: { startDate, endDate },
            coveredPeriod: null,
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            pagesProcessed: insightsRes.pages || 0,
            rowsPersisted: 0,
            spendPersisted: null,
            status: "error",
            lastSuccessAt: account.last_sync_success_at || null,
            error: insightsRes.error,
          });
          continue;
        }
        if (accountHadError) {
          // A truncated/repeated primary response is not a valid snapshot.
          // Do not upsert or clean rows from a partial Meta page walk.
          const message = errors.filter((entry) => entry.startsWith(`Conta ${account.name} insights:`)).join("; ")
            || `Conta ${account.name}: paginação de Insights incompleta; snapshot anterior preservado.`;
          await writeMetaScopeState(supabaseAdmin, {
            accountId: account.id,
            campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
            startDate,
            endDate,
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            status: "error",
            lastAttemptAt: attemptedAt,
            pagesProcessed: insightsRes.pages || 0,
            errorCode: null,
            errorMessage: message,
            blockStatus: {
              insights: {
                status: "error",
                reasonCode: "meta_insights_pagination_incomplete",
                errorMessage: message,
                pagesProcessed: insightsRes.pages || 0,
                responseComplete: false,
              },
              actions: { status: "pending" },
              hourly: { status: "pending" },
              breakdowns: { status: "pending" },
            },
          });
          if (accountLockAcquired && accountLockScopeKey) {
            await supabaseAdmin.from("realtime_sync_state").update({ locked_until: null, updated_at: new Date().toISOString() })
              .eq("user_id", account.user_id).eq("provider", "meta").eq("scope_key", accountLockScopeKey);
          }
          continue;
        }
        let allInsights = insightsRes.data;
        let aggregatePages = 0;
        let emptyInsightsResponseVerified = true;
        let emptyInsightsResponseError: string | null = null;
        // Meta can temporarily return an empty ad/day page while the account
        // already has processed hourly delivery. Retry the exact same civil
        // scope without time_increment before deciding that the snapshot is
        // unavailable. This is especially important for the current day.
        if (allInsights.length === 0 && startDate === endDate) {
          const aggregateRes = await fetchMetaPaginated(
            `${graphBase}/${metaAccountId}/insights?fields=ad_id,ad_name,adset_id,campaign_id,spend,impressions,reach,clicks,inline_link_clicks,unique_inline_link_clicks,ctr,cpm,frequency,actions,action_values&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}${attributionParam}&action_report_time=impression&use_unified_attribution_setting=true${campaignFilter}&access_token=${accessToken}&limit=500`
          );
          aggregatePages = aggregateRes.pages || 0;
          recordPagination(aggregateRes, "insights fallback");
          emptyInsightsResponseVerified = !aggregateRes.error && !aggregateRes.truncated && !aggregateRes.repeatedCursor;
          if (!emptyInsightsResponseVerified) emptyInsightsResponseError = aggregateRes.error || "paginação incompleta";
          if (!aggregateRes.error && !aggregateRes.truncated && !aggregateRes.repeatedCursor && aggregateRes.data.length > 0) {
            allInsights = aggregateRes.data.map((row: any) => ({ ...row, date_start: row.date_start || startDate }));
            console.log(`Daily fallback returned ${allInsights.length} rows for account ${account.name}`);
          }
        }
        if (allInsights.length === 0 && !emptyInsightsResponseVerified) {
          const message = `Conta ${account.name}: não foi possível confirmar resultado vazio de Insights para ${startDate} a ${endDate}; ${emptyInsightsResponseError || "consulta de confirmação incompleta"}.`;
          accountHadError = true;
          failedAccounts++;
          errors.push(message);
          await writeMetaScopeState(supabaseAdmin, {
            accountId: account.id,
            campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
            startDate,
            endDate,
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            status: "error",
            lastAttemptAt: attemptedAt,
            pagesProcessed: (insightsRes.pages || 0) + aggregatePages,
            errorMessage: message,
            blockStatus: {
              insights: { status: "error", reasonCode: "meta_empty_confirmation_failed", errorMessage: message, responseComplete: false },
              actions: { status: "pending" },
              hourly: { status: "pending" },
              breakdowns: { status: "pending" },
            },
          });
          await supabaseAdmin.from("ad_accounts").update({
            last_sync_error: message,
            last_sync_error_code: null,
            last_sync_attempt_at: attemptedAt,
          }).eq("id", account.id).neq("connection_status", "disconnected");
          if (accountLockAcquired && accountLockScopeKey) {
            await supabaseAdmin.from("realtime_sync_state").update({ locked_until: null, updated_at: new Date().toISOString() })
              .eq("user_id", account.user_id).eq("provider", "meta").eq("scope_key", accountLockScopeKey);
          }
          accountResults.push({
            internalAccountId: account.id,
            externalAccountId: metaAccountId,
            requestedPeriod: { startDate, endDate },
            coveredPeriod: null,
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            pagesProcessed: (insightsRes.pages || 0) + aggregatePages,
            rowsPersisted: 0,
            spendPersisted: null,
            status: "error",
            error: message,
          });
          continue;
        }
        if (allInsights.length === 0) {
          // A successful, fully paginated empty response is a valid zero for
          // this exact account/date/attribution scope. Reconcile only that
          // scope so stale facts from an earlier Meta response cannot mask it.
          // API errors and truncated pagination have already exited above.
          let staleInsightQuery = supabaseAdmin.from("insights").delete()
            .eq("ad_account_id", account.id)
            .gte("date", startDate).lte("date", endDate);
          staleInsightQuery = effectiveAttributionWindow === "account_default"
            ? staleInsightQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
            : staleInsightQuery.eq("attribution_window", effectiveAttributionWindow);
          let scopedStaleAdIds: string[] | null = null;
          if (campaignIds.length) {
            staleInsightQuery = staleInsightQuery.in("campaign_id", campaignIds);
            let scopedFactsQuery = supabaseAdmin.from("insights")
              .select("ad_id")
              .eq("ad_account_id", account.id)
              .in("campaign_id", campaignIds)
              .gte("date", startDate).lte("date", endDate);
            scopedFactsQuery = effectiveAttributionWindow === "account_default"
              ? scopedFactsQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
              : scopedFactsQuery.eq("attribution_window", effectiveAttributionWindow);
            const { data: scopedFacts, error: scopedFactsError } = await scopedFactsQuery;
            if (scopedFactsError) throw new Error(`leitura do escopo vazio Meta da conta ${account.name}: ${scopedFactsError.message}`);
            scopedStaleAdIds = [...new Set((scopedFacts || []).map((row: any) => String(row.ad_id || "")).filter(Boolean))];
          }
          const { error: staleInsightsError } = await staleInsightQuery;
          if (staleInsightsError) throw new Error(`reconciliação do snapshot vazio Meta da conta ${account.name}: ${staleInsightsError.message}`);
          if (!campaignIds.length) {
            let staleActionsQuery = supabaseAdmin.from("insight_actions").delete()
              .eq("ad_account_id", account.id).gte("date", startDate).lte("date", endDate);
            staleActionsQuery = effectiveAttributionWindow === "account_default"
              ? staleActionsQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
              : staleActionsQuery.eq("attribution_window", effectiveAttributionWindow);
            const { error: staleActionsError } = await staleActionsQuery;
            if (staleActionsError) throw new Error(`reconciliação das ações vazias Meta da conta ${account.name}: ${staleActionsError.message}`);
          } else if (scopedStaleAdIds?.length) {
            let staleActionsQuery = supabaseAdmin.from("insight_actions").delete()
              .eq("ad_account_id", account.id).gte("date", startDate).lte("date", endDate).in("ad_id", scopedStaleAdIds);
            staleActionsQuery = effectiveAttributionWindow === "account_default"
              ? staleActionsQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
              : staleActionsQuery.eq("attribution_window", effectiveAttributionWindow);
            const { error: staleActionsError } = await staleActionsQuery;
            if (staleActionsError) throw new Error(`reconciliação das ações vazias Meta da conta ${account.name}: ${staleActionsError.message}`);
          }
          let remainingInsightsQuery = supabaseAdmin.from("insights").select("ad_id", { count: "exact", head: true })
            .eq("ad_account_id", account.id).gte("date", startDate).lte("date", endDate);
          remainingInsightsQuery = effectiveAttributionWindow === "account_default"
            ? remainingInsightsQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
            : remainingInsightsQuery.eq("attribution_window", effectiveAttributionWindow);
          if (campaignIds.length) remainingInsightsQuery = remainingInsightsQuery.in("campaign_id", campaignIds);
          const { count: remainingInsights, error: remainingInsightsError } = await remainingInsightsQuery;
          if (remainingInsightsError || (remainingInsights || 0) > 0) throw new Error(`verificação do snapshot Meta vazio da conta ${account.name}: ${remainingInsightsError?.message || `${remainingInsights} insight(s) antigos permaneceram`}.`);
          let remainingActions = 0;
          let remainingActionsError: { message: string } | null = null;
          if (!campaignIds.length) {
            let query = supabaseAdmin.from("insight_actions").select("ad_id", { count: "exact", head: true })
              .eq("ad_account_id", account.id).gte("date", startDate).lte("date", endDate);
            query = effectiveAttributionWindow === "account_default"
              ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
              : query.eq("attribution_window", effectiveAttributionWindow);
            const result = await query;
            remainingActions = result.count || 0;
            remainingActionsError = result.error;
          } else if (scopedStaleAdIds?.length) {
            let query = supabaseAdmin.from("insight_actions").select("ad_id", { count: "exact", head: true })
              .eq("ad_account_id", account.id).gte("date", startDate).lte("date", endDate).in("ad_id", scopedStaleAdIds);
            query = effectiveAttributionWindow === "account_default"
              ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
              : query.eq("attribution_window", effectiveAttributionWindow);
            const result = await query;
            remainingActions = result.count || 0;
            remainingActionsError = result.error;
          }
          if (remainingActionsError || (remainingActions || 0) > 0) throw new Error(`verificação das ações vazias Meta da conta ${account.name}: ${remainingActionsError?.message || `${remainingActions} ação(ões) antigas permaneceram`}.`);
          const emptyEvidence = {
            evidenceVersion: 2,
            responseComplete: true,
            persistenceVerified: true,
            zeroResultConfirmed: true,
          };
          await writeMetaScopeState(supabaseAdmin, {
            accountId: account.id,
            campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
            startDate,
            endDate,
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            status: "fresh",
            lastAttemptAt: attemptedAt,
            lastSuccessAt: attemptedAt,
            lastValidSnapshotAt: attemptedAt,
            coveredStartDate: startDate,
            coveredEndDate: endDate,
            pagesProcessed: (insightsRes.pages || 0) + aggregatePages,
            errorCode: null,
            errorMessage: null,
            blockStatus: {
              insights: {
                status: "fresh",
                reasonCode: "meta_confirmed_zero",
                rowsPersisted: 0,
                ...emptyEvidence,
                pagesProcessed: (insightsRes.pages || 0) + aggregatePages,
                responseComplete: true,
              },
              actions: {
                status: "fresh",
                sourceInsightRows: 0,
                rowsPersisted: 0,
                leadRowsPersisted: 0,
                allActionRowsPersisted: 0,
                allActionRowsExpected: 0,
                ...emptyEvidence,
              },
              hourly: { status: "pending" },
              breakdowns: { status: "pending" },
            },
          });
          await supabaseAdmin.from("ad_accounts").update({
            connection_status: "connected",
            last_sync_error: null,
            last_sync_error_code: null,
            last_sync_attempt_at: attemptedAt,
            last_sync_success_at: attemptedAt,
          }).eq("id", account.id).neq("connection_status", "disconnected");
          if (accountLockAcquired && accountLockScopeKey) {
            await supabaseAdmin.from("realtime_sync_state").update({ locked_until: null, updated_at: new Date().toISOString() })
              .eq("user_id", account.user_id).eq("provider", "meta").eq("scope_key", accountLockScopeKey);
          }
          accountResults.push({
            internalAccountId: account.id,
            externalAccountId: metaAccountId,
            requestedPeriod: { startDate, endDate },
            coveredPeriod: { startDate, endDate },
            timezone: effectiveTimezone,
            attributionWindow: effectiveAttributionWindow,
            pagesProcessed: (insightsRes.pages || 0) + aggregatePages,
            rowsPersisted: 0,
            spendPersisted: 0,
            status: "fresh",
            zeroResultConfirmed: true,
            lastSuccessAt: attemptedAt,
          });
          continue;
        }
        console.log(`Total ${allInsights.length} insight rows for account ${account.name}`);

        // Keep the previous snapshot intact until all incoming facts have
        // been persisted successfully. Deleting first made a transient
        // upsert/timeout turn a valid snapshot into zero rows.
        const { data: storedCampaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("ad_account_id", account.id);
        const storedCampaignIds = (storedCampaigns || []).map((row: any) => String(row.id)).filter(Boolean);
        const { data: storedAdsets } = storedCampaignIds.length
          ? await supabaseAdmin.from("adsets").select("id").in("campaign_id", storedCampaignIds)
          : { data: [] as any[] };
        const storedAdsetIds = (storedAdsets || []).map((row: any) => String(row.id)).filter(Boolean);
        const { data: storedAds } = storedAdsetIds.length
          ? await supabaseAdmin.from("ads").select("id").in("adset_id", storedAdsetIds)
          : { data: [] as any[] };
        const factAdIds = [...new Set([
          ...adsList.map((ad: any) => String(ad.id || "")).filter(Boolean),
          ...allInsights.map((insight: any) => String(insight.ad_id || "")).filter(Boolean),
          ...(storedAds || []).map((ad: any) => String(ad.id || "")).filter(Boolean),
        ])];
        // 4.1 Hidratar ads/adsets/campaigns ausentes (necessário para o join do dashboard)
        const insightAdIds = [...new Set(allInsights.map((i: any) => i.ad_id).filter(Boolean))];
        if (insightAdIds.length > 0) {
          const { data: existingAds } = await supabaseAdmin
            .from("ads").select("id").in("id", insightAdIds);
          const existingSet = new Set((existingAds || []).map((r: any) => String(r.id)));
          const missingAdIds = insightAdIds.filter((id: string) => !existingSet.has(String(id)));
          if (missingAdIds.length > 0) {
            console.log(`Hydrating ${missingAdIds.length} missing ads from insights`);
            const newCampaigns = new Map<string, any>();
            const newAdsets = new Map<string, any>();
            const newAds = new Map<string, any>();
            for (const adId of missingAdIds) {
              try {
                const detail = await fetchMeta(
                  `${graphBase}/${adId}?fields=id,name,effective_status,creative{id,thumbnail_url,image_url},adset{id,name,campaign_id,effective_status,daily_budget,destination_type,optimization_goal},campaign{id,name,objective,effective_status}&access_token=${accessToken}`
                );
                if (detail.error || !detail.id) continue;
                const camp = detail.campaign;
                const aset = detail.adset;
                if (camp?.id) {
                  newCampaigns.set(camp.id, {
                    id: camp.id, name: camp.name, ad_account_id: account.id,
                    objective: camp.objective || null, status: camp.effective_status || null,
                  });
                }
                if (aset?.id) {
                  newAdsets.set(aset.id, {
                    id: aset.id, name: aset.name, campaign_id: aset.campaign_id || camp?.id,
                    daily_budget: aset.daily_budget ? Number(aset.daily_budget) / 100 : null,
                    status: aset.effective_status || null,
                    destination_type: aset.destination_type || null,
                    optimization_goal: aset.optimization_goal || null,
                  });
                }
                newAds.set(detail.id, {
                  id: detail.id, name: detail.name, adset_id: aset?.id,
                  creative_id: detail.creative?.id || null,
                  thumbnail_url: detail.creative?.thumbnail_url || detail.creative?.image_url || null,
                  status: detail.effective_status || null,
                });
              } catch (e) {
                console.warn(`Hydration failed for ad ${adId}: ${(e as Error).message}`);
              }
            }
            if (newCampaigns.size > 0) throwIfError(await supabaseAdmin.from("campaigns").upsert([...newCampaigns.values()], { onConflict: "id" }), `campanhas hidratadas da conta ${account.name}`);
            if (newAdsets.size > 0) throwIfError(await supabaseAdmin.from("adsets").upsert([...newAdsets.values()], { onConflict: "id" }), `conjuntos hidratados da conta ${account.name}`);
            if (newAds.size > 0) throwIfError(await supabaseAdmin.from("ads").upsert([...newAds.values()], { onConflict: "id" }), `anúncios hidratados da conta ${account.name}`);
          }
        }

        // 4.2 Carregar evento de Landing Page configurado para esta conta (manual).
        // Formulário Instantâneo é SEMPRE `onsite_conversion.lead_grouped` (única fonte
        // que bate com o painel do Meta — `lead` é inflado, pixel é off-site).
        let lpAction: string | null = null;
        try {
          const { data: lpCfg } = await supabaseAdmin
            .from("account_lp_config")
            .select("action_type")
            .eq("ad_account_id", account.id)
            .maybeSingle();
          if (lpCfg?.action_type) lpAction = lpCfg.action_type;
        } catch (_) { /* ignore */ }

        // 4.3 Persistir TODOS os action_types em insight_actions
        const actionRows: any[] = [];
        for (const insight of allInsights) {
          const actions = insight.actions || [];
          const values = insight.action_values || [];
          const valueMap = new Map<string, number>();
          for (const v of values) valueMap.set(String(v.action_type), Number(v.value || 0));
          for (const a of actions) {
            actionRows.push({
              ad_id: insight.ad_id,
              ad_account_id: account.id,
              date: insight.date_start,
              action_type: String(a.action_type),
              value: Number(a.value || 0),
              value_amount: valueMap.get(String(a.action_type)) || 0,
              attribution_window: effectiveAttributionWindow,
              timezone: effectiveTimezone,
            });
          }
        }
        for (let i = 0; i < actionRows.length; i += 500) {
          const chunk = actionRows.slice(i, i + 500);
          const { error: aErr } = await supabaseAdmin
            .from("insight_actions")
            .upsert(chunk, { onConflict: "ad_id,date,action_type,attribution_window", ignoreDuplicates: false });
          if (aErr) throw new Error(`ações da conta ${account.name}: ${aErr.message}`);
        }
        if (actionRows.length > 0) console.log(`insight_actions: ${actionRows.length} rows`);
        const leadActionTypes = new Set<string>([
          ...FORM_ACTIONS,
          ...SITE_ACTIONS,
          ...TRACKED_META_LEAD_ACTIONS,
          ...(lpAction ? [lpAction] : []),
        ]);
        const persistedLeadActionRows = actionRows.filter((row) => leadActionTypes.has(row.action_type));

        const campaignById = new Map((campaigns || []).map((campaign: any) => [String(campaign.id), campaign]));
        const insightAdsetIds = [...new Set(allInsights.map((row: any) => String(row.adset_id || "")).filter(Boolean))];
        let persistedAdsets: any[] = [];
        if (insightAdsetIds.length) {
          const { data, error } = await supabaseAdmin.from("adsets").select("id,campaign_id,destination_type,optimization_goal").in("id", insightAdsetIds);
          if (error) {
            const message = `Conta ${account.name} classificação de destino dos conjuntos: ${error.message}`;
            errors.push(message);
            auxiliaryErrors.push(message);
          } else persistedAdsets = data || [];
        }
        const adsetById = new Map<string, any>();
        for (const adset of [...(adsetsList || []), ...persistedAdsets]) adsetById.set(String(adset.id), adset);
        const websiteOnlyCampaignIds = new Set<string>();
        const messagingOnlyCampaignIds = new Set<string>();
        const destinationTypesByCampaign = new Map<string, string[]>();
        for (const adset of adsetById.values()) {
          const campaignId = String(adset.campaign_id || "");
          if (!campaignId) continue;
          const types = destinationTypesByCampaign.get(campaignId) || [];
          types.push(String(adset.destination_type || "").toUpperCase());
          destinationTypesByCampaign.set(campaignId, types);
        }
        for (const [campaignId, types] of destinationTypesByCampaign) {
          if (types.length > 0 && types.every((type) => type === "WEBSITE")) websiteOnlyCampaignIds.add(campaignId);
          if (types.length > 0 && types.every((type) => isMetaMessagingDestination(type))) messagingOnlyCampaignIds.add(campaignId);
        }
        const destinationClassificationComplete = allInsights.every((insight: any) => {
          const actions = Array.isArray(insight.actions) ? insight.actions : [];
          const hasConversationResult = actions.some((action: any) => CONVERSATION_ACTION_TYPES.includes(String(action.action_type) as any));
          const hasConfiguredSiteResult = Boolean(lpAction) && actions.some((action: any) => String(action.action_type) === lpAction);
          if (!hasConversationResult && !hasConfiguredSiteResult) return true;
          const adset = adsetById.get(String(insight.adset_id || ""));
          return Boolean(adset?.destination_type);
        });
        if (!destinationClassificationComplete) {
          auxiliaryErrors.push(`Conta ${account.name}: Leads Meta preservados como snapshot anterior; destino Website não foi confirmado para todos os anúncios.`);
        }

        // Canonical contract facts are written in addition to the legacy
        // tables. Ad facts keep the same daily grain as the Graph query;
        // campaign facts are aggregated from that exact response and period.
        if (metaRunId) {
          const contractRows: any[] = [];
          const campaignDays = new Map<string, any>();
          for (const insight of allInsights) {
            const campaignId = String(insight.campaign_id || "");
            const campaign = campaignById.get(campaignId);
            const adset = adsetById.get(String(insight.adset_id || ""));
            const actions = Array.isArray(insight.actions) ? insight.actions : [];
            const destinationType = adset?.destination_type || null;
            const result = canonicalResult(campaign?.objective || null, adset?.optimization_goal || null, actions, lpAction, destinationType);
            const spend = Number(insight.spend || 0);
            const impressions = Number(insight.impressions || 0);
            const clicks = Number(insight.clicks || 0);
            const key = `${campaignId}|${insight.date_start}`;
            contractRows.push({
              run_id: metaRunId,
              ad_account_id: String(account.id),
              date_start: insight.date_start,
              date_end: insight.date_start,
              level: "ad",
              item_id: String(insight.ad_id),
              campaign_id: campaignId || null,
              campaign_name: insight.campaign_name || campaign?.name || null,
              objective: campaign?.objective || null,
              optimization_event: null,
              spend,
              impressions,
              reach: Number.isFinite(Number(insight.reach)) ? Number(insight.reach || 0) : null,
              clicks,
              ctr: Number(insight.ctr || 0),
              cpc: clicks > 0 ? spend / clicks : 0,
              cpm: impressions > 0 ? spend / (impressions / 1000) : 0,
              results: Number(result.value || 0),
              result_type: result.type || null,
              cpa: Number(result.value || 0) > 0 ? spend / Number(result.value || 0) : null,
              roas: null,
            });
            if (!campaignId) continue;
            const current = campaignDays.get(key) || {
              campaignId, date: insight.date_start, campaignName: insight.campaign_name || campaign?.name || null,
              objective: campaign?.objective || null, spend: 0, impressions: 0, clicks: 0, actions: new Map<string, number>(),
            };
            current.spend += spend;
            current.impressions += impressions;
            current.clicks += clicks;
            for (const action of actions) {
              const type = String(action.action_type || "");
              current.actions.set(type, (current.actions.get(type) || 0) + Number(action.value || 0));
            }
            campaignDays.set(key, current);
          }
          for (const current of campaignDays.values()) {
            const actions = [...current.actions.entries()].map(([action_type, value]) => ({ action_type, value }));
            const result = canonicalResult(current.objective, null, actions, lpAction, null);
            contractRows.push({
              run_id: metaRunId,
              ad_account_id: String(account.id),
              date_start: current.date,
              date_end: current.date,
              level: "campaign",
              item_id: String(current.campaignId),
              campaign_id: String(current.campaignId) || null,
              campaign_name: current.campaignName,
              objective: current.objective,
              optimization_event: null,
              spend: current.spend,
              impressions: current.impressions,
              reach: null,
              clicks: current.clicks,
              ctr: current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0,
              cpc: current.clicks > 0 ? current.spend / current.clicks : 0,
              cpm: current.impressions > 0 ? current.spend / (current.impressions / 1000) : 0,
              results: Number(result.value || 0),
              result_type: result.type || null,
              cpa: Number(result.value || 0) > 0 ? current.spend / Number(result.value || 0) : null,
              roas: null,
            });
          }
          for (let i = 0; i < contractRows.length; i += 500) {
            const { error: contractError } = await supabaseAdmin
              .from("meta_insights_contract")
              .upsert(contractRows.slice(i, i + 500), { onConflict: "ad_account_id,date_start,level,item_id" });
            if (contractError) throw new Error(`contrato Meta da conta ${account.name}: ${contractError.message}`);
          }
          contractInsightsWritten = contractRows.length;
          contractActionsWritten = actionRows.length;
        }

        // Batch upsert insights (chunks of 100)
        const insightRows = allInsights.map((insight: any) => {
          const spend = Number(insight.spend || 0);
          const impressions = Number(insight.impressions || 0);
          const clicks = Number(insight.clicks || 0);
          const inlineLinkClicks = Number(insight.inline_link_clicks || 0);
          const uniqueInlineLinkClicks = Number(insight.unique_inline_link_clicks || 0);
          const reach = Number(insight.reach || 0);
          const ctr = Number(insight.ctr || 0);
          const cpm = Number(insight.cpm || 0);
          const frequency = Number(insight.frequency || 0);

          const actions = insight.actions || [];
          // Leads use only explicitly classified form, configured-site, and
          // started-conversation actions. Generic `lead`/`omni_lead` aggregates
          // are ambiguous and must never be inferred as native forms.
          const campaignId = String(insight.campaign_id || "");
          const campaign = campaignById.get(campaignId);
          const adset = adsetById.get(String(insight.adset_id || ""));
          // Prefer the ad-set fact. When Meta omits it for an archived set,
          // use a campaign whose ad-sets are consistently classified. This
          // keeps canonical form/conversation facts writable during a partial
          // catalog response instead of preserving stale lead columns.
          const destinationType = adset?.destination_type
            || (websiteOnlyCampaignIds.has(campaignId) ? "WEBSITE" : null)
            || (messagingOnlyCampaignIds.has(campaignId) ? "MESSAGING" : null);
          const parts = canonicalLeadParts(actions, lpAction, destinationType);
          const leads = parts.forms + parts.site + parts.conversations;
          const result = canonicalResult(campaign?.objective || null, adset?.optimization_goal || null, actions, lpAction, adset?.destination_type);
          const cpl = leads > 0 ? spend / leads : 0;
          const conversionRate = clicks > 0 ? (leads / clicks) * 100 : 0;
          const efficiencyRate = impressions > 0 ? (leads / impressions) * 100 : 0;
          const rawScore = (ctr * 2) + (conversionRate * 3) - (cpl * 0.02);
          const healthScore = Math.max(0, Math.min(100, rawScore));

          return {
            ad_id: insight.ad_id,
            ad_account_id: account.id,
            campaign_id: insight.campaign_id || null,
            campaign_name: insight.campaign_name || campaign?.name || null,
            adset_id: insight.adset_id || null,
            adset_name: insight.adset_name || adset?.name || null,
            date: insight.date_start,
            spend, impressions, reach, clicks,
            inline_link_clicks: inlineLinkClicks,
            unique_inline_link_clicks: uniqueInlineLinkClicks,
            ctr, cpm, frequency,
            leads, cpl, conversion_rate: conversionRate,
            efficiency_rate: efficiencyRate,
            form_leads: parts.forms,
            site_leads: parts.site,
            conversations: parts.conversations,
            health_score: healthScore,
            attribution_window: effectiveAttributionWindow,
            timezone: effectiveTimezone,
            optimization_goal: adset?.optimization_goal || null,
            result_type: result.type,
            result_value: result.type === "reach" ? reach : result.value,
          };
        });

        // Upsert in chunks
        for (let i = 0; i < insightRows.length; i += 100) {
          const chunk = insightRows.slice(i, i + 100);
          const { error: upsertError } = await supabaseAdmin
            .from("insights")
            .upsert(chunk, { onConflict: "ad_id,date,attribution_window", ignoreDuplicates: false });
          if (upsertError) throw new Error(`insights da conta ${account.name}: ${upsertError.message}`);
          totalSynced += chunk.length;
        }

        // A successful PostgREST upsert response is not enough to mark a
        // snapshot fresh. Re-read the exact account/date/window facts and
        // prove that every requested ad/day key became visible under the
        // correct internal account before reconciliation can delete anything.
        const expectedInsightKeys = new Set(insightRows.map((row: any) => `${row.ad_id}|${row.date}`));
        const persistedInsightRows: any[] = [];
        const persistedActionRows: any[] = [];
        const verificationAdIds = [...new Set(insightRows.map((row: any) => String(row.ad_id)))];
        for (let offset = 0; offset < verificationAdIds.length; offset += 200) {
          const adChunk = verificationAdIds.slice(offset, offset + 200);
          for (let page = 0; ; page += 1) {
            const { data, error } = await supabaseAdmin.from("insights")
              .select("ad_id,date,spend")
              .eq("ad_account_id", account.id)
              .eq("attribution_window", effectiveAttributionWindow)
              .in("ad_id", adChunk)
              .gte("date", startDate).lte("date", endDate)
              .range(page * 1000, page * 1000 + 999);
            if (error) throw new Error(`verificação dos insights da conta ${account.name}: ${error.message}`);
            persistedInsightRows.push(...(data || []));
            if (!data || data.length < 1000) break;
          }
          for (let page = 0; ; page += 1) {
            let query = supabaseAdmin.from("insight_actions")
              .select("ad_id,date,action_type")
              .eq("ad_account_id", account.id)
              .in("ad_id", adChunk)
              .gte("date", startDate).lte("date", endDate)
              .range(page * 1000, page * 1000 + 999);
            query = effectiveAttributionWindow === "account_default"
              ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
              : query.eq("attribution_window", effectiveAttributionWindow);
            const { data, error } = await query;
            if (error) throw new Error(`verificação das ações da conta ${account.name}: ${error.message}`);
            persistedActionRows.push(...(data || []));
            if (!data || data.length < 1000) break;
          }
        }
        const persistedInsightKeys = new Set(persistedInsightRows.map((row) => `${row.ad_id}|${row.date}`));
        const missingInsightKeys = [...expectedInsightKeys].filter((key) => !persistedInsightKeys.has(key));
        const expectedActionKeys = new Set(actionRows.map((row) => `${row.ad_id}|${row.date}|${row.action_type}`));
        const persistedActionKeys = new Set(persistedActionRows.map((row) => `${row.ad_id}|${row.date}|${row.action_type}`));
        const missingActionKeys = [...expectedActionKeys].filter((key) => !persistedActionKeys.has(key));
        const persistedSpend = persistedInsightRows
          .filter((row) => expectedInsightKeys.has(`${row.ad_id}|${row.date}`))
          .reduce((sum, row) => sum + Number(row.spend || 0), 0);
        const requestedSpend = insightRows.reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0);
        if (missingInsightKeys.length || Math.abs(persistedSpend - requestedSpend) > 0.01) {
          throw new Error(`snapshot Meta da conta ${account.name} não persistiu integralmente: ${missingInsightKeys.length} chave(s) ausente(s), gasto solicitado ${requestedSpend.toFixed(2)}, relido ${persistedSpend.toFixed(2)}.`);
        }
        if (missingActionKeys.length) {
          throw new Error(`ações Meta da conta ${account.name} não persistiram integralmente: ${missingActionKeys.length} chave(s) ausente(s).`);
        }
        const persistenceVerification = {
          insightsExpected: insightRows.length,
          insightsReadBack: expectedInsightKeys.size,
          actionsExpected: expectedActionKeys.size,
          actionsReadBack: expectedActionKeys.size,
          spendExpected: requestedSpend,
          spendReadBack: persistedSpend,
        };

        // Reconcile stale action types for ad/day pairs explicitly returned by
        // the completed Meta response. Upsert alone leaves old action aliases
        // behind when Meta stops returning them, which can inflate canonical
        // form/site/conversation totals after attribution or processing shifts.
        const actionSnapshots = allInsights
          .filter((row: any) => row.ad_id && row.date_start)
          .map((row: any) => ({ ad_id: String(row.ad_id), date: String(row.date_start) }));
        const incomingActionFacts = actionRows.map((row: any) => ({
          ad_id: String(row.ad_id), date: String(row.date), action_type: String(row.action_type),
        }));
        const existingActionFacts: Array<{ ad_id: string; date: string; action_type: string }> = [];
        const actionAdIdsByDate = new Map<string, Set<string>>();
        for (const snapshot of actionSnapshots) {
          const ids = actionAdIdsByDate.get(snapshot.date) || new Set<string>();
          ids.add(snapshot.ad_id);
          actionAdIdsByDate.set(snapshot.date, ids);
        }
        for (const [date, ids] of actionAdIdsByDate) {
          const scopedIds = [...ids];
          for (let offset = 0; offset < scopedIds.length; offset += 200) {
            const adChunk = scopedIds.slice(offset, offset + 200);
            for (let page = 0; ; page += 1) {
              let query = supabaseAdmin.from("insight_actions")
                .select("ad_id,date,action_type")
                .eq("ad_account_id", account.id)
                .eq("date", date)
                .in("ad_id", adChunk)
                .range(page * 1000, page * 1000 + 999);
              query = effectiveAttributionWindow === "account_default"
                ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
                : query.eq("attribution_window", effectiveAttributionWindow);
              const { data, error } = await query;
              if (error) throw new Error(`leitura das ações anteriores da conta ${account.name}: ${error.message}`);
              existingActionFacts.push(...(data || []).map((row: any) => ({
                ad_id: String(row.ad_id), date: String(row.date), action_type: String(row.action_type),
              })));
              if (!data || data.length < 1000) break;
            }
          }
        }
        const staleActionFacts = staleActionFactsForDailySnapshot(existingActionFacts, incomingActionFacts, actionSnapshots);
        const staleActionGroups = new Map<string, Set<string>>();
        for (const row of staleActionFacts) {
          const key = `${row.date}|${row.action_type}`;
          const ids = staleActionGroups.get(key) || new Set<string>();
          ids.add(row.ad_id);
          staleActionGroups.set(key, ids);
        }
        for (const [key, ids] of staleActionGroups) {
          const [date, actionType] = key.split("|");
          const staleIds = [...ids];
          for (let offset = 0; offset < staleIds.length; offset += 500) {
            let query = supabaseAdmin.from("insight_actions").delete()
              .eq("ad_account_id", account.id)
              .eq("date", date)
              .eq("action_type", actionType)
              .in("ad_id", staleIds.slice(offset, offset + 500));
            query = effectiveAttributionWindow === "account_default"
              ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
              : query.eq("attribution_window", effectiveAttributionWindow);
            const { error } = await query;
            if (error) throw new Error(`reconciliação de ações da conta ${account.name}: ${error.message}`);
          }
        }

        // Reconcile rows that disappeared from the completed Meta response
        // only after all current rows are safely stored. The attribution
        // predicate is mandatory: another attribution window is a separate
        // fact and must never be deleted by this run.
        // Reconcile by (date, ad_id), never by ad_id alone.  A daily response
        // can contain an ad on one day and omit it on another; deleting by ad
        // only would erase the valid day as well.
        const incomingByDate = new Map<string, Set<string>>();
        for (const insight of allInsights) {
          const date = String(insight.date_start || "");
          const adId = String(insight.ad_id || "");
          if (!date || !adId) continue;
          const ids = incomingByDate.get(date) || new Set<string>();
          ids.add(adId);
          incomingByDate.set(date, ids);
        }
        for (const date of datesSafeToReconcile(startDate, endDate, allInsights)) {
          const incoming = [...(incomingByDate.get(date) || new Set<string>())];
          const incomingIds = new Set(incoming);
          for (let i = 0; i < factAdIds.length; i += 500) {
            const adChunk = factAdIds.slice(i, i + 500);
            const staleAdIds = staleAdIdsForDailySnapshot(adChunk, incomingIds);
            if (!staleAdIds.length) continue;
            // Delete only explicitly identified stale IDs. The old `not.in`
            // filter was serialized by PostgREST in a way that matched the
            // incoming IDs too, removing every newly upserted fact for the day.
            let actionDelete = supabaseAdmin.from("insight_actions").delete()
              .in("ad_id", staleAdIds).eq("ad_account_id", account.id).eq("date", date);
            actionDelete = effectiveAttributionWindow === "account_default"
              ? actionDelete.or("attribution_window.eq.account_default,attribution_window.is.null")
              : actionDelete.eq("attribution_window", effectiveAttributionWindow);
            let insightDelete = supabaseAdmin.from("insights").delete()
              .in("ad_id", staleAdIds).eq("ad_account_id", account.id).eq("date", date);
            insightDelete = effectiveAttributionWindow === "account_default"
              ? insightDelete.or("attribution_window.eq.account_default,attribution_window.is.null")
              : insightDelete.eq("attribution_window", effectiveAttributionWindow);
            const { error: actionDeleteError } = await actionDelete;
            if (actionDeleteError) throw new Error(`limpeza das ações da conta ${account.name}: ${actionDeleteError.message}`);
            const { error: insightDeleteError } = await insightDelete;
            if (insightDeleteError) throw new Error(`limpeza dos insights da conta ${account.name}: ${insightDeleteError.message}`);
          }
        }

        // Confirm the requested facts again after reconciliation. The earlier
        // read-back protects against failed upserts; this one protects the
        // watermark from being marked fresh if cleanup or a concurrent path
        // removed any row before the sync completed.
        const finalInsightKeys = new Set<string>();
        const finalActionKeys = new Set<string>();
        const finalSpendByKey = new Map<string, number>();
        for (let offset = 0; offset < verificationAdIds.length; offset += 200) {
          const adChunk = verificationAdIds.slice(offset, offset + 200);
          for (let page = 0; ; page += 1) {
            const { data, error } = await supabaseAdmin.from("insights")
              .select("ad_id,date,spend")
              .eq("ad_account_id", account.id)
              .eq("attribution_window", effectiveAttributionWindow)
              .in("ad_id", adChunk)
              .gte("date", startDate).lte("date", endDate)
              .range(page * 1000, page * 1000 + 999);
            if (error) throw new Error(`verificação final dos insights da conta ${account.name}: ${error.message}`);
            for (const row of data || []) {
              const key = `${row.ad_id}|${row.date}`;
              finalInsightKeys.add(key);
              finalSpendByKey.set(key, Number(row.spend || 0));
            }
            if (!data || data.length < 1000) break;
          }
          for (let page = 0; ; page += 1) {
            let query = supabaseAdmin.from("insight_actions")
              .select("ad_id,date,action_type")
              .eq("ad_account_id", account.id)
              .in("ad_id", adChunk)
              .gte("date", startDate).lte("date", endDate)
              .range(page * 1000, page * 1000 + 999);
            query = effectiveAttributionWindow === "account_default"
              ? query.or("attribution_window.eq.account_default,attribution_window.is.null")
              : query.eq("attribution_window", effectiveAttributionWindow);
            const { data, error } = await query;
            if (error) throw new Error(`verificação final das ações da conta ${account.name}: ${error.message}`);
            for (const row of data || []) finalActionKeys.add(`${row.ad_id}|${row.date}|${row.action_type}`);
            if (!data || data.length < 1000) break;
          }
        }
        const missingAfterReconciliation = [...expectedInsightKeys].filter((key) => !finalInsightKeys.has(key));
        const missingActionsAfterReconciliation = [...expectedActionKeys].filter((key) => !finalActionKeys.has(key));
        const staleActionsStillPresent = staleActionFacts.filter((row) => finalActionKeys.has(`${row.ad_id}|${row.date}|${row.action_type}`));
        const finalSpend = [...expectedInsightKeys].reduce((sum, key) => sum + (finalSpendByKey.get(key) || 0), 0);
        if (missingAfterReconciliation.length || missingActionsAfterReconciliation.length || staleActionsStillPresent.length || Math.abs(finalSpend - requestedSpend) > 0.01) {
          throw new Error(`snapshot Meta da conta ${account.name} foi alterado após reconciliação: ${missingAfterReconciliation.length} insight(s), ${missingActionsAfterReconciliation.length} ação(ões) ausentes e ${staleActionsStillPresent.length} ação(ões) antigas ainda presentes; gasto solicitado ${requestedSpend.toFixed(2)}, relido ${finalSpend.toFixed(2)}.`);
        }

        // 5. Buscar breakdowns somente quando explicitamente solicitado. Eles
        // multiplicam o consumo da Graph API e não devem rodar em todo refresh.
        if (includeBreakdowns) try {
          const breakdownRequests = [
            { type: "age", apiBreakdowns: "age" },
            { type: "gender", apiBreakdowns: "gender" },
            { type: "publisher_platform", apiBreakdowns: "publisher_platform" },
            // The Marketing API only permits placement at this granularity
            // together with publisher platform and impression device. Persist
            // platform plus placement in the
            // label so the dashboard can distinguish Instagram Reels from
            // Facebook Feed instead of losing that context.
            { type: "platform_position", apiBreakdowns: "publisher_platform,platform_position,impression_device" },
            { type: "country", apiBreakdowns: "country" },
            { type: "region", apiBreakdowns: "region" },
          ];
          const campaignIdsForCleanup = campaigns.map((campaign: any) => String(campaign.id || "")).filter(Boolean);
          for (let i = 0; i < campaignIdsForCleanup.length; i += 500) {
            const campaignChunk = campaignIdsForCleanup.slice(i, i + 500);
            const { error: breakdownDeleteError } = await supabaseAdmin
              .from("insights_breakdowns")
              .delete()
              .in("campaign_id", campaignChunk)
              .eq("attribution_window", effectiveAttributionWindow)
              .gte("date", breakdownStartDate)
              .lte("date", breakdownEndDate);
            if (breakdownDeleteError) throw new Error(`limpeza dos breakdowns da conta ${account.name}: ${breakdownDeleteError.message}`);
          }
          for (const breakdown of breakdownRequests) {
            const bRes = await fetchMetaPaginated(
              `${graphBase}/${metaAccountId}/insights?fields=campaign_id,spend,impressions,clicks,actions&level=campaign&breakdowns=${breakdown.apiBreakdowns}&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: breakdownStartDate, until: breakdownEndDate }))}${attributionParam}&action_report_time=impression&use_unified_attribution_setting=true&access_token=${accessToken}&limit=500`
            );
            recordPagination(bRes, `breakdown ${breakdown.type}`);
            if (bRes.error) {
              const message = `Conta ${account.name} breakdown ${breakdown.type}: ${bRes.error}`;
              errors.push(message);
              auxiliaryErrors.push(message);
              console.warn(message);
              continue;
            }
            const bRows = (bRes.data || [])
              .filter((r: any) => r.campaign_id && r[breakdown.type])
              .map((r: any) => {
                const actions = r.actions || [];
                // Reuse the canonical acquisition rules for every campaign
                // type: native forms, configured landing pages, and click-to-
                // message campaigns. Do not drop message campaigns from the
                // audience report simply because they have no form action.
                const campaignId = String(r.campaign_id);
                const campaignDestination = websiteOnlyCampaignIds.has(campaignId)
                  ? "WEBSITE"
                  : messagingOnlyCampaignIds.has(campaignId) ? "WHATSAPP" : undefined;
                const parts = canonicalLeadParts(actions, lpAction, campaignDestination);
                return {
                  campaign_id: r.campaign_id,
                  date: r.date_start,
                  attribution_window: effectiveAttributionWindow,
                  breakdown_type: breakdown.type,
                  segment_key: breakdown.type === "platform_position" && r.publisher_platform
                    ? [r.publisher_platform, r.platform_position, r.impression_device].filter(Boolean).join(" · ")
                    : String(r[breakdown.type]),
                  spend: Number(r.spend || 0),
                  impressions: Number(r.impressions || 0),
                  clicks: Number(r.clicks || 0),
                  leads: parts.forms + parts.site + parts.conversations,
                };
              });
            for (let i = 0; i < bRows.length; i += 200) {
              const chunk = bRows.slice(i, i + 200);
              const { error: bErr } = await supabaseAdmin
                .from("insights_breakdowns")
                .upsert(chunk, { onConflict: "campaign_id,date,breakdown_type,segment_key,attribution_window", ignoreDuplicates: false });
              if (bErr) throw new Error(`breakdown ${breakdown.type} da conta ${account.name}: ${bErr.message}`);
            }
            contractBreakdownsWritten += bRows.length;
            console.log(`Breakdown ${breakdown.type}: ${bRows.length} rows`);
          }
        } catch (bErr) {
          const message = `Conta ${account.name} breakdowns: ${(bErr as Error).message}`;
          errors.push(message);
          auxiliaryErrors.push(message);
          console.warn(message);
        }

        if (accountHadError) failedAccounts++;
        // Mark account as connected only when every required block completed.
        await supabaseAdmin
          .from("ad_accounts")
          .update({
            // A failed reconciliation must not turn into a false OAuth
            // disconnect. Authorization failures are classified earlier.
            connection_status: needsReauth ? "expired" : "connected",
            last_sync_error: accountHadError ? errors.filter((message) => message.startsWith(`Conta ${account.name}`)).join("; ") : null,
            last_sync_error_code: null,
            last_sync_attempt_at: attemptedAt,
            ...(accountHadError ? {} : { last_sync_success_at: attemptedAt }),
          })
          // A completed sync is not authorization to reactivate an account.
          .eq("id", account.id)
          .neq("connection_status", "disconnected");
        await writeMetaScopeState(supabaseAdmin, {
          accountId: account.id,
          campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
          startDate,
          endDate,
          timezone: effectiveTimezone,
          attributionWindow: effectiveAttributionWindow,
          status: accountHadError ? "partial" : "fresh",
          lastAttemptAt: attemptedAt,
          lastSuccessAt: accountHadError ? undefined : attemptedAt,
          lastValidSnapshotAt: accountHadError ? undefined : attemptedAt,
          errorMessage: accountHadError ? undefined : null,
          coveredStartDate: startDate,
          coveredEndDate: endDate,
          pagesProcessed: totalPages,
          blockStatus: {
            insights: {
              status: accountHadError ? "partial" : "fresh",
              coveredScope: { startDate, endDate },
              pagesProcessed: totalPages,
              rowsPersisted: insightRows.length,
              spendPersisted: insightRows.reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0),
              evidenceVersion: 2,
              responseComplete: true,
              persistenceVerified: true,
            },
            actions: {
              // Empty canonical lead actions are a confirmed zero only after
              // complete Insights pagination and read-back of every action row.
              status: destinationClassificationComplete ? "fresh" : "partial",
              ...(destinationClassificationComplete ? {} : { errorMessage: "Destino do anúncio não confirmado; última classificação de Leads Meta preservada." }),
              sourceInsightRows: insightRows.length,
              rowsPersisted: persistedLeadActionRows.length,
              leadRowsPersisted: persistedLeadActionRows.length,
              allActionRowsPersisted: actionRows.length - missingActionKeys.length,
              allActionRowsExpected: actionRows.length,
              evidenceVersion: 2,
              responseComplete: true,
              persistenceVerified: true,
              zeroResultConfirmed: destinationClassificationComplete && persistedLeadActionRows.length === 0,
            },
            hourly: { status: "pending" },
            breakdowns: { status: auxiliaryErrors.length ? "partial" : "pending", errorMessage: auxiliaryErrors.join("; ") || null },
          },
        });
        await updateMetaRun(accountHadError ? "partial" : "completed", accountHadError ? errors.filter((message) => message.startsWith(`Conta ${account.name}`)).join("; ") : null);
        accountResults.push({
          internalAccountId: account.id,
          externalAccountId: metaAccountId,
          requestedPeriod: { startDate, endDate },
          coveredPeriod: { startDate, endDate },
          timezone: effectiveTimezone,
          attributionWindow: effectiveAttributionWindow,
          pagesProcessed: insightsRes.pages || 0,
          rowsPersisted: insightRows.length,
          spendPersisted: insightRows.reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0),
          status: accountHadError ? "partial" : "fresh",
          lastSuccessAt: accountHadError ? account.last_sync_success_at || null : attemptedAt,
          errors: auxiliaryErrors,
        });
        if (accountLockAcquired && accountLockScopeKey) {
          await supabaseAdmin.from("realtime_sync_state").update({ locked_until: null, updated_at: new Date().toISOString() })
            .eq("user_id", account.user_id).eq("provider", "meta").eq("scope_key", accountLockScopeKey);
        }
      } catch (e) {
        failedAccounts++;
        const msg = (e as Error).message;
        errors.push(`Conta ${account.name}: ${msg}`);
        if (metaRunId) {
          await supabaseAdmin.from("meta_sync_runs").update({
            status: "failed",
            pages_processed: accountPagesProcessed,
            insights_written: contractInsightsWritten,
            actions_written: contractActionsWritten,
            breakdowns_written: contractBreakdownsWritten,
            errors_total: auxiliaryErrors.length + 1,
            error_message: msg,
            finished_at: new Date().toISOString(),
          }).eq("id", metaRunId);
        }
        await supabaseAdmin
          .from("ad_accounts")
          .update({
            connection_status: "unknown",
            last_sync_error: msg,
            last_sync_attempt_at: attemptedAt,
          })
          // Keep a manual deactivation authoritative even when an unexpected
          // error is handled after the account has been switched off.
          .eq("id", account.id)
          .neq("connection_status", "disconnected");
        await writeMetaScopeState(supabaseAdmin, {
          accountId: account.id,
          campaignScope: campaignIds.slice().sort().join(",") || "all-campaigns",
          startDate: requestedStartDate || new Intl.DateTimeFormat("en-CA", { timeZone: account.timezone_name || "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
          endDate: requestedEndDate || new Intl.DateTimeFormat("en-CA", { timeZone: account.timezone_name || "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
          timezone: account.timezone_name || "America/Sao_Paulo",
          attributionWindow: requestedAttributionWindow || account.attribution_window || "account_default",
          status: "error",
          lastAttemptAt: attemptedAt,
          errorMessage: msg,
          blockStatus: { insights: { status: "error", errorMessage: msg } },
        });
        accountResults.push({
          internalAccountId: account.id,
          externalAccountId: typeof account.account_id === "string" && account.account_id.startsWith("act_") ? account.account_id : `act_${account.account_id}`,
          requestedPeriod: { startDate: requestedStartDate || null, endDate: requestedEndDate || null },
          coveredPeriod: null,
          timezone: account.timezone_name || "America/Sao_Paulo",
          attributionWindow: requestedAttributionWindow || account.attribution_window || "account_default",
          pagesProcessed: 0,
          rowsPersisted: 0,
          spendPersisted: null,
          status: "error",
          lastSuccessAt: account.last_sync_success_at || null,
          error: msg,
        });
        if (accountLockAcquired && accountLockScopeKey) {
          await supabaseAdmin.from("realtime_sync_state").update({ locked_until: null, updated_at: new Date().toISOString() })
            .eq("user_id", account.user_id).eq("provider", "meta").eq("scope_key", accountLockScopeKey);
        }
      }
    }

    console.log(`Sync complete: ${totalSynced} rows synced`);

    return new Response(
      JSON.stringify({
        // Disconnected/manual-disabled accounts are intentionally outside the
        // synchronization scope. Their presence must not downgrade a
        // successful run for the active accounts that were actually queried.
        // A real active-account failure still produces partial/failed.
        success: failedAccounts === 0 && accounts.length > 0,
        status: failedAccounts === 0 ? "success" : (failedAccounts === accounts.length ? "failed" : "partial"),
        synced: totalSynced,
        accounts: accounts.length,
        skipped_disconnected: disconnectedAccounts?.length || 0,
        disconnected_accounts: (disconnectedAccounts || []).map((account: any) => ({
          id: account.id,
          account_id: account.account_id,
          name: account.name,
        })),
        errors: errors.length > 0 ? errors : undefined,
        error: failedAccounts >= accounts.length || (accounts.length === 0 && (disconnectedAccounts?.length || 0) > 0) ? (errors[0] || "Todas as contas Meta selecionadas estão bloqueadas") : undefined,
        needs_reauth: needsReauth || undefined,
        graph_version: graphVersion,
        synced_at: new Date().toISOString(),
        freshness_seconds: Math.max(0, Math.floor((Date.now() - new Date(syncStartedAt).getTime()) / 1000)),
        scope: {
          ad_account_ids: accounts.map((account: any) => account.id),
          campaign_ids: campaignIds,
          start_date: requestedStartDate || null,
          end_date: requestedEndDate || null,
          attribution_window: requestedAttributionWindow || "account_default",
          timezone: typeof body.timezone === "string" ? body.timezone : "account",
        },
        pagination: { pages: totalPages, last_cursor: lastCursor },
        accountResults,
      }),
      // Partial synchronization is a valid application response. Returning
      // HTTP 207 makes supabase.functions.invoke expose only a generic
      // "non-2xx" error and discards the structured coverage/errors payload
      // that the UI needs to preserve the last valid snapshot. Keep transport
      // success at 200 and let the typed `status: "partial"` describe the
      // result.
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

const RETRYABLE_META_CODES = new Set([1, 2, 4, 17, 32, 613, 80004]);

type MetaFetchResult = Record<string, any> & {
  error?: { message: string; code?: number; error_subcode?: number; is_transient?: boolean };
  __httpStatus?: number;
  __retryable?: boolean;
};

async function fetchMeta(url: string, maxAttempts = 4): Promise<MetaFetchResult> {
  let lastMessage = "Falha ao consultar a Graph API";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      const raw = await response.text();
      let payload: MetaFetchResult = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }

      if (response.ok && !payload.error) return payload;

      const metaError = payload.error || { message: `Meta retornou HTTP ${response.status}` };
      const code = Number(metaError.code);
      const retryable = response.status === 429 || response.status >= 500 || metaError.is_transient === true || RETRYABLE_META_CODES.has(code);
      lastMessage = metaError.message || `Meta retornou HTTP ${response.status}`;

      if (retryable && attempt + 1 < maxAttempts) {
        const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
        const exponential = 750 * (2 ** attempt) + Math.floor(Math.random() * 250);
        await sleep(Math.min(15_000, Math.max(retryAfter, exponential)));
        continue;
      }

      return { ...payload, error: { ...metaError, message: lastMessage }, __httpStatus: response.status, __retryable: retryable };
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Falha de rede ao consultar a Meta";
      if (attempt + 1 < maxAttempts) {
        await sleep(750 * (2 ** attempt));
        continue;
      }
    }
  }
  return { error: { message: lastMessage, is_transient: true }, __retryable: true };
}

// Segue paging.next até o fim, retornando erro estruturado sem expor token.
async function fetchMetaPaginated(url: string, maxPages = Number.POSITIVE_INFINITY): Promise<{
  data: any[];
  pages: number;
  lastCursor?: string;
  repeatedCursor?: boolean;
  truncated?: boolean;
  error?: string;
  errorCode?: number;
  errorSubcode?: number;
  httpStatus?: number;
  retryable?: boolean;
}> {
  const all: any[] = [];
  let next: string | undefined = url;
  let pages = 0;
  const seen = new Set<string>();
  let lastCursor: string | undefined;
  while (next && pages < maxPages) {
    // Protect against a malformed Graph paging cursor repeating forever while
    // still allowing arbitrarily large account/date ranges to fully drain.
    if (seen.has(next)) {
      console.warn("fetchMetaPaginated detected a repeated paging cursor");
      return { data: all, pages, lastCursor, repeatedCursor: true };
    }
    seen.add(next);
    const res = await fetchMeta(next);
    if (res.error) {
      return {
        data: all,
        pages,
        lastCursor,
        error: res.error.message || String(res.error),
        errorCode: typeof res.error.code === "number" ? res.error.code : undefined,
        errorSubcode: typeof res.error.error_subcode === "number" ? res.error.error_subcode : undefined,
        httpStatus: res.__httpStatus,
        retryable: res.__retryable,
      };
    }
    if (Array.isArray(res.data)) all.push(...res.data);
    next = res.paging?.next;
    lastCursor = next;
    pages++;
  }
  const truncated = Boolean(next);
  if (truncated && Number.isFinite(maxPages)) console.warn(`fetchMetaPaginated hit maxPages=${maxPages}`);
  return { data: all, pages, lastCursor, truncated };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

function throwIfError(result: { error?: { message?: string } | null }, context: string) {
  if (result.error) throw new Error(`Falha ao persistir ${context}: ${result.error.message || "erro desconhecido"}`);
}

async function writeMetaScopeState(admin: any, args: {
  accountId: string;
  campaignScope: string;
  startDate: string;
  endDate: string;
  timezone: string;
  attributionWindow: string;
  status: string;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  lastValidSnapshotAt?: string;
  coveredStartDate?: string;
  coveredEndDate?: string;
  pagesProcessed?: number;
  errorCode?: number | string | null;
  errorMessage?: string | null;
  blockStatus?: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    ad_account_id: args.accountId,
    campaign_scope: args.campaignScope,
    start_date: args.startDate,
    end_date: args.endDate,
    timezone: args.timezone,
    attribution_window: args.attributionWindow,
    status: args.status,
    last_started_at: args.lastAttemptAt,
    last_finished_at: args.status === "syncing" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (args.lastSuccessAt) payload.last_success_at = args.lastSuccessAt;
  if (args.lastValidSnapshotAt) payload.last_valid_snapshot_at = args.lastValidSnapshotAt;
  if (args.coveredStartDate) payload.covered_start_date = args.coveredStartDate;
  if (args.coveredEndDate) payload.covered_end_date = args.coveredEndDate;
  if (args.pagesProcessed != null) payload.pages_processed = args.pagesProcessed;
  if (args.errorCode !== undefined) payload.error_code = args.errorCode == null ? null : String(args.errorCode);
  if (args.errorMessage !== undefined) payload.last_error = args.errorMessage;
  if (args.blockStatus) payload.block_status = args.blockStatus;
  const { error } = await admin.from("meta_sync_scope_state").upsert(payload, {
    onConflict: "ad_account_id,campaign_scope,start_date,end_date,timezone,attribution_window",
  });
  if (error) console.warn("Falha ao registrar estado do escopo Meta:", error.message);
}
