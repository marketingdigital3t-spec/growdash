import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const page = (status: "success" | "error", message: string) => {
  const payload = JSON.stringify({ type: "growdash-instagram-oauth", status, message }).replaceAll("<", "\\u003c");
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Growdash · Instagram</title><style>body{margin:0;background:#090806;color:#f8f4e8;font:16px system-ui;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}main{max-width:520px;border:1px solid #604a17;border-radius:20px;background:#15120b;padding:32px;text-align:center;box-shadow:0 24px 70px #000a}h1{color:${status === "success" ? "#f2c94c" : "#ff7474"}}p{color:#c9c1ae;line-height:1.6}button{border:0;border-radius:11px;background:#f2c94c;color:#211806;padding:12px 20px;font-weight:800}</style></head><body><main><h1>${status === "success" ? "Instagram conectado" : "Conexão não concluída"}</h1><p>${escapeHtml(message)}</p><button onclick="window.close()">Voltar para a Growdash</button></main><script>try{if(window.opener)window.opener.postMessage(${payload},'*')}catch(e){}${status === "success" ? "setTimeout(()=>window.close(),1600)" : ""}</script></body></html>`, { status: status === "success" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" } });
};

Deno.serve(async (req) => {
  if (req.method !== "GET") return page("error", "Método inválido.");
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  if (!state) return page("error", "O retorno não contém o estado de segurança.");
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const appId = Deno.env.get("INSTAGRAM_APP_ID") ?? Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("INSTAGRAM_APP_SECRET") ?? Deno.env.get("META_APP_SECRET");
    if (!appId || !appSecret) return page("error", "Credenciais do Instagram não configuradas.");
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stateHash = await sha256(state);
    const { data: oauthState } = await admin.from("instagram_oauth_states").select("state_hash,user_id,expires_at").eq("state_hash", stateHash).maybeSingle();
    if (oauthState) await admin.from("instagram_oauth_states").delete().eq("state_hash", stateHash);
    if (!oauthState || new Date(oauthState.expires_at).getTime() < Date.now()) return page("error", "Esta tentativa expirou ou já foi utilizada.");
    const denied = url.searchParams.get("error_description") ?? url.searchParams.get("error_message");
    if (denied) return page("error", denied);
    const code = url.searchParams.get("code")?.replace(/#_$/, "");
    if (!code) return page("error", "O Instagram não devolveu o código de autorização.");
    const redirectUri = Deno.env.get("INSTAGRAM_OAUTH_REDIRECT_URI") ?? `${supabaseUrl}/functions/v1/instagram-oauth-callback`;
    const form = new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code });
    const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const short = await shortResponse.json().catch(() => ({}));
    if (!shortResponse.ok || !short.access_token) return page("error", "O Instagram não aceitou a troca do código de autorização.");
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", short.access_token);
    const longResponse = await fetch(longUrl);
    const long = await longResponse.json().catch(() => ({}));
    const token = String(long.access_token ?? short.access_token);
    const expiresIn = Number(long.expires_in ?? 3600);
    const graphVersion = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") ?? "v25.0";
    const profileUrl = new URL(`https://graph.instagram.com/${graphVersion}/me`);
    profileUrl.searchParams.set("fields", "id,username,name,profile_picture_url,followers_count,media_count,account_type");
    profileUrl.searchParams.set("access_token", token);
    const profileResponse = await fetch(profileUrl);
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.id) return page("error", "A conta foi autorizada, mas o perfil profissional não pôde ser lido.");
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const integrationValues = { api_token: token, is_active: true, provider_account_id: String(profile.id), token_expires_at: expiresAt, updated_at: new Date().toISOString() };
    const { data: existing } = await admin.from("integrations").select("id").eq("user_id", oauthState.user_id).eq("provider", "instagram_business").eq("provider_account_id", String(profile.id)).maybeSingle();
    const integrationOp = existing
      ? admin.from("integrations").update(integrationValues).eq("id", existing.id)
      : admin.from("integrations").insert({ user_id: oauthState.user_id, provider: "instagram_business", ...integrationValues });
    const { error: integrationError } = await integrationOp;
    if (integrationError) throw integrationError;
    const { error: accountError } = await admin.from("social_accounts").upsert({ user_id: oauthState.user_id, provider: "instagram", provider_account_id: String(profile.id), username: profile.username ?? null, display_name: profile.name ?? profile.username ?? "Instagram", profile_picture_url: profile.profile_picture_url ?? null, followers_count: Number(profile.followers_count ?? 0), media_count: Number(profile.media_count ?? 0), connection_status: "connected", last_error: null, last_sync_at: new Date().toISOString() }, { onConflict: "user_id,provider,provider_account_id" });
    if (accountError) throw accountError;
    return page("success", `@${profile.username ?? "perfil"} foi conectado com segurança.`);
  } catch (error) {
    console.error("instagram-oauth-callback", error);
    return page("error", "Falha interna ao concluir a conexão.");
  }
});
