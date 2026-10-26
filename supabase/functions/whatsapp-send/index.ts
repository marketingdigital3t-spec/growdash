import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { cancelWhatsAppFollowups } from "../_shared/whatsappFollowups.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversation_id || "");
  const text = String(body.text || "").trim();
  if (!conversationId || !text) return json({ error: "Conversa e mensagem são obrigatórias." }, 400);
  const { data: conversation } = await admin.from("whatsapp_conversations").select("id,workspace_id,wa_contact_id,whatsapp_numbers!inner(provider,phone_number_id,access_token,waha_session_name)").eq("id", conversationId).maybeSingle();
  if (!conversation) return json({ error: "Conversa não encontrada." }, 404);
  const { data: member } = await admin.from("workspace_members").select("workspace_id").eq("workspace_id", conversation.workspace_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return json({ error: "Workspace não autorizado" }, 403);
  const number = Array.isArray((conversation as any).whatsapp_numbers) ? (conversation as any).whatsapp_numbers[0] : (conversation as any).whatsapp_numbers;
  const response = number.provider === "waha"
    ? await fetch(`${(Deno.env.get("WAHA_BASE_URL") || "").replace(/\/$/, "")}/api/sendText`, { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": Deno.env.get("WAHA_API_KEY") || "" }, body: JSON.stringify({ session: number.waha_session_name, chatId: `${conversation.wa_contact_id}@c.us`, text }) })
    : await fetch(`https://graph.facebook.com/v23.0/${number.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${number.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: conversation.wa_contact_id, type: "text", text: { body: text } }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) return json({ error: result.error?.message || result.message || "O provedor recusou o envio." }, 400);
  const wamid = result.messages?.[0]?.id || result.id || result.messageId || crypto.randomUUID();
  await admin.from("whatsapp_messages").insert({ workspace_id: conversation.workspace_id, conversation_id: conversation.id, wamid, direction: "outbound", message_type: "text", body: text, status: "sent" });
  await cancelWhatsAppFollowups(admin, conversation.id);
  await admin.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
  return json({ sent: true, wamid });
});
