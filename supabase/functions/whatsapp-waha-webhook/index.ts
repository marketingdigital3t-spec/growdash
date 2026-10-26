import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { matchingWorkflowAutomations } from "../_shared/automationTrigger.ts";
import { scheduleWhatsAppFollowups } from "../_shared/whatsappFollowups.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");

function textFromMessage(message: Record<string, unknown>) {
  const body = message.body;
  if (typeof body === "string") return body;
  const nested = message._data as Record<string, unknown> | undefined;
  const nestedBody = nested?.body;
  return typeof nestedBody === "string" ? nestedBody : null;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("WAHA_WEBHOOK_SECRET") || "";
  if (expected && req.headers.get("x-growdash-waha-secret") !== expected) return json({ error: "Não autorizado" }, 401);
  if (req.method !== "POST") return json({ received: true });
  const raw = await req.text();
  const payload = JSON.parse(raw || "{}");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sessionName = String(payload.session || payload.me?.id || payload.metadata?.session || "").trim();
  if (!sessionName) return json({ received: true, ignored: "session_missing" });
  const { data: number } = await admin.from("whatsapp_numbers").select("id,workspace_id,ad_account_id,provider,mode,agent_id,waha_session_name").eq("waha_session_name", sessionName).maybeSingle();
  if (!number) return json({ received: true, ignored: "session_unknown" });
  const eventId = String(payload.id || payload.event || payload.timestamp || crypto.randomUUID());
  const payloadHash = await sha256(raw);
  const { error: eventError } = await admin.from("whatsapp_webhook_events").insert({ workspace_id: number.workspace_id, provider: "waha", external_event_id: eventId, event_type: String(payload.event || "message"), payload_sha256: payloadHash, payload, status: "received" });
  if (eventError?.code === "23505") return json({ received: true, duplicate: true });
  if (eventError) return json({ error: eventError.message }, 500);
  if (!String(payload.event || "").includes("message") && payload.event !== "message") {
    await admin.from("whatsapp_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("provider", "waha").eq("external_event_id", eventId);
    await admin.from("whatsapp_numbers").update({ status: payload.event === "session.status" && payload.payload?.status === "WORKING" ? "connected" : undefined, last_webhook_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", number.id);
    return json({ received: true, ignored: "non_message" });
  }
  const message = (payload.payload || payload) as Record<string, unknown>;
  const from = String((message.from || (message._data as any)?.from || "")).replace(/@c\.us$/, "");
  const id = String(message.id || eventId);
  const body = textFromMessage(message);
  if (!from || from.includes("status@")) return json({ received: true, ignored: "sender_missing" });
  const contactName = String((message.notifyName || (message._data as any)?.notifyName || from)).trim();
  const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations").upsert({ workspace_id: number.workspace_id, whatsapp_number_id: number.id, ad_account_id: number.ad_account_id, wa_contact_id: from, contact_name: contactName, contact_phone: from, unread_count: 1, last_inbound_at: new Date().toISOString(), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), attribution: (message.referral || message.context || {}) }, { onConflict: "whatsapp_number_id,wa_contact_id" }).select("id,assigned_to,attribution").single();
  if (conversationError || !conversation) return json({ error: conversationError?.message || "Conversa não criada" }, 500);
  const { error: messageError } = await admin.from("whatsapp_messages").upsert({ workspace_id: number.workspace_id, conversation_id: conversation.id, wamid: id, direction: "inbound", message_type: String(message.type || "text"), body, raw: message, sent_at: new Date().toISOString() }, { onConflict: "wamid" });
  if (messageError) return json({ error: messageError.message }, 500);
  await scheduleWhatsAppFollowups(admin, { workspaceId: number.workspace_id, whatsappNumberId: number.id, conversationId: conversation.id, agentId: number.agent_id, inboundAt: new Date().toISOString() });
  const { data: automations, error: automationsError } = await admin.from("growdash_automations").select("id,status,trigger_type,trigger_config,workflow_definition").eq("workspace_id", number.workspace_id).eq("status", "active");
  if (automationsError) return json({ error: "Automações indisponíveis", error_code: "WHATSAPP_AUTOMATIONS_UNAVAILABLE" }, 503);
  const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") || "";
  const results: unknown[] = [];
  for (const automation of matchingWorkflowAutomations(automations || [], { type: "whatsapp_message", id, text: body || "", whatsapp_number_id: number.id, phone_number_id: number.waha_session_name, from })) {
    if (internalSecret.length < 24) continue;
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/workflow-execute`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": internalSecret }, body: JSON.stringify({ workflow_id: automation.id, mode: "webhook", input: { type: "whatsapp_message", id, text: body, whatsapp_number_id: number.id, ad_account_id: number.ad_account_id, from, raw: message }, idempotency_key: `waha:${automation.id}:${id}` }) });
    results.push({ automation_id: automation.id, status: response.ok ? "processed" : "failed" });
  }
  if (number.mode !== "human" && number.agent_id) {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-agent-reply`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-internal-secret": Deno.env.get("AUTOMATION_INTERNAL_SECRET") || "" }, body: JSON.stringify({ conversation_id: conversation.id, trigger_message_id: id }) });
    results.push({ agent: response.ok ? "queued" : "failed" });
  }
  await admin.from("whatsapp_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("provider", "waha").eq("external_event_id", eventId);
  await admin.from("whatsapp_numbers").update({ status: "connected", last_webhook_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", number.id);
  return json({ received: true, conversation_id: conversation.id, results });
});
