import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const b64url = (value: string) => btoa(unescape(encodeURIComponent(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const input = await req.json().catch(() => ({}));
    const to = String(input.to ?? "").trim();
    const subject = String(input.subject ?? "").trim();
    const html = String(input.html ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(to) || !subject || !html) return json({ error: "Informe um destinatário válido, assunto e mensagem." }, 400);
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integration } = await admin.from("integrations").select("id,api_token,token_expires_at,provider_account_id").eq("user_id", user.id).eq("provider", "google_workspace").eq("is_active", true).maybeSingle();
    if (!integration) return json({ error: "Conecte uma conta Google antes de enviar e-mails." }, 409);
    const credential = JSON.parse(String(integration.api_token || "{}"));
    if (!credential.access_token || !integration.token_expires_at || new Date(integration.token_expires_at).getTime() <= Date.now() + 60_000) return json({ error: "A autorização Google precisa ser renovada. Conecte a conta novamente antes de enviar." }, 401);
    const raw = [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", html].join("\r\n");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${credential.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64url(raw) }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "O Gmail recusou o envio.");
    return json({ ok: true, id: payload.id, from: integration.provider_account_id });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500); }
});
