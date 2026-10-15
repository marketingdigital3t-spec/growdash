import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const requestedWorkspace = typeof body?.workspace_id === "string" ? body.workspace_id : null;
    const rotate = body?.rotate === true;
    let membershipQuery = admin.from("workspace_members").select("workspace_id,role,status,created_at").eq("user_id", user.id).eq("status", "active");
    if (requestedWorkspace) membershipQuery = membershipQuery.eq("workspace_id", requestedWorkspace);
    const { data: memberships, error: membershipError } = await membershipQuery.order("created_at", { ascending: true });
    if (membershipError) throw membershipError;
    const membership = memberships?.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))[0];
    if (!membership) return json({ error: "O usuário não pertence a um workspace ativo." }, 403);
    const workspaceId = membership.workspace_id;
    if (!rotate) {
      const { data: existing } = await admin.from("crm_webhook_endpoints").select("endpoint_key,secret_hint,active,last_received_at,received_count").eq("workspace_id", workspaceId).eq("active", true).maybeSingle();
      if (existing) return json({ configured: true, endpoint_key: existing.endpoint_key, secret_hint: existing.secret_hint, endpoint_url: `${url}/functions/v1/crm-lead-webhook?endpoint=${encodeURIComponent(existing.endpoint_key)}`, last_received_at: existing.last_received_at, received_count: existing.received_count, secret: null, message: "Endpoint já configurado. Rotacione para gerar um novo segredo." });
    }
    if (rotate) await admin.from("crm_webhook_endpoints").update({ active: false, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("active", true);
    const endpointKey = randomHex(16);
    const secret = randomHex(32);
    const { error: insertError } = await admin.from("crm_webhook_endpoints").insert({ workspace_id: workspaceId, endpoint_key: endpointKey, secret_hash: await sha256(secret), secret_hint: `${secret.slice(0, 6)}…${secret.slice(-4)}`, created_by: user.id });
    if (insertError) throw insertError;
    return json({ configured: true, endpoint_key: endpointKey, endpoint_url: `${url}/functions/v1/crm-lead-webhook?endpoint=${encodeURIComponent(endpointKey)}`, secret, secret_hint: `${secret.slice(0, 6)}…${secret.slice(-4)}`, one_time_secret: true, message: "Guarde o segredo. Ele não será exibido novamente." });
  } catch (error) {
    console.error("crm-lead-webhook-config", error);
    return json({ error: "Não foi possível configurar o endpoint de leads." }, 500);
  }
});
