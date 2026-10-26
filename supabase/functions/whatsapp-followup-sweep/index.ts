import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { cancelWhatsAppFollowups } from "../_shared/whatsappFollowups.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const expected = Deno.env.get("AUTOMATION_INTERNAL_SECRET") || "";
  const provided = req.headers.get("x-growdash-automation-secret") || "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let cronAuthorized = false;
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (cronHeader) {
    const { data: config } = await admin.schema("private").from("daily_incremental_sync_config").select("cron_secret").eq("singleton", true).maybeSingle();
    cronAuthorized = !!config?.cron_secret && cronHeader === config.cron_secret;
  }
  if (!(expected.length >= 24 && provided === expected) && !cronAuthorized) return json({ error: "Não autorizado" }, 401);
  const now = new Date().toISOString();
  const { data: due, error: dueError } = await admin.from("whatsapp_followups").select("id,workspace_id,conversation_id,whatsapp_number_id,agent_id,sequence_no").eq("status", "pending").lte("scheduled_at", now).order("scheduled_at").limit(100);
  if (dueError) return json({ error: "Fila de follow-ups indisponível", error_code: "WHATSAPP_FOLLOWUP_QUEUE_UNAVAILABLE" }, 503);
  const results: unknown[] = [];
  for (const followup of due || []) {
    const claimed = await admin.from("whatsapp_followups").update({ status: "processing", updated_at: now }).eq("id", followup.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed.data?.id) continue;
    const { data: conversation } = await admin.from("whatsapp_conversations").select("id,workspace_id,wa_contact_id,last_inbound_at,last_outbound_at,whatsapp_number_id").eq("id", followup.conversation_id).maybeSingle();
    const { data: number } = await admin.from("whatsapp_numbers").select("id,provider,phone_number_id,access_token,waha_session_name,mode,agent_id").eq("id", followup.whatsapp_number_id).maybeSingle();
    if (!conversation || !number || number.mode === "human") { await cancelWhatsAppFollowups(admin, followup.conversation_id); continue; }
    if (conversation.last_outbound_at && conversation.last_inbound_at && new Date(conversation.last_outbound_at) > new Date(conversation.last_inbound_at)) { await cancelWhatsAppFollowups(admin, followup.conversation_id); continue; }
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-agent-reply`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-internal-secret": expected }, body: JSON.stringify({ conversation_id: conversation.id, followup_id: followup.id }) });
    if (response.ok) { await admin.from("whatsapp_followups").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", followup.id); results.push({ id: followup.id, status: "sent" }); }
    else { const errorText = await response.text(); await admin.from("whatsapp_followups").update({ status: "failed", error_message: errorText.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", followup.id); results.push({ id: followup.id, status: "failed" }); }
  }
  return json({ processed: results.length, results });
});
