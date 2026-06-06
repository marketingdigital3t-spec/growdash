import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Touch {
  touch_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  source: string;
}

function normalize(s: string) {
  return (s ?? "").toString().toLowerCase().replace(/[\s_\-.]+/g, "").trim();
}

function extractTouchesFromRaw(raw: any, fallbackAt: string | null): Touch[] {
  const out: Touch[] = [];
  if (!raw || typeof raw !== "object") return out;

  const pushFromConv = (conv: any, label: string) => {
    if (!conv || typeof conv !== "object") return;
    const at = conv.created_at || conv.conversion_date || conv.date || fallbackAt;
    if (!at) return;
    const c = conv.content || conv.custom_fields || conv;
    const utm_source = c.utm_source ?? c.cf_utm_source ?? c.source ?? null;
    const utm_medium = c.utm_medium ?? c.cf_utm_medium ?? null;
    const utm_campaign = c.utm_campaign ?? c.cf_utm_campaign ?? null;
    const utm_content = c.utm_content ?? c.cf_utm_content ?? null;
    const utm_term = c.utm_term ?? c.cf_utm_term ?? null;
    if (!utm_source && !utm_campaign && !utm_medium) return;
    out.push({
      touch_at: new Date(at).toISOString(),
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      source: label,
    });
  };

  const lead = raw.deal_lead || raw.contact || {};
  pushFromConv(lead.first_conversion, "first_conversion");
  pushFromConv(lead.last_conversion, "last_conversion");
  if (Array.isArray(lead.conversions)) {
    lead.conversions.forEach((c: any, i: number) => pushFromConv(c, `conversion_${i}`));
  }

  if (Array.isArray(raw.utms)) {
    raw.utms.forEach((u: any) => {
      const at = u.created_at || u.date || fallbackAt;
      if (!at) return;
      out.push({
        touch_at: new Date(at).toISOString(),
        utm_source: u.utm_source ?? u.source ?? null,
        utm_medium: u.utm_medium ?? null,
        utm_campaign: u.utm_campaign ?? null,
        utm_content: u.utm_content ?? null,
        utm_term: u.utm_term ?? null,
        source: "utms_array",
      });
    });
  }

  const seen = new Set<string>();
  return out
    .filter((t) => {
      const k = `${t.touch_at}|${normalize(t.utm_campaign ?? "")}|${normalize(t.utm_source ?? "")}|${normalize(t.utm_medium ?? "")}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.touch_at.localeCompare(b.touch_at));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const adAccountId: string | undefined = body.ad_account_id;

    let query = supabase.from("rd_deals").select("id, rd_deal_id, ad_account_id, user_id, raw, lead_created_at, closed_at");
    if (adAccountId) query = query.eq("ad_account_id", adAccountId);

    const { data: deals, error } = await query.limit(5000);
    if (error) throw error;

    let totalTouches = 0;
    let dealsProcessed = 0;

    const accountIds = Array.from(new Set((deals ?? []).map((d) => d.ad_account_id)));
    const campaignsByAccount = new Map<string, { id: string; name: string }[]>();
    for (const acc of accountIds) {
      const { data: cs } = await supabase.from("campaigns").select("id, name").eq("ad_account_id", acc);
      campaignsByAccount.set(acc, cs ?? []);
    }

    for (const deal of deals ?? []) {
      const touches = extractTouchesFromRaw(deal.raw, deal.lead_created_at || deal.closed_at || null);
      if (touches.length === 0) continue;

      const camps = campaignsByAccount.get(deal.ad_account_id) ?? [];
      const matchCampaign = (utm: string | null) => {
        if (!utm) return null;
        const n = normalize(utm);
        const exact = camps.find((c) => normalize(c.name) === n);
        if (exact) return exact.id;
        const partial = camps.find((c) => normalize(c.name).includes(n) || n.includes(normalize(c.name)));
        return partial?.id ?? null;
      };

      const rows = touches.map((t, idx) => ({
        rd_deal_id: deal.rd_deal_id,
        ad_account_id: deal.ad_account_id,
        user_id: deal.user_id,
        touch_at: t.touch_at,
        utm_source: t.utm_source,
        utm_medium: t.utm_medium,
        utm_campaign: t.utm_campaign,
        utm_content: t.utm_content,
        utm_term: t.utm_term,
        matched_campaign_id: matchCampaign(t.utm_campaign),
        touch_order: idx + 1,
        is_first: idx === 0,
        is_last: idx === touches.length - 1,
        source: t.source,
      }));

      await supabase.from("rd_deal_touches").delete().eq("rd_deal_id", deal.rd_deal_id);
      const { error: insErr } = await supabase.from("rd_deal_touches").insert(rows);
      if (insErr) {
        console.error("Insert error for deal", deal.rd_deal_id, insErr.message);
        continue;
      }

      await supabase.from("rd_deals").update({
        first_touch_utm_campaign: touches[0].utm_campaign,
        last_touch_utm_campaign: touches[touches.length - 1].utm_campaign,
        touch_count: touches.length,
      }).eq("id", deal.id);

      totalTouches += touches.length;
      dealsProcessed += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, deals_processed: dealsProcessed, touches_inserted: totalTouches }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Backfill error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
