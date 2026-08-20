import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")?.trim();
    if (!clientId || !clientSecret) return json({ error: "A conexão Google ainda não foi configurada no servidor.", action: "Cadastre GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET nos segredos do Supabase e adicione a URL de retorno no Google Cloud." }, 503);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("google_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error } = await admin.from("google_oauth_states").insert({ state_hash: await sha256(state), user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (error) throw error;
    const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") ?? `${supabaseUrl}/functions/v1/google-workspace-oauth-callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.send");
    url.searchParams.set("state", state);
    return json({ authUrl: url.toString(), redirectUri });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500); }
});
