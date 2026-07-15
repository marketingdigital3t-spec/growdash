import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const resultPage = (status: "success" | "error", message: string, accounts = 0) => {
  const safeMessage = escapeHtml(message);
  const payload = JSON.stringify({
    type: "growdash-meta-oauth",
    status,
    message,
    accounts,
  }).replaceAll("<", "\\u003c");

  return new Response(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Growdash · Meta Ads</title><style>
body{margin:0;background:#090909;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}
main{max-width:520px;border:1px solid #5c4816;border-radius:18px;background:#15130e;padding:32px;text-align:center;box-shadow:0 20px 60px #0008}
h1{color:${status === "success" ? "#f2c94c" : "#ff6b6b"};font-size:24px}p{color:#c8c4bb;line-height:1.55}button{border:0;border-radius:10px;background:#f2c94c;color:#17130a;padding:12px 18px;font-weight:700;cursor:pointer}
</style></head><body><main><h1>${status === "success" ? "Meta Ads conectado" : "Não foi possível conectar"}</h1><p>${safeMessage}</p><button onclick="window.close()">Voltar para a Growdash</button></main>
<script>try{if(window.opener)window.opener.postMessage(${payload},'*')}catch(e){}${status === "success" ? "setTimeout(()=>window.close(),1800)" : ""}</script>
</body></html>`, {
    status: status === "success" ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

type MetaAccount = { id?: string; account_id?: string; name?: string };

Deno.serve(async (req) => {
  if (req.method !== "GET") return resultPage("error", "Método inválido.");

  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  if (!state) return resultPage("error", "O retorno da Meta não contém um estado de segurança válido.");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appId || !appSecret) return resultPage("error", "As credenciais do aplicativo Meta ainda não foram configuradas no servidor.");

    const admin = createClient(supabaseUrl, serviceKey);
    const stateHash = await sha256(state);
    const { data: oauthState, error: stateError } = await admin
      .from("meta_oauth_states")
      .select("state_hash, user_id, expires_at")
      .eq("state_hash", stateHash)
      .maybeSingle();

    // Consume immediately: a callback can never be replayed, even after an error.
    if (oauthState) await admin.from("meta_oauth_states").delete().eq("state_hash", stateHash);
    if (stateError || !oauthState || new Date(oauthState.expires_at).getTime() < Date.now()) {
      return resultPage("error", "Esta tentativa expirou ou já foi utilizada. Inicie a conexão novamente.");
    }

    const metaError = url.searchParams.get("error_message")
      ?? url.searchParams.get("error_description")
      ?? url.searchParams.get("error");
    if (metaError) return resultPage("error", `A Meta recusou a autorização: ${metaError}`);

    const code = url.searchParams.get("code");
    if (!code) return resultPage("error", "A Meta não devolveu o código de autorização.");

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "v25.0";
    const redirectUri = Deno.env.get("META_OAUTH_REDIRECT_URI")
      ?? `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl, { headers: { Accept: "application/json" } });
    const tokenResult = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenResult.access_token) {
      console.error("Meta short token exchange failed", tokenResult?.error?.code ?? tokenResponse.status);
      return resultPage("error", "A Meta não aceitou a troca do código de autorização.");
    }

    const longTokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", tokenResult.access_token);
    const longResponse = await fetch(longTokenUrl, { headers: { Accept: "application/json" } });
    const longResult = await longResponse.json().catch(() => ({}));
    const accessToken = longResponse.ok && longResult.access_token
      ? String(longResult.access_token)
      : String(tokenResult.access_token);

    const accounts: MetaAccount[] = [];
    let after: string | null = null;
    for (let page = 0; page < 20; page += 1) {
      const accountsUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/adaccounts`);
      accountsUrl.searchParams.set("fields", "id,account_id,name");
      accountsUrl.searchParams.set("limit", "100");
      accountsUrl.searchParams.set("access_token", accessToken);
      if (after) accountsUrl.searchParams.set("after", after);

      const accountsResponse = await fetch(accountsUrl, { headers: { Accept: "application/json" } });
      const accountsResult = await accountsResponse.json().catch(() => ({}));
      if (!accountsResponse.ok || accountsResult.error) {
        console.error("Meta ad accounts lookup failed", accountsResult?.error?.code ?? accountsResponse.status);
        return resultPage("error", "A autorização funcionou, mas a Meta não liberou a lista de contas de anúncio. Verifique as permissões do aplicativo e do usuário.");
      }
      accounts.push(...(Array.isArray(accountsResult.data) ? accountsResult.data : []));
      after = accountsResult?.paging?.cursors?.after ?? null;
      if (!after || !accountsResult?.paging?.next) break;
    }

    if (accounts.length === 0) {
      return resultPage("error", "Nenhuma conta de anúncio acessível foi encontrada nesse perfil da Meta.");
    }

    let saved = 0;
    for (const account of accounts) {
      const rawId = String(account.account_id ?? account.id ?? "").replace(/^act_/, "").trim();
      if (!/^\d+$/.test(rawId)) continue;
      const accountId = `act_${rawId}`;
      const values = {
        user_id: oauthState.user_id,
        account_id: accountId,
        name: String(account.name ?? accountId).slice(0, 255),
        access_token: accessToken,
        connection_status: "connected",
        last_sync_error: null,
        last_sync_error_code: null,
        last_sync_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await admin
        .from("ad_accounts")
        .select("id")
        .eq("user_id", oauthState.user_id)
        .eq("account_id", accountId)
        .limit(1)
        .maybeSingle();
      const operation = existing
        ? admin.from("ad_accounts").update(values).eq("id", existing.id)
        : admin.from("ad_accounts").insert(values);
      const { error: saveError } = await operation;
      if (saveError) console.error("Could not save Meta account", accountId, saveError.code);
      else saved += 1;
    }

    if (saved === 0) return resultPage("error", "As contas foram encontradas, mas não puderam ser salvas na Growdash.");
    return resultPage("success", `${saved} conta${saved === 1 ? "" : "s"} de anúncio conectada${saved === 1 ? "" : "s"} com segurança.`, saved);
  } catch (error) {
    console.error("meta-oauth-callback", error);
    return resultPage("error", "Ocorreu uma falha interna ao concluir a conexão.");
  }
});
