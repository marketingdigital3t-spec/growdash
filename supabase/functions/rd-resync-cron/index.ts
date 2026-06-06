// Cron orchestrator: re-syncs recent/open RD deals across all funnels.
// Runs every 30 min via pg_cron. For each active rd_station_crm integration + funnel,
// it picks RD deals updated/created in the last N days OR still in open stages,
// and POSTs them back to rd-sync-deals (in service-role mode) for refresh.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const RECENT_DAYS = 7;
const MAX_PER_FUNNEL = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const summary: Array<Record<string, unknown>> = [];
  try {
    // Active RD integrations
    const { data: integrations } = await admin
      .from("integrations")
      .select("user_id")
      .eq("provider", "rd_station_crm")
      .eq("is_active", true);

    const userIds = Array.from(new Set((integrations || []).map((r: any) => r.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "no active integrations", summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: funnels } = await admin
      .from("rd_funnels")
      .select("id, user_id, rd_funnel_id, name")
      .in("user_id", userIds)
      .not("rd_funnel_id", "is", null);

    const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString();

    for (const f of funnels || []) {
      try {
        // Pull deal ids that are either recently updated or still open/won (so stage changes propagate)
        const { data: rows } = await admin
          .from("rd_deals")
          .select("rd_deal_id, stage_updated_at, lead_created_at, stage_bucket")
          .eq("rd_funnel_id", f.id)
          .or(`stage_updated_at.gte.${cutoff},lead_created_at.gte.${cutoff},stage_bucket.in.(open,won)`)
          .limit(MAX_PER_FUNNEL);

        const ids = (rows || []).map((r: any) => r.rd_deal_id).filter(Boolean);
        if (ids.length === 0) {
          summary.push({ funnel_id: f.id, name: f.name, dispatched: 0 });
          continue;
        }

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/rd-sync-deals`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            funnel_id: f.id,
            deal_ids: ids,
            service_user_id: f.user_id,
            cron_trigger: true,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        summary.push({ funnel_id: f.id, name: f.name, dispatched: ids.length, result: json });
      } catch (e) {
        summary.push({ funnel_id: f.id, name: f.name, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
