import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

export type GoogleTokenStatus = "healthy" | "expiring" | "error" | "reauthorization_required";
export type GoogleTokenResult = { accessToken: string; refreshed: boolean; status: GoogleTokenStatus; errorCode?: string };
type GoogleCredential = { access_token?: string; refresh_token?: string | null; scope?: string; token_type?: string };

const REFRESH_MARGIN_MS = 60_000;
const refreshLocks = new Map<string, Promise<GoogleTokenResult>>();

export function googleTokenErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /invalid_grant|revoked|unauthorized_client|invalid_client|consent|permission/i.test(message) ? "reauthorization_required" : "error";
}

export async function getFreshGoogleToken(admin: ReturnType<typeof createClient>, integration: { id: string; api_token?: string | null; token_expires_at?: string | null }, source: "health_check" | "api_request" = "api_request", forceRefresh = false): Promise<GoogleTokenResult> {
  let saved: GoogleCredential;
  try { saved = JSON.parse(String(integration.api_token || "{}")) as GoogleCredential; } catch { saved = {}; }
  if (!saved.access_token) throw Object.assign(new Error("A credencial Google está incompleta. Reconecte a conta Google."), { code: "reauthorization_required" });
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  if (!forceRefresh && expiresAt > Date.now() + REFRESH_MARGIN_MS) return { accessToken: saved.access_token, refreshed: false, status: "healthy" };
  if (!saved.refresh_token) throw Object.assign(new Error("A autorização Google expirou. Reconecte a conta Google."), { code: "reauthorization_required" });
  const existingRefresh = refreshLocks.get(integration.id);
  if (existingRefresh) return existingRefresh;
  const refreshPromise = refreshGoogleToken(admin, integration.id, saved.refresh_token, source, forceRefresh);
  refreshLocks.set(integration.id, refreshPromise);
  try { return await refreshPromise; } finally { refreshLocks.delete(integration.id); }
}

async function refreshGoogleToken(admin: ReturnType<typeof createClient>, integrationId: string, fallbackRefreshToken: string, source: "health_check" | "api_request", forceRefresh: boolean): Promise<GoogleTokenResult> {
  const { data: latest } = await admin.from("integrations").select("id,api_token,token_expires_at").eq("id", integrationId).maybeSingle();
  let latestSaved: GoogleCredential = {};
  try { latestSaved = JSON.parse(String(latest?.api_token || "{}")) as GoogleCredential; } catch { latestSaved = {}; }
  const refreshToken = latestSaved.refresh_token || fallbackRefreshToken;
  if (!forceRefresh && latest?.token_expires_at && new Date(latest.token_expires_at).getTime() > Date.now() + REFRESH_MARGIN_MS && latestSaved.access_token) {
    return { accessToken: latestSaved.access_token, refreshed: false, status: "healthy" };
  }
  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const next = await response.json().catch(() => ({}));
  if (!response.ok || !next.access_token) {
    const code = String(next?.error || (response.status === 401 ? "invalid_grant" : "token_refresh_failed"));
    throw Object.assign(new Error(code === "invalid_grant" ? "O Google revogou a autorização. Reconecte a conta Google." : "Não foi possível renovar a autorização Google."), { code });
  }
  latestSaved.access_token = String(next.access_token);
  if (next.refresh_token) latestSaved.refresh_token = String(next.refresh_token);
  const refreshedAt = new Date().toISOString();
  const { error } = await admin.from("integrations").update({
    api_token: JSON.stringify(latestSaved),
    token_expires_at: new Date(Date.now() + Number(next.expires_in ?? 3600) * 1000).toISOString(),
    token_refreshed_at: refreshedAt,
    token_refresh_source: source,
    permission_health: "healthy",
    last_permission_check_at: refreshedAt,
    last_health_error: null,
  }).eq("id", integrationId);
  if (error) throw error;
  return { accessToken: latestSaved.access_token, refreshed: true, status: "healthy" };
}

export function googleTokenFailure(error: unknown): { status: GoogleTokenStatus; errorCode: string; message: string } {
  const errorCode = String((error as { code?: string })?.code || googleTokenErrorCode(error));
  const reauth = errorCode === "invalid_grant" || errorCode === "invalid_client" || errorCode === "unauthorized_client" || errorCode === "reauthorization_required";
  return { status: reauth ? "reauthorization_required" : "error", errorCode, message: error instanceof Error ? error.message : "Falha ao renovar a autorização Google." };
}
