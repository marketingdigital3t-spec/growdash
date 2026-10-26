import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function wahaConfig() {
  const base = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/$/, "");
  const apiKey = Deno.env.get("WAHA_API_KEY") || "";
  if (!base || !apiKey) throw new Error("WAHA_BASE_URL e WAHA_API_KEY precisam estar configurados.");
  return { base, apiKey };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body.workspace_id || "").trim();
  const adAccountId = String(body.ad_account_id || "").trim();
  const sessionName = String(body.session_name || `growdash-${workspaceId}-${adAccountId}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  if (!workspaceId || !adAccountId) return json({ error: "Informe workspace_id e ad_account_id." }, 400);
  const { data: adminMember } = await admin.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!adminMember || !["owner", "admin"].includes(String(adminMember.role))) return json({ error: "Somente owner/admin pode conectar um número." }, 403);
  const { data: account } = await admin.from("ad_accounts").select("id,name,workspace_id").eq("id", adAccountId).eq("workspace_id", workspaceId).maybeSingle();
  if (!account) return json({ error: "Conta de anúncio não encontrada neste workspace." }, 404);
  let config;
  try { config = wahaConfig(); } catch (error) { return json({ error: error instanceof Error ? error.message : "WAHA não configurado." }, 503); }
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.apiKey };
  const existing = await admin.from("whatsapp_numbers").select("id").eq("workspace_id", workspaceId).eq("ad_account_id", adAccountId).maybeSingle();
  if (existing.data?.id) {
    await admin.from("whatsapp_numbers").update({ provider: "waha", waha_session_name: sessionName, status: "disconnected", last_error: null, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
  }
  const create = await fetch(`${config.base}/api/sessions`, { method: "POST", headers, body: JSON.stringify({ name: sessionName, config: { metadata: { workspace_id: workspaceId, ad_account_id: adAccountId }, webhooks: [{ url: `${supabaseUrl}/functions/v1/whatsapp-waha-webhook`, events: ["message", "message.any", "session.status"] }] } }) });
  const createPayload = await create.json().catch(() => ({}));
  if (!create.ok && create.status !== 422) return json({ error: createPayload?.message || createPayload?.error || "WAHA recusou a criação da sessão." }, 400);
  const upsert = await admin.from("whatsapp_numbers").upsert({ workspace_id: workspaceId, created_by: user.id, ad_account_id: adAccountId, provider: "waha", waha_session_name: sessionName, phone_number_id: sessionName, waba_id: "waha", display_phone_number: null, verified_name: account.name || null, access_token: "waha-managed", status: "disconnected", mode: "human", provider_metadata: { account_name: account.name } }, { onConflict: "workspace_id,phone_number_id" }).select("id,workspace_id,ad_account_id,provider,waha_session_name,status,mode,display_phone_number,verified_name").single();
  if (upsert.error) return json({ error: upsert.error.message }, 400);
  const start = await fetch(`${config.base}/api/sessions/${encodeURIComponent(sessionName)}/start`, { method: "POST", headers });
  if (!start.ok && start.status !== 422) return json({ error: "Sessão criada, mas não foi possível iniciá-la no WAHA.", number: upsert.data }, 502);
  return json({ number: upsert.data, session_name: sessionName, qr_required: true });
});
