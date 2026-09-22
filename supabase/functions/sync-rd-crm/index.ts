import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { buildRDDealNote, isNoteAutomationFunnel } from "../_shared/rdDealNote.ts";
import { resolveRDConnection } from "../_shared/rdConnection.ts";

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
    const { data: connection } = await admin.from("rd_account_connections")
      .select("id,user_id,webhook_secret,api_token,status")
      .eq("webhook_secret", webhookSecret)
      .eq("status", "connected")
      .maybeSingle();
    if (!connection) return json({ error: "Unauthorized" }, 401);

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
        .eq("user_id", connection.user_id)
        .eq("rd_connection_id", connection.id)
        .eq("rd_deal_id", String(dealId));
      return json({ ok: true, deleted: true });
    }

    const pipeline = document?.deal_pipeline || document?.pipeline || {};
    const pipelineId = String(pipeline?.id || pipeline?._id || document?.deal_pipeline_id || "");
    const pipelineName = String(pipeline?.name || "");
    let query = admin.from("rd_funnels")
      .select("id,user_id,rd_funnel_id,name")
      .eq("user_id", connection.user_id)
      .eq("rd_connection_id", connection.id)
      .eq("is_active", true);
    if (pipelineId) query = query.eq("rd_funnel_id", pipelineId);
    const { data: exactFunnels } = await query;

    let funnel = exactFunnels?.[0];
    if (!funnel && pipelineName) {
      const { data: candidates } = await admin.from("rd_funnels")
        .select("id,user_id,rd_funnel_id,name")
        .eq("user_id", connection.user_id)
        .eq("rd_connection_id", connection.id)
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
        service_user_id: connection.user_id,
        rd_connection_id: connection.id,
        cron_trigger: true,
        trigger_source: "webhook",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("rd webhook sync failed", response.status, result);
      return json({ error: result?.error || "RD deal reconciliation failed" }, 502);
    }
    let note: { status: string; error?: string } | undefined;
    if (eventName === "crm_deal_created" && isNoteAutomationFunnel(funnel.name)) {
      note = await publishCreationNote(admin, connection, funnel, String(dealId));
    }
    return json({ ok: true, event: eventName, funnel_id: funnel.id, result, note });
  } catch (error) {
    console.error("sync-rd-crm", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});

async function publishCreationNote(admin: any, connection: any, funnel: any, rdDealId: string) {
  const { data: deal, error: dealError } = await admin
    .from("rd_deals")
    .select("id,rd_deal_id,ad_account_id,contact_name,contact_email,contact_phone,lead_city,lead_state,lead_created_at,custom_fields,raw,meta_lead_id")
    .eq("rd_funnel_id", funnel.id)
    .eq("rd_deal_id", rdDealId)
    .maybeSingle();
  if (dealError || !deal) return { status: "failed", error: dealError?.message || "Negociação não encontrada após sincronização" };

  const { data: existing } = await admin
    .from("rd_deal_note_sync")
    .select("id,status,attempts")
    .eq("rd_connection_id", connection.id)
    .eq("rd_deal_id", rdDealId)
    .maybeSingle();
  if (existing?.status === "sent" || existing?.status === "sending") return { status: "skipped", error: "Anotação já enviada ou em processamento" };

  const meta = await findMetaLead(admin, deal);
  const noteBody = buildRDDealNote({ deal, meta, timezone: "America/Sao_Paulo" });
  const { error: insertError } = await admin.from("rd_deal_note_sync").insert({
    rd_connection_id: connection.id,
    rd_deal_id: rdDealId,
    rd_funnel_id: funnel.id,
    note_body: noteBody,
    status: "pending",
  });
  if (insertError && !String(insertError.message || "").toLowerCase().includes("duplicate")) return { status: "failed", error: insertError.message };

  const { data: claimed, error: claimError } = await admin
    .from("rd_deal_note_sync")
    .update({ note_body: noteBody, status: "sending", attempts: (existing?.attempts || 0) + 1, updated_at: new Date().toISOString(), last_error: null })
    .eq("rd_connection_id", connection.id)
    .eq("rd_deal_id", rdDealId)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) return { status: "skipped", error: "Outra entrega já assumiu esta anotação" };

  try {
    const providerNoteId = await createRDNote(String(connection.api_token || ""), rdDealId, noteBody);
    await admin.from("rd_deal_note_sync").update({ status: "sent", provider_note_id: providerNoteId, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", claimed.id);
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar anotação no RD";
    await admin.from("rd_deal_note_sync").update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", claimed.id);
    console.error("rd deal note publish failed", { funnel_id: funnel.id, rd_deal_id: rdDealId, error: message });
    return { status: "failed", error: message };
  }
}

async function findMetaLead(admin: any, deal: any) {
  let query = admin.from("meta_leads").select("meta_lead_id,full_name,email,phone,lead_city,lead_state,created_time,field_data,raw").limit(1);
  if (deal.meta_lead_id) query = query.eq("meta_lead_id", deal.meta_lead_id);
  else if (deal.contact_email) query = query.eq("email", deal.contact_email.toLowerCase());
  else if (deal.contact_phone) query = query.eq("phone", deal.contact_phone);
  else return null;
  const { data } = await query.maybeSingle();
  if (!data) return null;
  return { ...data, name: data.full_name, city: data.lead_city, state: data.lead_state, ...(data.raw || {}), ...(Array.isArray(data.field_data) ? { field_data: data.field_data } : {}) };
}

async function createRDNote(token: string, rdDealId: string, body: string): Promise<string | null> {
  if (!token) throw new Error("Token do RD Station ausente");
  const response = await fetch(`https://crm.rdstation.com/api/v1/activities?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ deal_id: rdDealId, type: "note", description: body }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RD note HTTP ${response.status}${detail ? ` — ${detail.slice(0, 180)}` : ""}`);
  }
  const payload = await response.json().catch(() => ({}));
  return payload?.id || payload?.uuid || payload?.activity_id || null;
}

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
