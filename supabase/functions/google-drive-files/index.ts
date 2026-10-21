import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getFreshGoogleToken, googleTokenFailure } from "../_shared/googleToken.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GOOGLE_REQUEST_TIMEOUT_MS = 15_000;
const GOOGLE_RETRY_DELAYS_MS = [500, 1_500, 3_000];

async function fetchGoogle(url: string, init: RequestInit = {}) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < GOOGLE_RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok || (![429, 500, 502, 503, 504].includes(response.status) || attempt === GOOGLE_RETRY_DELAYS_MS.length - 1)) {
        return response;
      }
      const retryAfter = Number(response.headers.get("Retry-After") || "0");
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1_000 : GOOGLE_RETRY_DELAYS_MS[attempt]));
    } catch (error) {
      lastError = error;
      if (attempt === GOOGLE_RETRY_DELAYS_MS.length - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, GOOGLE_RETRY_DELAYS_MS[attempt]));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao consultar o Google Drive.");
}

function driveFileRow(userId: string, integrationId: string, file: any) {
  return {
    user_id: userId,
    integration_id: integrationId,
    provider_file_id: file.id,
    name: file.name ?? "Sem nome",
    mime_type: file.mimeType ?? null,
    size_bytes: Number(file.size ?? 0),
    web_view_link: file.webViewLink ?? null,
    modified_at: file.modifiedTime ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integration, error } = await admin.from("integrations").select("id,api_token,token_expires_at").eq("user_id", user.id).eq("provider", "google_workspace").eq("is_active", true).maybeSingle();
    if (error || !integration) return json({ error: "Conecte uma conta Google antes de acessar o Drive." }, 409);
    let token = (await getFreshGoogleToken(admin, integration)).accessToken;
    const input = await req.json().catch(() => ({}));
    if (input.action === "list") {
      const driveUrl = new URL("https://www.googleapis.com/drive/v3/files");
      driveUrl.searchParams.set("q", "trashed = false");
      driveUrl.searchParams.set("pageSize", "100");
      driveUrl.searchParams.set("orderBy", "modifiedTime desc");
      driveUrl.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,webViewLink,modifiedTime)");
      const files: any[] = [];
      let pageToken: string | null = null;
      // Keep pagination bounded per request. A very large Drive should not
      // turn opening the integration screen into an unbounded Edge job; the
      // UI still receives a complete first window and can retry for newer
      // files on the next open.
      for (let page = 0; page < 20; page++) {
        if (pageToken) driveUrl.searchParams.set("pageToken", pageToken);
        let response = await fetchGoogle(driveUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) {
          token = (await getFreshGoogleToken(admin, integration, "api_request", true)).accessToken;
          response = await fetchGoogle(driveUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível listar os arquivos do Drive.");
        if (Array.isArray(payload.files)) files.push(...payload.files);
        pageToken = typeof payload.nextPageToken === "string" && payload.nextPageToken ? payload.nextPageToken : null;
        if (!pageToken) break;
      }
      for (let offset = 0; offset < files.length; offset += 100) {
        const batch = files.slice(offset, offset + 100).filter((file) => file?.id).map((file) => driveFileRow(user.id, integration.id, file));
        if (!batch.length) continue;
        const { error: persistError } = await admin.from("google_drive_files").upsert(batch, { onConflict: "integration_id,provider_file_id" });
        if (persistError) throw persistError;
      }
      return json({ files, truncated: Boolean(pageToken) });
    }
    if (input.action === "upload") {
      const name = String(input.name ?? "").trim();
      const mimeType = String(input.mimeType ?? "application/octet-stream");
      const contentBase64 = String(input.contentBase64 ?? "");
      if (!name || !contentBase64) return json({ error: "Escolha um arquivo para enviar." }, 400);
      const bytes = Uint8Array.from(atob(contentBase64), (char) => char.charCodeAt(0));
      if (bytes.byteLength > 10 * 1024 * 1024) return json({ error: "Envie arquivos de até 10 MB por vez." }, 413);
      const boundary = `growdash-${crypto.randomUUID()}`;
      const metadata = JSON.stringify({ name, mimeType });
      const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, bytes, `\r\n--${boundary}--`]);
      const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,modifiedTime";
      let response = await fetchGoogle(uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      if (response.status === 401) { token = (await getFreshGoogleToken(admin, integration, "api_request", true)).accessToken; response = await fetchGoogle(uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }); }
      const file = await response.json().catch(() => ({}));
      if (!response.ok || !file.id) throw new Error(file?.error?.message || "Não foi possível enviar o arquivo ao Drive.");
      await admin.from("google_drive_files").upsert({ user_id: user.id, integration_id: integration.id, provider_file_id: file.id, name: file.name ?? name, mime_type: file.mimeType ?? mimeType, size_bytes: Number(file.size ?? bytes.byteLength), web_view_link: file.webViewLink ?? null, modified_at: file.modifiedTime ?? new Date().toISOString() }, { onConflict: "integration_id,provider_file_id" });
      return json({ file });
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (error) { const failure = googleTokenFailure(error); return json({ error: failure.message, status: failure.status, error_code: failure.errorCode }, failure.status === "reauthorization_required" ? 401 : 500); }
});
