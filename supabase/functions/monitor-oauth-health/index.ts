import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HealthStatus = "healthy" | "expiring" | "expired" | "permission_removed" | "error" | "unchecked";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, service);
    const { data: membership } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership?.workspace_id) throw new Error("Workspace not found");
    const { data: integrations, error } = await admin.from("integrations").select("id, provider, access_token, token_expires_at, is_active").eq("user_id", user.id);
    if (error) throw error;

    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const required = ["ads_read", "business_management"];
    const results = [];
    for (const integration of integrations || []) {
      let status: HealthStatus = "unchecked";
      let missingPermissions: string[] = [];
      let details: Record<string, unknown> = {};
      const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
      if (!integration.is_active) status = "error";
      else if (expiresAt && expiresAt.getTime() <= Date.now()) status = "expired";
      else if (expiresAt && expiresAt.getTime() - Date.now() < 7 * 86_400_000) status = "expiring";
      else status = "healthy";

      if (["meta", "facebook", "instagram", "meta_ads"].includes(String(integration.provider).toLowerCase()) && integration.access_token && appId && appSecret) {
        try {
          const debug = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(integration.access_token)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`);
          const payload = await debug.json();
          const scopes = Array.isArray(payload?.data?.scopes) ? payload.data.scopes : [];
          missingPermissions = required.filter((scope) => !scopes.includes(scope));
          details = { is_valid: payload?.data?.is_valid === true, data_access_expires_at: payload?.data?.data_access_expires_at || null, scopes };
          if (payload?.data?.is_valid !== true) status = "expired";
          else if (missingPermissions.length) status = "permission_removed";
          else if (status === "unchecked") status = "healthy";
        } catch (debugError) {
          status = "error";
          details = { message: debugError instanceof Error ? debugError.message : "Meta token debug failed" };
        }
      }

      await admin.from("integrations").update({ permission_health: status, last_permission_check_at: new Date().toISOString(), last_health_error: status === "error" ? String(details.message || "Health check failed") : null }).eq("id", integration.id);
      await admin.from("oauth_health_events").insert({ workspace_id: membership.workspace_id, integration_id: integration.id, provider: integration.provider, status, missing_permissions: missingPermissions, details });
      results.push({ id: integration.id, provider: integration.provider, status, missing_permissions: missingPermissions });
    }
    return new Response(JSON.stringify({ checked: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
