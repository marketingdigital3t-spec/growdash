import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const page = (status: "success" | "error", message: string) => {
  const payload = JSON.stringify({ type: "growdash-google-workspace-oauth", status, message }).replaceAll("<", "\\u003c");
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Growdash · Google</title><style>body{margin:0;background:#090909;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}main{max-width:520px;border:1px solid #444;border-radius:18px;background:#161616;padding:32px;text-align:center;box-shadow:0 20px 60px #0008}h1{color:${status === "success" ? "#fff" : "#ff7474"}}p{color:#c8c8c8;line-height:1.55}button{border:0;border-radius:10px;background:#fff;color:#111;padding:12px 18px;font-weight:700}</style><main><h1>${status === "success" ? "Google conectado" : "Conexão não concluída"}</h1><p>${escapeHtml(message)}</p><button onclick="window.close()">Voltar para a Growdash</button></main><script>try{if(window.opener)window.opener.postMessage(${payload},'*')}catch(e){}${status === "success" ? "setTimeout(()=>window.close(),1600)" : ""}</script>`, { status: status === "success" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" } });
};

Deno.serve(async (req) => {
  if (req.method !== "GET") return page("error", "Método inválido.");
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    if (!state || !code) return page("error", url.searchParams.get("error_description") ?? "O Google não devolveu uma autorização válida.");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")?.trim();
    if (!clientId || !clientSecret) return page("error", "Credenciais Google ausentes no servidor.");
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: stateRow } = await admin.from("google_oauth_states").select("user_id,expires_at").eq("state_hash", await sha256(state)).maybeSingle();
    await admin.from("google_oauth_states").delete().eq("state_hash", await sha256(state));
    if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) return page("error", "Esta tentativa expirou ou já foi utilizada.");
    const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") ?? `${supabaseUrl}/functions/v1/google-workspace-oauth-callback`;
    const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token) return page("error", "O Google não aceitou a troca do código. Confira o cliente OAuth e a URL de retorno.");
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json().catch(() => ({}));
    const email = String(profile.email ?? "").trim().toLowerCase();
    if (!profileResponse.ok || !email) return page("error", "A conta Google foi autorizada, mas o e-mail não pôde ser identificado.");
    // api_token stores the access token and refresh token only for server-side
    // use. It is never included in authenticated grants for integrations.
    const credentials = JSON.stringify({ access_token: token.access_token, refresh_token: token.refresh_token ?? null, scope: token.scope ?? "", token_type: token.token_type ?? "Bearer" });
    const values = { api_token: credentials, is_active: true, token_expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString() };
    const { data: existing } = await admin.from("integrations").select("id").eq("user_id", stateRow.user_id).eq("provider", "google_workspace").eq("provider_account_id", email).maybeSingle();
    const result = existing ? await admin.from("integrations").update(values).eq("id", existing.id) : await admin.from("integrations").insert({ user_id: stateRow.user_id, provider: "google_workspace", provider_account_id: email, ...values });
    if (result.error) throw result.error;
    return page("success", `${email} foi conectado. Drive e envio de e-mail estão autorizados.`);
  } catch (error) { return page("error", error instanceof Error ? error.message : "Falha interna ao concluir a conexão."); }
});
