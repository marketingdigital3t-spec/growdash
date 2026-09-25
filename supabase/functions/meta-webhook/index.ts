import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-hub-signature-256, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(value: string) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function validSignature(raw: string, signature: string | null) {
  const secret = Deno.env.get("META_APP_SECRET");
  if (!secret) return false;
  if (!signature?.startsWith("sha256=")) return false;
  const encoded = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(encoded)) return false;
  const expected = new Uint8Array(encoded.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(raw));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (!verifyToken || url.searchParams.get("hub.verify_token") !== verifyToken) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    return new Response(url.searchParams.get("hub.challenge") ?? "", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  }
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) return json({ error: "Assinatura Meta inválida" }, 401);
  try {
    const payload = JSON.parse(raw);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const events: Array<{ provider_event_id: string; event_type: string; payload: unknown }> = [];
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      const entryId = String(entry?.id ?? "unknown");
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value ?? {};
        const eventType = String(change?.field ?? payload?.object ?? "meta_event");
        const providerEventId = String(value?.leadgen_id ?? value?.lead_id ?? value?.message_id ?? value?.id ?? `${entryId}:${eventType}:${JSON.stringify(value)}`);
        events.push({ provider_event_id: providerEventId, event_type: eventType, payload: { object: payload?.object ?? null, entry_id: entryId, value } });
      }
      if (Array.isArray(entry?.messaging)) for (const message of entry.messaging) {
        const providerEventId = String(message?.message?.mid ?? message?.timestamp ?? `${entryId}:messaging:${JSON.stringify(message)}`);
        events.push({ provider_event_id: providerEventId, event_type: "messaging", payload: { object: payload?.object ?? null, entry_id: entryId, message } });
      }
    }
    let inserted = 0;
    for (const event of events) {
      const eventPayload = JSON.stringify(event.payload);
      const { data, error } = await admin.from("meta_webhook_events").insert({ provider_event_id: event.provider_event_id, event_type: event.event_type, payload_sha256: await sha256(eventPayload), payload: event.payload, attempts: 1, processed_at: new Date().toISOString() }).select("id").maybeSingle();
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      if (data) inserted++;
    }
    return json({ ok: true, received: events.length, inserted, duplicate: events.length - inserted });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao processar webhook Meta" }, 500);
  }
});
