import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HealthStatus = "healthy" | "expiring" | "expired" | "permission_removed" | "error" | "unchecked";
type TokenCheck = { status: HealthStatus; permissions: string[]; details: Record<string, unknown> };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const expiryStatus = (isActive: boolean | null, expiresAt: string | null): HealthStatus => {
  if (!isActive) return "error";
  if (!expiresAt) return "unchecked";
  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return "expired";
  if (timestamp - Date.now() < 7 * 86_400_000) return "expiring";
  return "healthy";
};

async function checkMetaToken(token: string, appId?: string, appSecret?: string): Promise<TokenCheck> {
  if (!appId || !appSecret) {
    return { status: "unchecked", permissions: [], details: { reason: "META_APP_SECRET não configurado" } };
  }

  const debugUrl = new URL("https://graph.facebook.com/debug_token");
  debugUrl.searchParams.set("input_token", token);
  debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);
  const response = await fetch(debugUrl, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    return {
      status: "error",
      permissions: [],
      details: { http_status: response.status, code: payload?.error?.code ?? null },
    };
  }

  const data = payload?.data ?? {};
  const permissions = Array.isArray(data.scopes) ? data.scopes.map(String) : [];
  const missing = ["ads_read"].filter((permission) => !permissions.includes(permission));
  const status: HealthStatus = data.is_valid !== true
    ? "expired"
    : missing.length > 0
      ? "permission_removed"
      : "healthy";
  return {
    status,
    permissions,
    details: {
      is_valid: data.is_valid === true,
      app_id: data.app_id ?? null,
      data_access_expires_at: data.data_access_expires_at ?? null,
      missing_permissions: missing,
    },
  };
}

async function checkInstagramToken(token: string, version: string): Promise<TokenCheck> {
  const profileUrl = new URL(`https://graph.instagram.com/${version}/me`);
  profileUrl.searchParams.set("fields", "id,username");
  profileUrl.searchParams.set("access_token", token);
  const response = await fetch(profileUrl, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error || !payload?.id) {
    return {
      status: response.status === 401 || payload?.error?.code === 190 ? "expired" : "error",
      permissions: [],
      details: { http_status: response.status, code: payload?.error?.code ?? null },
    };
  }
  return {
    status: "healthy",
    permissions: [],
    details: { account_id: String(payload.id), username: payload.username ?? null },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(url, service);
    const { data: membership, error: membershipError } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError || !membership?.workspace_id) return json({ error: "Workspace não encontrado" }, 409);

    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const graphVersion = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") ?? "v25.0";
    const results: Array<Record<string, unknown>> = [];

    const { data: accounts, error: accountsError } = await admin
      .from("ad_accounts")
      .select("id, account_id, access_token, connection_status, oauth_health_status, oauth_checked_at")
      .eq("user_id", user.id);
    if (accountsError) throw accountsError;

    for (const account of accounts ?? []) {
      const baseStatus = expiryStatus(account.connection_status === "connected", null);
      const check = account.access_token
        ? await checkMetaToken(String(account.access_token), appId, appSecret)
        : { status: baseStatus === "error" ? "error" : "unchecked" as HealthStatus, permissions: [], details: { reason: "Token ausente" } };
      const checkedAt = new Date().toISOString();
      await admin.from("ad_accounts").update({
        oauth_health_status: check.status,
        oauth_checked_at: checkedAt,
        oauth_permissions: check.permissions,
      }).eq("id", account.id).eq("user_id", user.id);
      await admin.from("oauth_health_events").insert({
        workspace_id: membership.workspace_id,
        ad_account_id: account.id,
        provider: "meta_ads",
        status: check.status,
        missing_permissions: check.details.missing_permissions ?? [],
        details: check.details,
      });
      results.push({ id: account.id, provider: "meta_ads", status: check.status, missing_permissions: check.details.missing_permissions ?? [] });
    }

    const { data: integrations, error: integrationsError } = await admin
      .from("integrations")
      .select("id, provider, api_token, provider_account_id, token_expires_at, is_active")
      .eq("user_id", user.id);
    if (integrationsError) throw integrationsError;

    for (const integration of integrations ?? []) {
      const provider = String(integration.provider).toLowerCase();
      const baseStatus = expiryStatus(integration.is_active, integration.token_expires_at);
      let check: TokenCheck = { status: baseStatus, permissions: [], details: {} };
      if (integration.api_token && provider === "instagram_business") {
        check = await checkInstagramToken(String(integration.api_token), graphVersion);
        if (check.status === "healthy" && baseStatus === "expiring") check.status = "expiring";
      }
      const checkedAt = new Date().toISOString();
      await admin.from("integrations").update({
        permission_health: check.status,
        last_permission_check_at: checkedAt,
        last_health_error: check.status === "error" ? "Falha ao validar o token" : null,
      }).eq("id", integration.id).eq("user_id", user.id);
      await admin.from("oauth_health_events").insert({
        workspace_id: membership.workspace_id,
        integration_id: integration.id,
        provider,
        status: check.status,
        missing_permissions: check.details.missing_permissions ?? [],
        details: check.details,
      });
      results.push({ id: integration.id, provider, status: check.status, missing_permissions: check.details.missing_permissions ?? [] });
    }

    return json({ checked: results.length, results });
  } catch (error) {
    console.error("monitor-oauth-health", error);
    return json({ error: error instanceof Error ? error.message : "Falha interna ao verificar OAuth" }, 500);
  }
});
