import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body.workspace_id || "");
  const wabaId = String(body.waba_id || "").trim();
  const phoneNumberId = String(body.phone_number_id || "").trim();
  const accessToken = String(body.access_token || "").trim();
  if (!workspaceId || !wabaId || !phoneNumberId || !accessToken) return json({ error: "Informe workspace, WABA ID, Phone Number ID e token da WhatsApp Cloud API." }, 400);
  const { data: member } = await admin.from("workspace_members").select("workspace_id").eq("workspace_id", workspaceId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return json({ error: "Workspace não autorizado" }, 403);
  const graph = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const details = await graph.json().catch(() => ({}));
  if (!graph.ok || details.error) return json({ error: details.error?.message || "A Meta recusou o token ou o Phone Number ID." }, 400);
  const { data, error } = await admin.from("whatsapp_numbers").upsert({ workspace_id: workspaceId, created_by: user.id, waba_id: wabaId, phone_number_id: phoneNumberId, display_phone_number: details.display_phone_number || null, verified_name: details.verified_name || null, access_token: accessToken, status: "connected", last_error: null, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,phone_number_id" }).select("id,workspace_id,waba_id,phone_number_id,display_phone_number,verified_name,status,last_error,last_webhook_at,created_at,updated_at").single();
  if (error) return json({ error: error.message }, 400);
  return json({ number: data });
});
