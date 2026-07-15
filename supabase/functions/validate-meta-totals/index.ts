import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    let q = admin.from("ad_accounts").select("id, name, account_id, access_token").eq("user_id", user.id);
    if (body.adAccountId) q = q.eq("id", body.adAccountId);
    const { data: accounts, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const acc of accounts || []) {
      const rawId = acc.account_id as string;
      const metaId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
      const url = `${GRAPH_BASE}/${metaId}/insights?fields=spend,impressions,clicks,actions&level=account&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}&access_token=${acc.access_token}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.error) {
        results.push({ accountId: acc.id, name: acc.name, error: j.error.message });
        continue;
      }
      const row = (j.data || [])[0] || {};
      const metaSpend = Number(row.spend || 0);
      const metaImpressions = Number(row.impressions || 0);
      const metaClicks = Number(row.clicks || 0);
      const leadAction = (row.actions || []).find((a: any) =>
        a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped" || a.action_type === "offsite_conversion.fb_pixel_lead"
      );
      const metaLeads = leadAction ? Number(leadAction.value || 0) : 0;

      // Local totals
      const { data: campaigns } = await admin.from("campaigns").select("id").eq("ad_account_id", acc.id);
      const campIds = (campaigns || []).map((c: any) => c.id);
      let dbSpend = 0, dbImp = 0, dbClicks = 0, dbLeads = 0;
      if (campIds.length > 0) {
        const { data: adsRows } = await admin.from("adsets").select("id, campaign_id").in("campaign_id", campIds);
        const adsetIds = (adsRows || []).map((a: any) => a.id);
        if (adsetIds.length > 0) {
          const { data: adRows } = await admin.from("ads").select("id").in("adset_id", adsetIds);
          const adIds = (adRows || []).map((a: any) => a.id);
          if (adIds.length > 0) {
            // chunk to avoid URL limit
            const CHUNK = 200;
            for (let i = 0; i < adIds.length; i += CHUNK) {
              const slice = adIds.slice(i, i + CHUNK);
              const { data: ins } = await admin
                .from("insights")
                .select("spend, impressions, clicks, leads")
                .in("ad_id", slice)
                .gte("date", startDate)
                .lte("date", endDate);
              for (const r of (ins || []) as any[]) {
                dbSpend += Number(r.spend || 0);
                dbImp += Number(r.impressions || 0);
                dbClicks += Number(r.clicks || 0);
                dbLeads += Number(r.leads || 0);
              }
            }
          }
        }
      }

      const pctDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / b) * 100);
      results.push({
        accountId: acc.id,
        name: acc.name,
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
