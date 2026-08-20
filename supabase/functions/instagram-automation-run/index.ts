import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeWebhookUrl(value: unknown) {
  const url = new URL(String(value ?? ""));
  if (url.protocol !== "https:") throw new Error("O webhook precisa usar HTTPS.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("O webhook deve apontar para um host público.");
  }
  return url;
}

async function graphRequest(url: URL, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message ?? `Instagram HTTP ${response.status}`);
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") ?? "";
    const internalCall = internalSecret.length >= 24 && req.headers.get("x-growdash-automation-secret") === internalSecret;
    let user: { id: string } | null = null;
    if (!internalCall) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const authResult = await userClient.auth.getUser();
      user = authResult.data.user;
      if (!user) return json({ error: "Sessão inválida" }, 401);
    }
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const automationId = String(body?.automation_id ?? "");
    const dryRun = body?.dry_run === true;
    const triggerEvent = body?.trigger_event && typeof body.trigger_event === "object" ? body.trigger_event : {};
    if (!automationId) return json({ error: "Automação não informada" }, 400);

    const { data: automation, error: automationError } = await admin.from("growdash_automations").select("*").eq("id", automationId).maybeSingle();
    if (automationError) throw automationError;
    if (!automation) return json({ error: "Automação não encontrada" }, 404);
    if (!internalCall) {
      const { data: membership } = await admin.from("workspace_members").select("role,status").eq("workspace_id", automation.workspace_id).eq("user_id", user!.id).eq("status", "active").maybeSingle();
      const { data: master } = await admin.rpc("is_master", { _user_id: user!.id });
      if ((!membership || !["owner", "admin", "analyst", "financial"].includes(String(membership.role))) && !master) return json({ error: "Você não tem permissão para executar esta automação" }, 403);
    }
    if (!dryRun && automation.status !== "active") return json({ error: "A automação precisa estar ativa" }, 409);

    const actions = Array.isArray(automation.actions) ? automation.actions : [];
    const executed: Array<Record<string, unknown>> = [];
    let runStatus: "success" | "partial" | "error" = "success";
    let errorMessage: string | null = null;
    for (const action of actions) {
      try {
        const type = String(action?.type ?? "");
        if (dryRun) {
          if (type === "webhook") safeWebhookUrl(action.url);
          if (type === "instagram_reply" && !String(action.message ?? "").trim()) throw new Error("A resposta do Instagram está vazia.");
          executed.push({ type, status: "validated", dry_run: true });
          continue;
        }
        if (type === "audit_only") {
          executed.push({ type, status: "recorded" });
          continue;
        }
        if (type === "webhook") {
          const url = safeWebhookUrl(action.url);
          const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Growdash-Automation/1.0" }, body: JSON.stringify({ automation_id: automation.id, workspace_id: automation.workspace_id, trigger: triggerEvent }) });
          if (!response.ok) throw new Error(`Webhook respondeu HTTP ${response.status}`);
          executed.push({ type, status: "sent", host: url.host });
          continue;
        }
        if (type === "instagram_reply") {
          const socialAccountId = String(automation.trigger_config?.social_account_id ?? "");
          const { data: account } = await admin.from("social_accounts").select("id,user_id,provider_account_id").eq("id", socialAccountId).maybeSingle();
          if (!account) throw new Error("Perfil do Instagram não encontrado.");
          const { data: integration } = await admin.from("integrations").select("api_token,is_active,token_expires_at").eq("user_id", account.user_id).eq("provider", "instagram_business").eq("provider_account_id", account.provider_account_id).maybeSingle();
          if (!integration?.is_active || !integration.api_token) throw new Error("Reconecte o Instagram antes de enviar respostas.");
          if (integration.token_expires_at && new Date(integration.token_expires_at).getTime() <= Date.now()) throw new Error("O token do Instagram expirou.");
          const version = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") ?? "v25.0";
          const message = String(action.message ?? "").trim();
          if (automation.trigger_type === "instagram_comment") {
            const commentId = String(triggerEvent.comment_id ?? triggerEvent.id ?? "");
            if (!commentId) throw new Error("O evento não contém comment_id.");
            const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(commentId)}/replies`);
            const form = new URLSearchParams({ message, access_token: String(integration.api_token) });
            await graphRequest(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
            executed.push({ type, status: "sent", target: "comment" });
          } else if (automation.trigger_type === "instagram_message") {
            const recipientId = String(triggerEvent.sender_id ?? triggerEvent.recipient_id ?? "");
            if (!recipientId) throw new Error("O evento não contém sender_id.");
            const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(account.provider_account_id)}/messages`);
            url.searchParams.set("access_token", String(integration.api_token));
            await graphRequest(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }) });
            executed.push({ type, status: "sent", target: "message" });
          } else {
            throw new Error("Resposta Instagram exige gatilho de comentário ou mensagem.");
          }
          continue;
        }
        throw new Error(`Ação não suportada: ${type || "sem tipo"}`);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Falha ao executar ação";
        executed.push({ type: String(action?.type ?? "unknown"), status: "error", error: errorMessage });
        runStatus = executed.some((item) => item.status !== "error") ? "partial" : "error";
      }
    }

    await admin.from("growdash_automation_runs").insert({ automation_id: automation.id, workspace_id: automation.workspace_id, trigger_event: triggerEvent, actions_executed: executed, status: runStatus, error_message: errorMessage });
    await admin.from("growdash_automations").update({ run_count: Number(automation.run_count || 0) + 1, last_run_at: new Date().toISOString(), last_error: errorMessage, status: runStatus === "error" && !dryRun ? "error" : automation.status }).eq("id", automation.id);
    return json({ ok: runStatus !== "error", status: runStatus, actions_executed: executed, error: runStatus === "error" ? errorMessage : undefined }, runStatus === "error" ? 422 : 200);
  } catch (error) {
    console.error("instagram-automation-run", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
