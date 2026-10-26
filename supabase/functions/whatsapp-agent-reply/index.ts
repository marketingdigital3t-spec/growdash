import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const internal = (req: Request) => {
  const expected = Deno.env.get("AUTOMATION_INTERNAL_SECRET") || "";
  return expected.length >= 24 && req.headers.get("x-growdash-internal-secret") === expected;
};

async function sendMessage(number: Record<string, unknown>, to: string, text: string) {
  if (number.provider === "waha") {
    const base = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/sendText`, { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": Deno.env.get("WAHA_API_KEY") || "" }, body: JSON.stringify({ session: number.waha_session_name, chatId: `${to}@c.us`, text }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || "WAHA recusou a mensagem.");
    return String(payload.id || payload.messageId || crypto.randomUUID());
  }
  const response = await fetch(`https://graph.facebook.com/v23.0/${number.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${number.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Meta recusou a mensagem.");
  return String(payload.messages?.[0]?.id || crypto.randomUUID());
}

Deno.serve(async (req) => {
  if (!internal(req)) return json({ error: "Não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversation_id || "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: conversation } = await admin.from("whatsapp_conversations").select("id,workspace_id,wa_contact_id,whatsapp_number_id,assigned_to,summary").eq("id", conversationId).maybeSingle();
  if (!conversation) return json({ error: "Conversa não encontrada" }, 404);
  const { data: number } = await admin.from("whatsapp_numbers").select("id,provider,phone_number_id,access_token,waha_session_name,agent_id,mode").eq("id", conversation.whatsapp_number_id).maybeSingle();
  if (!number || number.mode === "human" || !number.agent_id) return json({ skipped: true, reason: "human_mode" });
  const { data: agent } = await admin.from("whatsapp_agents").select("id,name,system_prompt,model,knowledge,handoff_rules,status,mode").eq("id", number.agent_id).eq("status", "active").maybeSingle();
  if (!agent) return json({ skipped: true, reason: "agent_inactive" });
  const { data: messages } = await admin.from("whatsapp_messages").select("direction,body,sent_at").eq("conversation_id", conversation.id).order("sent_at", { ascending: false }).limit(30);
  const history = (messages || []).reverse().map((item) => ({ role: item.direction === "outbound" ? "assistant" : "user", content: item.body || "[mídia]" }));
  const key = Deno.env.get("AI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ error: "AI_API_KEY não configurada" }, 503);
  const prompt = `${agent.system_prompt}\n\nContexto de operação: responda em português-Brasil, uma pergunta por vez, não invente dados. Se precisar de humano, escreva [HANDOFF].\nConhecimento: ${JSON.stringify(agent.knowledge || {})}`;
  const response = await fetch(Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: agent.model || "gpt-4o-mini", temperature: 0.2, max_tokens: 500, messages: [{ role: "system", content: prompt }, ...history] }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: payload?.error?.message || "Falha no agente" }, 502);
  const text = String(payload.choices?.[0]?.message?.content || "").trim();
  if (!text) return json({ error: "O agente não retornou texto" }, 502);
  if (text.includes("[HANDOFF]")) {
    await admin.from("whatsapp_conversations").update({ handoff_status: "requested", updated_at: new Date().toISOString() }).eq("id", conversation.id);
    return json({ handoff: true });
  }
  const providerMessageId = await sendMessage(number, conversation.wa_contact_id, text);
  await admin.from("whatsapp_messages").insert({ workspace_id: conversation.workspace_id, conversation_id: conversation.id, wamid: providerMessageId, direction: "outbound", message_type: "text", body: text, status: "sent" });
  await admin.from("whatsapp_conversations").update({ last_outbound_at: new Date().toISOString(), last_message_at: new Date().toISOString(), unread_count: 0, updated_at: new Date().toISOString() }).eq("id", conversation.id);
  return json({ sent: true, provider_message_id: providerMessageId });
});
