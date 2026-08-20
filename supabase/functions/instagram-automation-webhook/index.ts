import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function validSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const expected = header.replace(/^sha256=/, "");
  const bytes = new Uint8Array(expected.match(/.{1,2}/g)?.map((pair) => parseInt(pair, 16)) ?? []);
  return bytes.length === 32 && await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(rawBody));
}

type IncomingEvent = { type: "instagram_comment" | "instagram_message"; id?: string; comment_id?: string; sender_id?: string; text?: string; media_id?: string; raw: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const verifyToken = Deno.env.get("INSTAGRAM_WEBHOOK_VERIFY_TOKEN") ?? "";
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("hub.verify_token") !== verifyToken || !verifyToken) return new Response("Forbidden", { status: 403 });
    return new Response(url.searchParams.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
  }
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const rawBody = await req.text();
  if (!(await validSignature(rawBody, req.headers.get("x-hub-signature-256"), Deno.env.get("META_APP_SECRET") ?? Deno.env.get("INSTAGRAM_APP_SECRET") ?? ""))) return json({ error: "Assinatura inválida" }, 401);
  try {
    const payload = JSON.parse(rawBody);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const runUrl = `${supabaseUrl}/functions/v1/instagram-automation-run`;
    const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") ?? "";
    if (internalSecret.length < 24) return json({ error: "AUTOMATION_INTERNAL_SECRET não configurado" }, 503);
    const results: Array<Record<string, unknown>> = [];
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      const providerAccountId = String(entry?.id ?? "");
      const { data: account } = await admin.from("social_accounts").select("id,workspace_id,provider_account_id").eq("provider", "instagram").eq("provider_account_id", providerAccountId).maybeSingle();
      if (!account?.workspace_id) continue;
      const incoming: IncomingEvent[] = [];
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field !== "comments") continue;
        const value = change.value ?? {};
        incoming.push({ type: "instagram_comment", id: String(value.id ?? ""), comment_id: String(value.id ?? ""), text: String(value.text ?? ""), media_id: String(value.media?.id ?? ""), raw: value });
      }
      for (const message of Array.isArray(entry?.messaging) ? entry.messaging : []) {
        incoming.push({ type: "instagram_message", id: String(message.message?.mid ?? ""), sender_id: String(message.sender?.id ?? ""), text: String(message.message?.text ?? ""), raw: message });
      }
      if (!incoming.length) continue;
      const { data: automations } = await admin.from("growdash_automations").select("id,name,trigger_type,trigger_config").eq("workspace_id", account.workspace_id).eq("status", "active");
      for (const event of incoming) {
        for (const automation of automations ?? []) {
          if (automation.trigger_type !== event.type) continue;
          const config = automation.trigger_config ?? {};
          if (config.social_account_id && config.social_account_id !== account.id) continue;
          const keyword = String(config.keyword ?? "").trim().toLocaleLowerCase("pt-BR");
          if (keyword && !String(event.text ?? "").toLocaleLowerCase("pt-BR").includes(keyword)) continue;
          const response = await fetch(runUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": internalSecret }, body: JSON.stringify({ automation_id: automation.id, trigger_event: { ...event, social_account_id: account.id, provider_account_id: providerAccountId }, dry_run: false }) });
          const data = await response.json().catch(() => ({}));
          results.push({ automation_id: automation.id, automation_name: automation.name, event: event.type, status: response.ok ? "processed" : "failed", detail: data?.error ?? null });
        }
      }
    }
    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("instagram-automation-webhook", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
