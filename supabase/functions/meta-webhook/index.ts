import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-hub-signature-256, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type MetaAccount = { id: string; user_id: string; workspace_id: string | null; access_token: string; account_id: string };

function pickField(fields: unknown, names: string[]) {
  if (!Array.isArray(fields)) return null;
  const wanted = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const field of fields) {
    const key = String(field?.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!wanted.some((name) => key === name || key.includes(name))) continue;
    const value = Array.isArray(field?.values) ? field.values[0] : field?.values;
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

async function resolveAccount(admin: any, adId: string | null, formId: string | null): Promise<MetaAccount | null> {
  let accountId: string | null = null;
  if (adId) {
    const { data: ad } = await admin.from("ads").select("adset_id").eq("id", adId).maybeSingle();
    if (ad?.adset_id) {
      const { data: adset } = await admin.from("adsets").select("campaign_id").eq("id", ad.adset_id).maybeSingle();
      if (adset?.campaign_id) {
        const { data: campaign } = await admin.from("campaigns").select("ad_account_id").eq("id", adset.campaign_id).maybeSingle();
        accountId = campaign?.ad_account_id ?? null;
      }
    }
  }
  if (!accountId && formId) {
    const { data: lead } = await admin.from("meta_leads").select("ad_account_id").eq("form_id", formId).order("created_time", { ascending: false }).limit(1).maybeSingle();
    accountId = lead?.ad_account_id ?? null;
  }
  if (!accountId) return null;
  const { data: account } = await admin.from("ad_accounts").select("id,user_id,workspace_id,access_token,account_id").eq("id", accountId).maybeSingle();
  return account ?? null;
}

async function fetchLead(leadId: string, account: MetaAccount) {
  const version = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(leadId)}?fields=id,created_time,ad_id,adset_id,campaign_id,form_id,field_data&access_token=${encodeURIComponent(account.access_token)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message || `Meta lead HTTP ${response.status}`);
  return payload;
}

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
    const events: Array<{ provider_event_id: string; event_type: string; payload: any }> = [];
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
    let processed = 0;
    const errors: string[] = [];
    for (const event of events) {
      const eventPayload = JSON.stringify(event.payload);
      const value = event.payload?.value ?? {};
      const leadId = event.event_type === "leadgen" ? String(value.leadgen_id ?? "") : "";
      const adId = value.ad_id ? String(value.ad_id) : null;
      const formId = value.form_id ? String(value.form_id) : null;
      const account = await resolveAccount(admin, adId, formId);
      const { data, error } = await admin.from("meta_webhook_events").insert({
        workspace_id: account?.workspace_id ?? null,
        ad_account_id: account?.id ?? null,
        provider_event_id: event.provider_event_id,
        event_type: event.event_type,
        payload_sha256: await sha256(eventPayload),
        payload: event.payload,
        attempts: 1,
      }).select("id").maybeSingle();
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      if (!data) continue;
      inserted++;
      if (leadId && account) {
        try {
          const lead = await fetchLead(leadId, account);
          const fieldData = Array.isArray(lead.field_data) ? lead.field_data : [];
          const { error: leadError } = await admin.from("meta_leads").upsert({
            ad_account_id: account.id,
            campaign_id: lead.campaign_id ?? null,
            adset_id: lead.adset_id ?? null,
            ad_id: lead.ad_id ?? adId,
            form_id: lead.form_id ?? formId,
            meta_lead_id: String(lead.id ?? leadId),
            created_time: lead.created_time ?? new Date().toISOString(),
            field_data: fieldData,
            email: pickField(fieldData, ["email", "e-mail"]),
            phone: pickField(fieldData, ["phone_number", "phone", "telefone", "whatsapp"]),
            full_name: pickField(fieldData, ["full_name", "name", "nome"]),
            lead_city: pickField(fieldData, ["city", "cidade"]),
            raw: lead,
          }, { onConflict: "meta_lead_id" });
          if (leadError) throw leadError;
          processed++;
          await admin.from("meta_webhook_events").update({ processed_at: new Date().toISOString(), error_message: null }).eq("id", data.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${event.provider_event_id}: ${message}`);
          await admin.from("meta_webhook_events").update({ error_message: message }).eq("id", data.id);
        }
      }
    }
    return json({ ok: true, received: events.length, inserted, processed, duplicate: events.length - inserted, errors }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao processar webhook Meta" }, 500);
  }
});
