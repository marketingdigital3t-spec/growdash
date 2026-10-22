import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-workflow-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const MAX_BODY = 256 * 1024;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const token = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  if (!token || token.length < 24) return json({ error: "Webhook inválido" }, 404);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: hook } = await admin.from("growdash_workflow_webhooks").select("workflow_id,workspace_id,secret_hash,status").eq("path_token", token).maybeSingle();
  if (!hook || hook.status !== "active") return json({ error: "Webhook não encontrado ou pausado" }, 404);
  // An active public webhook must always be authenticated. A nullable hash is
  // kept in the schema for legacy rows, but it must never become an anonymous
  // execution path.
  if (!hook.secret_hash) return json({ error: "Webhook sem segredo configurado" }, 503);
  const supplied = req.headers.get("x-workflow-secret") || "";
  if (!supplied || (await sha256(supplied)) !== hook.secret_hash) return json({ error: "Secret inválido" }, 401);
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY) return json({ error: "Payload excede o limite de 256 KB." }, 413);
  const payload = rawBody ? await (async () => { try { return JSON.parse(rawBody); } catch { return null; } })() : {};
  if (payload === null) return json({ error: "Payload JSON inválido." }, 400);
  await admin.from("growdash_workflow_webhooks").update({ last_received_at: new Date().toISOString() }).eq("workflow_id", hook.workflow_id).eq("path_token", token);
  const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") ?? "";
  if (internalSecret.length < 24) return json({ error: "AUTOMATION_INTERNAL_SECRET não configurado" }, 503);
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/workflow-execute`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": internalSecret }, body: JSON.stringify({ workflow_id: hook.workflow_id, input: payload, idempotency_key: req.headers.get("x-idempotency-key") || payload?.id || payload?.leadgen_id || crypto.randomUUID(), mode: "webhook" }) });
  const result = await response.json().catch(() => ({}));
  return json(result, response.status);
});
