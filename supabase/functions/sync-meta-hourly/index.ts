import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveMetaLeadParts } from "../_shared/metaLeadMetrics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    // pg_cron path: authenticated by the service role key only. Client-supplied
    // body flags are NOT trusted for skipping auth.
    const isServiceRole = bearer.length > 0 && bearer === supabaseServiceKey;
    const isCron = isServiceRole;

    let userId: string | null = null;
    if (!isServiceRole && !isCron) {
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

    const adAccountId: string | undefined = typeof body.adAccountId === "string" ? body.adAccountId : undefined;
    const adAccountIds = Array.isArray(body.adAccountIds)
      ? body.adAccountIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const requestedAttributionWindow = typeof body.attributionWindow === "string" ? body.attributionWindow.trim() : "";
    const requestedCampaignIds = Array.isArray(body.campaignIds)
      ? body.campaignIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const requestedStartDate: string | undefined = body.startDate;
    const requestedEndDate: string | undefined = body.endDate;
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
    const graphBase = `https://graph.facebook.com/${graphVersion}`;

    let q = supabaseAdmin.from("ad_accounts").select("*").neq("connection_status", "disconnected");
    if (adAccountId) q = q.eq("id", adAccountId);
    else if (adAccountIds.length > 0) q = q.in("id", adAccountIds);
    if (userId) q = q.eq("user_id", userId);
    const { data: accounts, error: accErr } = await q;
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        status: "skipped",
        synced: 0,
        accounts: 0,
        message: "Nenhuma conta Meta ativa no escopo informado.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSynced = 0;
    const errors: string[] = [];
    let needsReauth = false;
    let failedAccounts = 0;

    for (const account of accounts) {
      try {
        const accountToday = new Intl.DateTimeFormat("en-CA", {
          timeZone: account.timezone_name || "America/Sao_Paulo",
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        // Sem intervalo explícito, atualiza somente o dia corrente da conta.
        // Backfills continuam disponíveis ao informar startDate/endDate.
        const startDate = requestedStartDate || accountToday;
        const endDate = requestedEndDate || accountToday;
        const accessToken = account.access_token as string;
        const raw = account.account_id as string;
        const metaAccountId = raw.startsWith("act_") ? raw : `act_${raw}`;
        const attributionWindows = requestedAttributionWindow && requestedAttributionWindow !== "account_default"
          ? requestedAttributionWindow.split(",").map((value: string) => value.trim()).filter(Boolean)
          : account.attribution_window && account.attribution_window !== "account_default"
          ? String(account.attribution_window).split(",").map((value: string) => value.trim()).filter(Boolean)
          : [];
        const attributionParam = attributionWindows.length
          ? `&action_attribution_windows=${encodeURIComponent(JSON.stringify(attributionWindows))}`
          : "";
        const campaignFilter = requestedCampaignIds.length
          ? `&filtering=${encodeURIComponent(JSON.stringify([{ field: "campaign.id", operator: "IN", value: requestedCampaignIds }]))}`
          : "";

        // Match daily sync: leads = onsite_conversion.lead_grouped + per-account configured LP event.
        const { data: lpCfg } = await supabaseAdmin
          .from("account_lp_config")
          .select("action_type")
          .eq("ad_account_id", account.id)
          .maybeSingle();
        const lpAction: string | null = lpCfg?.action_type ?? null;

        const url =
          `${graphBase}/${metaAccountId}/insights` +
          `?level=ad` +
          `&time_increment=1` +
          `&breakdowns=hourly_stats_aggregated_by_audience_time_zone` +
          `&fields=ad_id,campaign_id,spend,clicks,actions` +
          `&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}` +
          campaignFilter +
          attributionParam +
          `&action_report_time=impression` +
          `&use_unified_attribution_setting=true` +
          `&access_token=${accessToken}` +
          `&limit=500`;

        const res = await fetchMetaPaginated(url);
        if (res.error) {
          failedAccounts++;
          needsReauth ||= res.errorCode === 190;
          errors.push(`Conta ${account.name}${res.errorCode ? ` [Meta ${res.errorCode}]` : ""}: ${res.error}`);
          continue;
        }
        if (res.truncated || res.repeatedCursor) {
          failedAccounts++;
          errors.push(`Conta ${account.name}: paginação horária incompleta; snapshot anterior preservado.`);
          continue;
        }

        // Aggregate by (ad_id, date, hour) to dedupe within the page set.
        type Row = { ad_account_id: string; campaign_id: string | null; ad_id: string; date: string; hour: number; leads: number; clicks: number; spend: number };
        const map = new Map<string, Row>();

        for (const r of res.data) {
          if (!r.ad_id || !r.date_start) continue;
          const hourStr: string = r.hourly_stats_aggregated_by_audience_time_zone || "00:00:00 - 00:59:59";
          const hour = parseInt(hourStr.slice(0, 2), 10);
          if (Number.isNaN(hour)) continue;

          const actions: any[] = Array.isArray(r.actions) ? r.actions : [];
          const actionValues: Record<string, number> = {};
          for (const action of actions) {
            const type = String(action.action_type || "");
            actionValues[type] = Math.max(actionValues[type] || 0, Math.max(0, Number(action.value || 0)));
          }
          const leads = resolveMetaLeadParts(actionValues, lpAction || undefined).total;

          const key = `${r.ad_id}|${r.date_start}|${hour}`;
          const prev = map.get(key);
          const row: Row = {
            ad_account_id: account.id,
            campaign_id: r.campaign_id || null,
            ad_id: String(r.ad_id),
            date: r.date_start,
            hour,
            leads: (prev?.leads || 0) + leads,
            clicks: (prev?.clicks || 0) + Number(r.clicks || 0),
            spend: (prev?.spend || 0) + Number(r.spend || 0),
          };
          map.set(key, row);
        }

        let rows = [...map.values()];

        // Hourly breakdowns can omit configured site events and conversation
        // aliases. Reconcile against the daily canonical snapshot for every
        // account so hourly totals cannot drift from the official KPI.
        const needsReconciliation = rows.length > 0;
        if (needsReconciliation && rows.length > 0) {
          const adIds = [...new Set(rows.map((r) => r.ad_id))];
          const dates = [...new Set(rows.map((r) => r.date))].sort();
          // Busca totais diários já sincronizados pela sync-meta-insights
          const { data: dailyRows } = await supabaseAdmin
            .from("insights")
            .select("ad_id,date,leads")
            .in("ad_id", adIds)
            .gte("date", dates[0])
            .lte("date", dates[dates.length - 1]);
          const dailyLeads = new Map<string, number>();
          for (const d of (dailyRows || [])) {
            dailyLeads.set(`${d.ad_id}|${d.date}`, Number(d.leads || 0));
          }
          // Agrupa rows por (ad_id, date)
          const groups = new Map<string, Row[]>();
          for (const r of rows) {
            const k = `${r.ad_id}|${r.date}`;
            const arr = groups.get(k) || [];
            arr.push(r);
            groups.set(k, arr);
          }
          for (const [key, group] of groups) {
            const target = dailyLeads.get(key) || 0;
            if (target <= 0) continue;
            const totalClicks = group.reduce((s, r) => s + Number(r.clicks || 0), 0);
            if (totalClicks > 0) {
              // Distribui proporcional aos clicks (arredondamento com correção do resto)
              let assigned = 0;
              const sorted = [...group].sort((a, b) => b.clicks - a.clicks);
              for (let i = 0; i < sorted.length; i++) {
                const r = sorted[i];
                const share = i === sorted.length - 1
                  ? target - assigned
                  : Math.round((Number(r.clicks) / totalClicks) * target);
                r.leads = Math.max(0, share);
                assigned += r.leads;
              }
            } else {
              // Sem clicks → distribui igualmente
              const per = target / group.length;
              group.forEach((r) => { r.leads = per; });
            }
          }
        }

        let persistenceFailed = false;
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error: upErr } = await supabaseAdmin
            .from("insights_hourly")
            .upsert(chunk, { onConflict: "ad_id,date,hour", ignoreDuplicates: false });
          if (upErr) {
            errors.push(`Upsert ${account.name}: ${upErr.message}`);
            persistenceFailed = true;
            break;
          }
          totalSynced += chunk.length;
        }
        // Do not erase a valid hourly snapshot before the new one has been
        // written successfully. Keep the campaign scope bounded as well.
        if (persistenceFailed) continue;
        const incomingByDate = new Map<string, Set<string>>();
        for (const row of rows) {
          const ids = incomingByDate.get(row.date) || new Set<string>();
          ids.add(row.ad_id);
          incomingByDate.set(row.date, ids);
        }
        const cursor = new Date(`${startDate}T00:00:00Z`);
        const last = new Date(`${endDate}T00:00:00Z`);
        for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          const date = cursor.toISOString().slice(0, 10);
          let cleanup = supabaseAdmin.from("insights_hourly").delete()
            .eq("ad_account_id", account.id).eq("date", date);
          if (requestedCampaignIds.length) cleanup = cleanup.in("campaign_id", requestedCampaignIds);
          const incoming = [...(incomingByDate.get(date) || new Set<string>())];
          if (incoming.length) {
            cleanup = cleanup.not("ad_id", "in", `(${incoming.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(",")})`);
          }
          const { error: hourlyDeleteError } = await cleanup;
          if (hourlyDeleteError) throw new Error(`limpeza horária da conta ${account.name}: ${hourlyDeleteError.message}`);
        }
        console.log(`hourly ${account.name}: ${rows.length} rows`);
      } catch (e) {
        failedAccounts++;
        errors.push(`Conta ${account.name}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: failedAccounts === 0,
        status: accounts.length === 0 ? "skipped" : failedAccounts === 0 ? "success" : failedAccounts >= accounts.length ? "failed" : "partial",
        synced: totalSynced,
        accounts: accounts.length,
        errors: errors.length ? errors : undefined,
        error: failedAccounts >= accounts.length ? errors[0] : undefined,
        needs_reauth: needsReauth || undefined,
        graph_version: graphVersion,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const RETRYABLE_META_CODES = new Set([1, 2, 4, 17, 32, 613, 80004]);

async function fetchMeta(url: string, maxAttempts = 4): Promise<any> {
  let lastMessage = "Falha ao consultar a Graph API";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
      if (response.ok && !payload.error) return payload;

      const metaError = payload.error || { message: `Meta retornou HTTP ${response.status}` };
      const retryable = response.status === 429 || response.status >= 500 || metaError.is_transient === true || RETRYABLE_META_CODES.has(Number(metaError.code));
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

async function fetchMetaPaginated(url: string, maxPages = Number.POSITIVE_INFINITY): Promise<{ data: any[]; pages?: number; error?: string; errorCode?: number; retryable?: boolean; repeatedCursor?: boolean; truncated?: boolean }> {
  const all: any[] = [];
  let next: string | undefined = url;
  let pages = 0;
  const seen = new Set<string>();
  while (next && pages < maxPages) {
    if (seen.has(next)) return { data: all, pages, repeatedCursor: true, error: "A Meta repetiu o cursor de paginação horária." };
    seen.add(next);
    const res = await fetchMeta(next);
    if (res.error) return {
      data: all,
      error: res.error.message || String(res.error),
      errorCode: typeof res.error.code === "number" ? res.error.code : undefined,
      retryable: res.__retryable,
    };
    if (Array.isArray(res.data)) all.push(...res.data);
    next = res.paging?.next;
    pages++;
  }
  return { data: all, pages, truncated: Boolean(next) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
