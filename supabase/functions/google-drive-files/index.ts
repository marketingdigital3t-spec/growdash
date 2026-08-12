import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type GoogleToken = { access_token: string; refresh_token?: string | null };

async function freshToken(admin: ReturnType<typeof createClient>, integration: any) {
  const saved = JSON.parse(String(integration.api_token || "{}")) as GoogleToken;
  if (!saved.access_token) throw new Error("A credencial Google está incompleta. Conecte a conta novamente.");
  if (integration.token_expires_at && new Date(integration.token_expires_at).getTime() > Date.now() + 60_000) return saved.access_token;
  if (!saved.refresh_token) throw new Error("A autorização Google expirou. Conecte a conta novamente.");
  const body = new URLSearchParams({ client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "", client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "", refresh_token: saved.refresh_token, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const next = await response.json().catch(() => ({}));
  if (!response.ok || !next.access_token) throw new Error("O Google recusou a renovação da autorização. Conecte a conta novamente.");
  saved.access_token = next.access_token;
  await admin.from("integrations").update({ api_token: JSON.stringify(saved), token_expires_at: new Date(Date.now() + Number(next.expires_in ?? 3600) * 1000).toISOString() }).eq("id", integration.id);
  return saved.access_token;
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
    const token = await freshToken(admin, integration);
    const input = await req.json().catch(() => ({}));
    if (input.action === "list") {
      const driveUrl = new URL("https://www.googleapis.com/drive/v3/files");
      driveUrl.searchParams.set("q", "trashed = false");
      driveUrl.searchParams.set("pageSize", "100");
      driveUrl.searchParams.set("orderBy", "modifiedTime desc");
      driveUrl.searchParams.set("fields", "files(id,name,mimeType,size,webViewLink,modifiedTime)");
      const response = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível listar os arquivos do Drive.");
      const files = Array.isArray(payload.files) ? payload.files : [];
      for (const file of files) await admin.from("google_drive_files").upsert({ user_id: user.id, integration_id: integration.id, provider_file_id: file.id, name: file.name ?? "Sem nome", mime_type: file.mimeType ?? null, size_bytes: Number(file.size ?? 0), web_view_link: file.webViewLink ?? null, modified_at: file.modifiedTime ?? null }, { onConflict: "integration_id,provider_file_id" });
      return json({ files });
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
      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,modifiedTime", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      const file = await response.json().catch(() => ({}));
      if (!response.ok || !file.id) throw new Error(file?.error?.message || "Não foi possível enviar o arquivo ao Drive.");
      await admin.from("google_drive_files").upsert({ user_id: user.id, integration_id: integration.id, provider_file_id: file.id, name: file.name ?? name, mime_type: file.mimeType ?? mimeType, size_bytes: Number(file.size ?? bytes.byteLength), web_view_link: file.webViewLink ?? null, modified_at: file.modifiedTime ?? new Date().toISOString() }, { onConflict: "integration_id,provider_file_id" });
      return json({ file });
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500); }
});
