import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-growdash-webhook-secret, x-webhook-token, x-source-provider, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_PAYLOAD_BYTES = 512 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function text(value: unknown, max = 500) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, max) : null;
}

function nested(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, source);
    const result = text(value);
    if (result) return result;
  }
  return null;
}

function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function headerSecret(req: Request) {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  return req.headers.get("x-growdash-webhook-secret")?.trim()
    || req.headers.get("x-webhook-token")?.trim()
    || bearer
    || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const requestUrl = new URL(req.url);
    const endpointKey = text(req.headers.get("x-growdash-endpoint") || requestUrl.searchParams.get("endpoint"), 128);
    const secret = headerSecret(req);
    if (!endpointKey || !secret) return json({ error: "Endpoint e segredo são obrigatórios." }, 401);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return json({ error: "Payload excede o limite de 512 KB." }, 413);
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "O payload precisa ser um objeto JSON." }, 400);
      payload = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Payload JSON inválido." }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: endpoint, error: endpointError } = await admin.from("crm_webhook_endpoints")
      .select("id,workspace_id,secret_hash,active,received_count")
      .eq("endpoint_key", endpointKey)
      .eq("active", true)
      .maybeSingle();
    if (endpointError) throw endpointError;
    if (!endpoint || !constantTimeEqual(await sha256(secret), String(endpoint.secret_hash))) return json({ error: "Credencial do webhook inválida." }, 401);

    const sourceProvider = (text(req.headers.get("x-source-provider") || payload.source_provider || payload.provider || "webhook", 80) || "webhook").toLowerCase();
    const suppliedId = nested(payload, ["event_id", "lead_id", "external_id", "id"]);
    const externalId = suppliedId || await sha256(raw);
    const email = nested(payload, ["email", "contact.email", "lead.email"]);
    const phone = nested(payload, ["phone", "phone_number", "telefone", "whatsapp", "contact.phone", "lead.phone"]);
    const fullName = nested(payload, ["full_name", "name", "nome", "contact.name", "lead.name"]);
    const utm = payload.utm && typeof payload.utm === "object" ? payload.utm as Record<string, unknown> : {};
    const statusCandidate = (nested(payload, ["status", "stage", "deal.stage"]) || "new").toLowerCase();
    const status = ["new", "contacted", "qualified", "opportunity", "won", "lost", "archived"].includes(statusCandidate) ? statusCandidate : "new";
    let adAccountId: string | null = null;
    const requestedAccountId = nested(payload, ["ad_account_id"]);
    if (requestedAccountId) {
      const accountQuery = admin.from("ad_accounts").select("id").eq("workspace_id", endpoint.workspace_id);
      const { data: account } = await (String(requestedAccountId).match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        ? accountQuery.eq("id", requestedAccountId)
        : accountQuery.eq("account_id", requestedAccountId)).maybeSingle();
      adAccountId = account?.id ?? null;
    }
    const receivedAt = new Date().toISOString();
    const values = {
      workspace_id: endpoint.workspace_id,
      source_provider: sourceProvider,
      external_id: externalId,
      full_name: fullName,
      email,
      phone,
      lead_city: nested(payload, ["city", "cidade", "contact.city"]),
      lead_state: nested(payload, ["state", "uf", "estado", "contact.state"]),
      status,
      utm_source: text(utm.utm_source || payload.utm_source),
      utm_medium: text(utm.utm_medium || payload.utm_medium),
      utm_campaign: text(utm.utm_campaign || payload.utm_campaign),
      utm_content: text(utm.utm_content || payload.utm_content),
      utm_term: text(utm.utm_term || payload.utm_term),
      fbclid: nested(payload, ["fbclid", "tracking.fbclid"]),
      gclid: nested(payload, ["gclid", "tracking.gclid"]),
      ttclid: nested(payload, ["ttclid", "tracking.ttclid"]),
      landing_page: nested(payload, ["landing_page", "landingPage", "page_url"]),
      referrer: nested(payload, ["referrer", "http_referrer"]),
      ad_account_id: adAccountId,
      campaign_id: nested(payload, ["campaign_id", "campaign.id"]),
      adset_id: nested(payload, ["adset_id", "adset.id"]),
      ad_id: nested(payload, ["ad_id", "ad.id"]),
      payload,
      last_received_at: receivedAt,
      updated_at: receivedAt,
    };
    const { data: lead, error: leadError } = await admin.from("crm_leads")
      .upsert(values, { onConflict: "workspace_id,source_provider,external_id" })
      .select("id,workspace_id,source_provider,external_id,status,created_at,last_received_at")
      .single();
    if (leadError) throw leadError;
    await admin.from("crm_webhook_endpoints").update({ last_received_at: receivedAt, received_count: Number(endpoint.received_count || 0) + 1, last_error: null, updated_at: receivedAt }).eq("id", endpoint.id);
    return json({ ok: true, deduplicated: Boolean(suppliedId), lead });
  } catch (error) {
    console.error("crm-lead-webhook", error);
    return json({ error: "Falha ao registrar o lead." }, 500);
  }
});
