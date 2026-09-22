import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { resolveRDConnection } from "../_shared/rdConnection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);

    const body = await req.json().catch(() => ({}));
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : null;
    const accountName = typeof body?.account_name === "string" && body.account_name.trim()
      ? body.account_name.trim()
      : "RD Station";
    const externalAccountId = typeof body?.external_account_id === "string" && body.external_account_id.trim()
      ? body.external_account_id.trim()
      : `rd:${userId}:${accountName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
    let existingQuery = admin
      .from("rd_account_connections")
      .select("id, api_token, status, permissions, webhook_secret")
      .eq("user_id", userId);
    if (connectionId) existingQuery = existingQuery.eq("id", connectionId);
    else existingQuery = existingQuery.eq("external_account_id", externalAccountId);
    const { data: existing } = await existingQuery.maybeSingle();

    if (body?.disconnect === true) {
      if (existing?.id) {
        if (body?.delete === true) {
          const { error } = await admin.from("rd_account_connections").delete().eq("id", existing.id).eq("user_id", userId);
          if (error) throw error;
          return json({ ok: true, connected: false, deleted: true });
        }
        const { error } = await admin
          .from("rd_account_connections")
          .update({ api_token: null, status: "blocked", last_error: "Desconectado manualmente", updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      }
      return json({ ok: true, connected: false });
    }

    const suppliedToken = typeof body?.api_token === "string" ? body.api_token.trim() : "";
    const token = suppliedToken || (existing?.status === "connected" ? String(existing.api_token ?? "") : "");
    if (!token) return json({ error: "RD Station CRM não conectado. Informe um token válido." }, 400);

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(
        `https://crm.rdstation.com/api/v1/deal_pipelines/?token=${encodeURIComponent(token)}&limit=1`,
        { headers: { Accept: "application/json" } },
      );
      if (response.status !== 429) break;
      await response.text();
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }

    const rateLimited = response?.status === 429;
    if (!response || (!response.ok && !rateLimited)) {
      const status = response?.status ?? 502;
      if (existing?.id && (status === 401 || status === 403)) {
        await admin.from("rd_account_connections").update({ status: "blocked", last_error: `RD API HTTP ${status}`, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", existing.id);
      }
      return json({
        error: `Token inválido ou sem permissão no RD Station (HTTP ${status}).`,
        connected: false,
      }, 400);
    }

    let webhookWarning: string | undefined;
    const webhookSecret = existing?.webhook_secret || crypto.randomUUID();
    if (suppliedToken) {
      const values = {
        api_token: suppliedToken,
        status: "connected",
        account_name: accountName,
        external_account_id: externalAccountId,
        last_attempt_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
        permissions: ["deal_pipelines", "deals"],
        webhook_secret: webhookSecret,
        updated_at: new Date().toISOString(),
      };
      const operation = existing?.id
        ? admin.from("rd_account_connections").update(values).eq("id", existing.id)
        : admin.from("rd_account_connections").insert({
            user_id: userId,
            ...values,
          });
      const { error } = await operation;
      if (error) throw error;
    }

    try {
      await ensureRDWebhooks(token, webhookSecret);
    } catch (error) {
      // O polling incremental de 15 min continua funcionando mesmo quando o
      // plano do RD não permite webhooks ou a API limita a configuração.
      webhookWarning = error instanceof Error ? error.message : "Não foi possível ativar os webhooks do RD.";
    }

    return json({
      ok: true,
      connected: true,
      warning: [
        rateLimited ? "Token aceito e salvo, mas o RD Station limitou temporariamente as requisições." : null,
        webhookWarning,
      ].filter(Boolean).join(" ") || undefined,
    });
  } catch (error) {
    console.error("rd-test-connection", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

async function ensureRDWebhooks(token: string, secret: string) {
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/sync-rd-crm`;
  const listResponse = await fetch(
    `https://crm.rdstation.com/api/v1/webhooks?token=${encodeURIComponent(token)}`,
    { headers: { Accept: "application/json" } },
  );
  const listPayload = listResponse.ok ? await listResponse.json().catch(() => ({})) : {};
  const existing = Array.isArray(listPayload)
    ? listPayload
    : (listPayload.webhooks || listPayload.data || []);
  const events = ["crm_deal_created", "crm_deal_updated", "crm_deal_deleted"];

  for (const eventType of events) {
    const configured = existing.find((webhook: any) =>
      String(webhook.event_type || webhook.event_name) === eventType && String(webhook.url) === callbackUrl
    );
    const webhookId = configured?.uuid || configured?.id;
    const endpoint = webhookId
      ? `https://crm.rdstation.com/api/v1/webhooks/${encodeURIComponent(String(webhookId))}?token=${encodeURIComponent(token)}`
      : `https://crm.rdstation.com/api/v1/webhooks?token=${encodeURIComponent(token)}`;
    const response = await fetch(
      endpoint,
      {
        method: webhookId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          http_method: "POST",
          url: callbackUrl,
          auth_header: "x-webhook-secret",
          auth_key: secret,
        }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`RD webhook ${eventType}: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
    }
  }
}
