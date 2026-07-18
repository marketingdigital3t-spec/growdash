import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-webhook-secret, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const webhookSecret = req.headers.get("x-webhook-secret")?.trim();
    if (!webhookSecret) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: integration } = await admin.from("integrations")
      .select("id,user_id,webhook_secret")
      .eq("provider", "rd_station_crm")
      .eq("is_active", true)
      .eq("webhook_secret", webhookSecret)
      .maybeSingle();
    if (!integration) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => null);
    const document = payload?.document || payload?.deal || payload;
    const dealId = document?.id || document?._id;
    // O RD valida a URL ao criar o webhook. Depois da autenticação acima, uma
    // chamada sem negociação deve responder 2xx para concluir essa validação.
    if (!dealId) return json({ ok: true, validation: true });

    const eventName = String(payload?.event_name || payload?.event || "");
    if (eventName === "crm_deal_deleted") {
      await admin.from("rd_deals")
        .delete()
        .eq("user_id", integration.user_id)
        .eq("rd_deal_id", String(dealId));
      return json({ ok: true, deleted: true });
    }

    const pipeline = document?.deal_pipeline || document?.pipeline || {};
    const pipelineId = String(pipeline?.id || pipeline?._id || document?.deal_pipeline_id || "");
    const pipelineName = String(pipeline?.name || "");
    let query = admin.from("rd_funnels")
      .select("id,user_id,rd_funnel_id,name")
      .eq("user_id", integration.user_id)
      .eq("is_active", true);
    if (pipelineId) query = query.eq("rd_funnel_id", pipelineId);
    const { data: exactFunnels } = await query;

    let funnel = exactFunnels?.[0];
    if (!funnel && pipelineName) {
      const { data: candidates } = await admin.from("rd_funnels")
        .select("id,user_id,rd_funnel_id,name")
        .eq("user_id", integration.user_id)
        .eq("is_active", true);
      const wanted = normalize(pipelineName);
      funnel = (candidates || []).find((item: any) => normalize(item.name) === wanted);
    }
    if (!funnel) {
      // Responder 2xx impede suspensão do webhook. A reconciliação de 15 min
      // volta a tentar depois que o funil for vinculado na Growdash.
      return json({ ok: true, skipped: true, reason: "pipeline_not_linked" });
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/rd-sync-deals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        funnel_id: funnel.id,
        deal_ids: [String(dealId)],
        service_user_id: integration.user_id,
        cron_trigger: true,
        trigger_source: "webhook",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("rd webhook sync failed", response.status, result);
      return json({ error: result?.error || "RD deal reconciliation failed" }, 502);
    }
    return json({ ok: true, event: eventName, funnel_id: funnel.id, result });
  } catch (error) {
    console.error("sync-rd-crm", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
