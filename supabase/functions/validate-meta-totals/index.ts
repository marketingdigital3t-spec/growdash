import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canonicalMetaLeads } from "../_shared/metaLeadMetrics.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH_BASE = `https://graph.facebook.com/${Deno.env.get("META_GRAPH_API_VERSION") || "v25.0"}`;

interface Body { adAccountId?: string; days?: number }

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

    let q = admin.from("ad_accounts").select("id, name, account_id, access_token, timezone_name, attribution_window").eq("user_id", user.id);
    if (body.adAccountId) q = q.eq("id", body.adAccountId);
    const { data: accounts, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const acc of accounts || []) {
      const timezone = acc.timezone_name || "America/Sao_Paulo";
      const endDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const [year, month, day] = endDate.split("-").map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, day - (days - 1))).toISOString().slice(0, 10);
      const attributionWindows = acc.attribution_window && acc.attribution_window !== "account_default"
        ? String(acc.attribution_window).split(",").map((value: string) => value.trim()).filter(Boolean)
        : [];
      const attributionWindow = attributionWindows.length ? attributionWindows.join(",") : "account_default";
      const rawId = acc.account_id as string;
      const metaId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
      const params = new URLSearchParams({
        fields: "ad_id,date_start,spend,impressions,clicks,actions",
        level: "ad",
        time_increment: "1",
        limit: "500",
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        access_token: acc.access_token,
      });
      if (attributionWindows.length) params.set("action_attribution_windows", JSON.stringify(attributionWindows));
      let nextUrl: string | null = `${GRAPH_BASE}/${metaId}/insights?${params.toString()}`;
      const metaRows: any[] = [];
      let metaError: string | null = null;
      while (nextUrl) {
        const response = await fetch(nextUrl);
        const payload = await response.json();
        if (!response.ok || payload.error) {
          metaError = payload.error?.message || `Meta Graph API HTTP ${response.status}`;
          break;
        }
        metaRows.push(...(payload.data || []));
        nextUrl = payload.paging?.next || null;
      }
      if (metaError) {
        results.push({ accountId: acc.id, name: acc.name, timezone, attributionWindow, startDate, endDate, error: metaError });
        continue;
      }
      const { data: lpConfig } = await admin.from("account_lp_config")
        .select("action_type").eq("ad_account_id", acc.id).maybeSingle();
      const metaSpend = metaRows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
      const metaImpressions = metaRows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
      const metaClicks = metaRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
      const metaLeadSnapshot = canonicalMetaLeads(
        metaRows.map((row) => ({ ad_id: String(row.ad_id), ad_account_id: acc.id, date: String(row.date_start), leads: null })),
        metaRows.flatMap((row) => (row.actions || []).map((action: any) => ({
          ad_id: String(row.ad_id), date: String(row.date_start), action_type: String(action.action_type || ""), value: Number(action.value || 0),
        }))),
        { [acc.id]: lpConfig?.action_type || undefined },
      );
      const metaLeads = metaLeadSnapshot.reduce((sum, row) => sum + Number(row.leads || 0), 0);

      // Local totals
      let dbSpend = 0, dbImp = 0, dbClicks = 0;
      const localInsights: any[] = [];
      const pageSize = 1_000;
      for (let page = 0; ; page++) {
        const { data: rows, error: insightsError } = await admin.from("insights")
          .select("ad_id,date,attribution_window,spend,impressions,clicks")
          .eq("ad_account_id", acc.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (insightsError) throw insightsError;
        const scopedRows = (rows || []).filter((row: any) => (row.attribution_window || "account_default") === attributionWindow);
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
            .select("ad_id,date,action_type,value,attribution_window")
            .in("ad_id", chunk).gte("date", startDate).lte("date", endDate);
          actionQuery = attributionWindow === "account_default"
            ? actionQuery.or("attribution_window.eq.account_default,attribution_window.is.null")
            : actionQuery.eq("attribution_window", attributionWindow);
          const { data: actions, error: actionsError } = await actionQuery.range(page * pageSize, page * pageSize + pageSize - 1);
          if (actionsError) throw actionsError;
          localActionRows.push(...(actions || []));
          if ((actions || []).length < pageSize) break;
        }
      }
      const localLeadSnapshot = canonicalMetaLeads(
        localInsights.map((row) => ({ ad_id: String(row.ad_id), ad_account_id: acc.id, date: String(row.date), leads: null })),
        localActionRows.map((row) => ({ ad_id: String(row.ad_id), date: String(row.date), action_type: String(row.action_type || ""), value: Number(row.value || 0) })),
        { [acc.id]: lpConfig?.action_type || undefined },
      );
      const dbLeads = localLeadSnapshot.reduce((sum, row) => sum + Number(row.leads || 0), 0);

      const pctDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / b) * 100);
      results.push({
        accountId: acc.id,
        name: acc.name,
        timezone,
        attributionWindow,
        startDate,
        endDate,
        metaRows: metaRows.length,
        localRows: localInsights.length,
        localActionRows: localActionRows.length,
        meta: { spend: metaSpend, impressions: metaImpressions, clicks: metaClicks, leads: metaLeads },
        db: { spend: dbSpend, impressions: dbImp, clicks: dbClicks, leads: dbLeads },
        drift: {
          spendPct: pctDiff(dbSpend, metaSpend),
          leadsPct: pctDiff(dbLeads, metaLeads),
          clicksPct: pctDiff(dbClicks, metaClicks),
          impressionsPct: pctDiff(dbImp, metaImpressions),
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, startDate, endDate, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
