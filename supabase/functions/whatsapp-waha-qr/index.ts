import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const numberId = String(body.whatsapp_number_id || "").trim();
  const { data: number } = await admin.from("whatsapp_numbers").select("id,workspace_id,waha_session_name").eq("id", numberId).maybeSingle();
  if (!number?.waha_session_name) return json({ error: "Sessão WAHA não encontrada." }, 404);
  const { data: member } = await admin.from("workspace_members").select("role").eq("workspace_id", number.workspace_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member || !["owner", "admin"].includes(String(member.role))) return json({ error: "Somente owner/admin pode obter o QR Code." }, 403);
  const base = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/$/, "");
  const apiKey = Deno.env.get("WAHA_API_KEY") || "";
  if (!base || !apiKey) return json({ error: "WAHA não configurado." }, 503);
  const response = await fetch(`${base}/api/${encodeURIComponent(number.waha_session_name)}/auth/qr`, { headers: { "X-Api-Key": apiKey } });
  if (!response.ok) return json({ error: "QR Code ainda não está disponível.", status: response.status }, 502);
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return json({ session_name: number.waha_session_name, qr_data_url: `data:${contentType};base64,${btoa(binary)}` });
});
