import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canonicalMetaLeads } from "../_shared/metaLeadMetrics.ts";
import { loadSiteEligibleMetaAdScopes } from "../_shared/metaLeadScope.ts";
import { parseCivilDateRange } from "../../../src/lib/civilDateRange.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH_BASE = `https://graph.facebook.com/${Deno.env.get("META_GRAPH_API_VERSION") || "v25.0"}`;

function normalizeAttributionWindow(value: unknown) {
  return String(value || "account_default")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(",") || "account_default";
}

interface Body { adAccountId?: string; adAccountIds?: string[]; days?: number; startDate?: string; endDate?: string }
interface GraphInsightAction { action_type?: string; value?: string | number }
interface GraphInsightsPage {
  data?: any[];
  paging?: { next?: string | null };
  error?: { message?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body: Body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(body.days ?? 7, 1), 90);
    const explicitRange = body.startDate !== undefined || body.endDate !== undefined;
    const civilRange = explicitRange ? parseCivilDateRange(body.startDate, body.endDate) : null;

    // Include temporarily errored/expired accounts in the audit instead of
    // silently shrinking the global comparison to only currently healthy rows.
    let q = admin.from("ad_accounts").select("id, name, account_id, access_token, timezone_name, attribution_window, connection_status").eq("user_id", user.id).neq("connection_status", "disconnected");
    if (body.adAccountId) q = q.eq("id", body.adAccountId);
    if (body.adAccountIds?.length) q = q.in("id", Array.from(new Set(body.adAccountIds)));
    const { data: accounts, error } = await q;
    if (error) throw error;

    const accountList = accounts || [];
    const results: any[] = new Array(accountList.length);
    let cursor = 0;
    const processAccount = async (acc: NonNullable<typeof accountList>[number]) => {
      try {
      const timezone = acc.timezone_name || "America/Sao_Paulo";
      const accountToday = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const [year, month, day] = accountToday.split("-").map(Number);
      const start = new Date(Date.UTC(year, month - 1, day - (days - 1), 12));
      const startDate = civilRange?.startDate || `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
      const endDate = civilRange?.endDate || accountToday;
      const attributionWindows = acc.attribution_window && acc.attribution_window !== "account_default"
        ? String(acc.attribution_window).split(",").map((value: string) => value.trim()).filter(Boolean)
        : [];
      const attributionWindow = attributionWindows.length ? attributionWindows.join(",") : "account_default";
      const rawId = acc.account_id as string;
      const metaId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
      const params = new URLSearchParams({
        fields: "ad_id,adset_id,date_start,campaign_id,campaign_name,spend,impressions,clicks,actions",
        level: "ad",
        time_increment: "1",
        limit: "500",
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        access_token: acc.access_token,
      });
      if (attributionWindows.length) params.set("action_attribution_windows", JSON.stringify(attributionWindows));
      // Match the production sync contract exactly: Meta resolves the account's
      // unified attribution setting for both media and action facts.
      params.set("action_report_time", "impression");
      params.set("use_unified_attribution_setting", "true");
      let nextUrl: string | null = `${GRAPH_BASE}/${metaId}/insights?${params.toString()}`;
      const metaRows: any[] = [];
      let metaError: string | null = null;
      let metaPages = 0;
      const seenCursors = new Set<string>();
      while (nextUrl) {
        if (seenCursors.has(nextUrl)) {
          metaError = "Meta repetiu o cursor de paginação; validação incompleta.";
          break;
        }
        seenCursors.add(nextUrl);
        metaPages += 1;
        const response: Response = await fetch(nextUrl, { signal: AbortSignal.timeout(15_000) });
        const payload: GraphInsightsPage = await response.json();
        if (!response.ok || payload.error) {
          metaError = payload.error?.message || `Meta Graph API HTTP ${response.status}`;
          break;
        }
        metaRows.push(...(payload.data || []));
        nextUrl = payload.paging?.next || null;
      }
      if (metaError) {
        return { accountId: acc.id, name: acc.name, timezone, attributionWindow, startDate, endDate, error: metaError };
      }
      const { data: lpConfig } = await admin.from("account_lp_config")
        .select("action_type").eq("ad_account_id", acc.id).maybeSingle();
      const metaSpend = metaRows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
      const metaImpressions = metaRows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
      const metaClicks = metaRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
      const metaSiteScope = await loadSiteEligibleMetaAdScopes(admin, metaRows.map((row) => ({
        ad_account_id: acc.id,
        ad_id: String(row.ad_id),
        adset_id: row.adset_id ? String(row.adset_id) : null,
      })));
      const metaLeadSnapshot = canonicalMetaLeads(
        metaRows.map((row) => ({ ad_id: String(row.ad_id), ad_account_id: acc.id, date: String(row.date_start), campaign_id: String(row.campaign_id || "unknown"), campaign_name: String(row.campaign_name || "Campanha sem nome"), leads: null })),
        metaRows.flatMap((row) => (row.actions || []).map((action: any) => ({
          ad_account_id: acc.id, ad_id: String(row.ad_id), date: String(row.date_start), action_type: String(action.action_type || ""), value: Number(action.value || 0),
        }))),
        { [acc.id]: lpConfig?.action_type || undefined },
        metaSiteScope.scopes,
        metaSiteScope.conversationScopes,
      );
      const metaLeads = metaLeadSnapshot.reduce((sum, row) => sum + Number(row.leads || 0), 0);
      const sumLeadParts = (rows: any[]) => rows.reduce((sum, row) => ({
        forms: sum.forms + Number(row.form_leads || 0),
        site: sum.site + Number(row.site_leads || 0),
        conversations: sum.conversations + Number(row.conversations || 0),
      }), { forms: 0, site: 0, conversations: 0 });
      const metaLeadParts = sumLeadParts(metaLeadSnapshot);
      const campaignBreakdown = new Map<string, any>();
      const ensureCampaign = (id: string, name: string) => {
        const key = id || "unknown";
        const existing = campaignBreakdown.get(key) || {
          campaignId: key,
          campaignName: name || "Campanha sem nome",
          meta: { spend: 0, impressions: 0, clicks: 0, forms: 0, site: 0, conversations: 0 },
          db: { spend: 0, impressions: 0, clicks: 0, forms: 0, site: 0, conversations: 0 },
          actionTypes: {},
        };
        campaignBreakdown.set(key, existing);
        return existing;
      };
      const metaLeadsByAdDate = new Map(metaLeadSnapshot.map((row: any) => [`${row.ad_id}|${row.date}`, row]));
      for (const row of metaRows) {
        const campaign = ensureCampaign(String(row.campaign_id || "unknown"), String(row.campaign_name || "Campanha sem nome"));
        campaign.meta.spend += Number(row.spend || 0);
        campaign.meta.impressions += Number(row.impressions || 0);
        campaign.meta.clicks += Number(row.clicks || 0);
        const lead = metaLeadsByAdDate.get(`${row.ad_id}|${row.date_start}`) as any;
        campaign.meta.forms += Number(lead?.form_leads || 0);
        campaign.meta.site += Number(lead?.site_leads || 0);
        campaign.meta.conversations += Number(lead?.conversations || 0);
        for (const action of row.actions || []) {
          const type = String(action.action_type || "unknown");
          campaign.actionTypes[type] = (campaign.actionTypes[type] || 0) + Number(action.value || 0);
        }
      }
      const metaActionTypeTotals = Object.fromEntries(metaRows.flatMap((row) => row.actions || []).reduce((totals: Map<string, number>, action: any) => {
        const actionType = String(action.action_type || "");
        totals.set(actionType, (totals.get(actionType) || 0) + Number(action.value || 0));
        return totals;
      }, new Map<string, number>()));

      // Local totals
      let dbSpend = 0, dbImp = 0, dbClicks = 0;
      const localInsights: any[] = [];
      const pageSize = 1_000;
      for (let page = 0; ; page++) {
        const { data: rows, error: insightsError } = await admin.from("insights")
          .select("ad_id,date,campaign_id,attribution_window,spend,impressions,clicks,form_leads,site_leads,conversations")
          .eq("ad_account_id", acc.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (insightsError) throw insightsError;
        const scopedRows = (rows || []).filter((row: any) => normalizeAttributionWindow(row.attribution_window) === normalizeAttributionWindow(attributionWindow));
        localInsights.push(...scopedRows);
        for (const r of scopedRows) {
          dbSpend += Number(r.spend || 0);
          dbImp += Number(r.impressions || 0);
          dbClicks += Number(r.clicks || 0);
        }
        if ((rows || []).length < pageSize) break;
      }

      const adIds = Array.from(new Set(localInsights.map((row) => String(row.ad_id)).filter(Boolean)));
      const localActionRows: any[] = [];
      for (let offset = 0; offset < adIds.length; offset += 200) {
        const chunk = adIds.slice(offset, offset + 200);
        for (let page = 0; ; page++) {
          let actionQuery = admin.from("insight_actions")
            .select("ad_account_id,ad_id,date,action_type,value,attribution_window")
            .eq("ad_account_id", acc.id)
            .in("ad_id", chunk).gte("date", startDate).lte("date", endDate);
          actionQuery = normalizeAttributionWindow(attributionWindow) === "account_default"
            ? actionQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
            : actionQuery;
          const { data: actions, error: actionsError } = await actionQuery.range(page * pageSize, page * pageSize + pageSize - 1);
          if (actionsError) throw actionsError;
          localActionRows.push(...(actions || []).filter((row: any) => normalizeAttributionWindow(row.attribution_window) === normalizeAttributionWindow(attributionWindow)));
          if ((actions || []).length < pageSize) break;
        }
      }
      const dbSiteScope = await loadSiteEligibleMetaAdScopes(admin, localInsights.map((row) => ({
        ad_account_id: acc.id,
        ad_id: String(row.ad_id),
      })));
      // `insights` stores the canonical lead contract used by the Dashboard.
      // Raw action rows remain available below for diagnostics, but rebuilding
      // KPI totals from every historical action alias can disagree with the
      // persisted snapshot after Meta revises attribution values.
      const localLeadSnapshot = localInsights.map((row: any) => ({
        ad_id: String(row.ad_id),
        ad_account_id: acc.id,
        date: String(row.date),
        form_leads: Math.max(0, Number(row.form_leads || 0)),
        site_leads: Math.max(0, Number(row.site_leads || 0)),
        conversations: Math.max(0, Number(row.conversations || 0)),
        leads: Math.max(0, Number(row.form_leads || 0))
          + Math.max(0, Number(row.site_leads || 0))
          + Math.max(0, Number(row.conversations || 0)),
      }));
      const dbLeads = localLeadSnapshot.reduce((sum, row) => sum + Number(row.leads || 0), 0);
      const dbLeadParts = sumLeadParts(localLeadSnapshot);
      const dbLeadsByAdDate = new Map(localLeadSnapshot.map((row: any) => [`${row.ad_id}|${row.date}`, row]));
      for (const row of localInsights) {
        const campaign = ensureCampaign(String(row.campaign_id || "unknown"), "Campanha (catálogo local indisponível)");
        campaign.db.spend += Number(row.spend || 0);
        campaign.db.impressions += Number(row.impressions || 0);
        campaign.db.clicks += Number(row.clicks || 0);
        const lead = dbLeadsByAdDate.get(`${row.ad_id}|${row.date}`) as any;
        campaign.db.forms += Number(lead?.form_leads || 0);
        campaign.db.site += Number(lead?.site_leads || 0);
        campaign.db.conversations += Number(lead?.conversations || 0);
      }
      const dbActionTypeTotals = Object.fromEntries(localActionRows.reduce((totals: Map<string, number>, action: any) => {
        const actionType = String(action.action_type || "");
        totals.set(actionType, (totals.get(actionType) || 0) + Number(action.value || 0));
        return totals;
      }, new Map<string, number>()));

      const pctDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / b) * 100);
      return {
        accountId: acc.id,
        metaAccountId: rawId,
        name: acc.name,
        connectionStatus: acc.connection_status,
        timezone,
        attributionWindow,
        startDate,
        endDate,
        metaRows: metaRows.length,
        metaPages,
        localRows: localInsights.length,
        localActionRows: localActionRows.length,
        meta: { spend: metaSpend, impressions: metaImpressions, clicks: metaClicks, leads: metaLeads, leadParts: metaLeadParts },
        db: { spend: dbSpend, impressions: dbImp, clicks: dbClicks, leads: dbLeads, leadParts: dbLeadParts },
        siteDestinationCoverage: {
          actionConfigured: Boolean(lpConfig?.action_type),
          meta: { complete: metaSiteScope.complete, error: metaSiteScope.error, websiteAds: metaSiteScope.scopes.size },
          db: { complete: dbSiteScope.complete, error: dbSiteScope.error, websiteAds: dbSiteScope.scopes.size },
        },
        leadActionTypeTotals: { meta: metaActionTypeTotals, db: dbActionTypeTotals },
        campaignBreakdown: Array.from(campaignBreakdown.values()).sort((a, b) => a.campaignName.localeCompare(b.campaignName)),
        drift: {
          spendPct: pctDiff(dbSpend, metaSpend),
          leadsPct: pctDiff(dbLeads, metaLeads),
          clicksPct: pctDiff(dbClicks, metaClicks),
          impressionsPct: pctDiff(dbImp, metaImpressions),
        },
      };
      } catch (error) {
        return {
          accountId: acc.id,
          name: acc.name,
          timezone: acc.timezone_name || "America/Sao_Paulo",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    const worker = async () => {
      while (cursor < accountList.length) {
        const index = cursor++;
        results[index] = await processAccount(accountList[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, accountList.length) }, () => worker()));

    return new Response(JSON.stringify({ ok: true, days, accounts: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
