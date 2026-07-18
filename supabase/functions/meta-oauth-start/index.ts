import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!appId || !appSecret) {
      const missing = [!appId && "META_APP_ID", !appSecret && "META_APP_SECRET"].filter(Boolean).join(" e ");
      return json({
        error: "As credenciais do aplicativo Meta ainda não foram configuradas no servidor.",
        code: "META_APP_NOT_CONFIGURED",
        action: `Cadastre ${missing} nos segredos do Supabase. A URL de retorno já está configurada.`,
      }, 503);
    }
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida ou expirada" }, 401);

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = base64Url(stateBytes);
    const stateHash = await sha256(state);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    // Opportunistic cleanup keeps this table small without a separate cron.
    await admin.from("meta_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error: stateError } = await admin.from("meta_oauth_states").insert({
      state_hash: stateHash,
      user_id: user.id,
      expires_at: expiresAt,
    });
    if (stateError) throw stateError;

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "v25.0";
    const redirectUri = Deno.env.get("META_OAUTH_REDIRECT_URI")
      ?? `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const scopes = Deno.env.get("META_OAUTH_SCOPES")
      ?? "ads_read,ads_management,business_management";

    const oauthUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
    oauthUrl.searchParams.set("client_id", appId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("state", state);
    oauthUrl.searchParams.set("scope", scopes);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("auth_type", "rerequest");

    return json({ authUrl: oauthUrl.toString(), expiresAt });
  } catch (error) {
    console.error("meta-oauth-start", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
