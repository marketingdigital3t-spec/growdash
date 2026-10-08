import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-whatsapp-verify-token, x-hub-signature-256, authorization, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function validSignature(rawBody: string, header: string | null) {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("META_APP_SECRET") ?? "";
  if (!secret || !header || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const expected = new Uint8Array(header.slice(7).match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return await crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(rawBody));
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) return new Response(challenge || "", { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const rawBody = await req.text();
  const signatureSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("META_APP_SECRET") ?? "";
  if (!(await validSignature(rawBody, req.headers.get("x-hub-signature-256")))) {
    return json({ error: signatureSecret ? "Assinatura Meta inválida" : "Webhook WhatsApp sem segredo de assinatura configurado" }, signatureSecret ? 401 : 503);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = JSON.parse(rawBody || "{}");
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const { data: number } = await admin.from("whatsapp_numbers").select("id,workspace_id").eq("phone_number_id", phoneNumberId).maybeSingle();
      if (!number) continue;
      for (const message of value.messages || []) {
        const contact = (value.contacts || []).find((item: any) => item.wa_id === message.from);
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || null;
        const { data: conversation } = await admin.from("whatsapp_conversations").upsert({ workspace_id: number.workspace_id, whatsapp_number_id: number.id, wa_contact_id: message.from, contact_name: contact?.profile?.name || null, contact_phone: message.from, unread_count: 1, last_message_at: new Date(Number(message.timestamp || 0) * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "whatsapp_number_id,wa_contact_id" }).select("id").single();
        if (!conversation) continue;
        await admin.from("whatsapp_messages").upsert({ workspace_id: number.workspace_id, conversation_id: conversation.id, wamid: message.id, direction: "inbound", message_type: message.type || "text", body: text, raw: message, sent_at: new Date(Number(message.timestamp || 0) * 1000).toISOString() }, { onConflict: "wamid" });
      }
      await admin.from("whatsapp_numbers").update({ last_webhook_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", number.id);
    }
  }
  return json({ received: true });
});
