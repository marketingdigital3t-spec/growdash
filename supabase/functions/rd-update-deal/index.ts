import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { executeRDWrite, RDWriteError } from "../_shared/rdWrite.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED_FIELDS = new Set([
  "name",
  "amount",
  "deal_lost_note",
  "deal_lost_reason_id",
  "hold",
  "prediction_date",
  "rating",
  "organization_id",
  "user_id",
  "win",
  "deal_custom_fields",
]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);
    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : "";
    const rdDealId = typeof body?.rd_deal_id === "string" ? body.rd_deal_id : "";
    const rawFields = body?.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields as Record<string, unknown> : null;
    const confirmLoss = body?.confirm_loss === true;
    const fields = rawFields ? Object.fromEntries(Object.entries(rawFields).filter(([key]) => key !== "confirm_loss")) : null;
    const correlationId = typeof body?.correlation_id === "string" && body.correlation_id ? body.correlation_id : crypto.randomUUID();
    if (!connectionId || !rdDealId || !fields || !Object.keys(fields).length) return json({ error: "rd_connection_id, rd_deal_id e fields são obrigatórios" }, 400);
    const unknown = Object.keys(fields).filter((field) => !ALLOWED_FIELDS.has(field));
    if (unknown.length) return json({ error: `Campos não permitidos: ${unknown.join(", ")}`, code: "RD_DEAL_FIELD_NOT_ALLOWED" }, 422);
    if ("name" in fields && (typeof fields.name !== "string" || fields.name.trim().length === 0)) return json({ error: "name deve ser um texto não vazio" }, 422);
    if ("amount" in fields && (typeof fields.amount !== "number" || !Number.isFinite(fields.amount) || fields.amount < 0)) return json({ error: "amount deve ser um número maior ou igual a zero" }, 422);
    if ("win" in fields && fields.win !== null && typeof fields.win !== "boolean") return json({ error: "win deve ser booleano ou nulo" }, 422);
    if ("hold" in fields && fields.hold !== null && typeof fields.hold !== "boolean") return json({ error: "hold deve ser booleano ou nulo" }, 422);
    if ("rating" in fields && fields.rating !== null && (typeof fields.rating !== "number" || fields.rating < 0 || fields.rating > 5)) return json({ error: "rating deve estar entre 0 e 5" }, 422);
    if ("prediction_date" in fields && fields.prediction_date !== null && (typeof fields.prediction_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fields.prediction_date))) return json({ error: "prediction_date deve estar no formato AAAA-MM-DD" }, 422);
    if ("deal_custom_fields" in fields && fields.deal_custom_fields !== null && !Array.isArray(fields.deal_custom_fields)) return json({ error: "deal_custom_fields deve ser uma lista" }, 422);
    if ("organization_id" in fields && fields.organization_id !== null && typeof fields.organization_id !== "string") return json({ error: "organization_id deve ser texto ou nulo" }, 422);
    if ("user_id" in fields && fields.user_id !== null && typeof fields.user_id !== "string") return json({ error: "user_id deve ser texto ou nulo" }, 422);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (fields.win === false && !confirmLoss) return json({ error: "Para marcar a negociação como perdida, confirme explicitamente a perda.", code: "RD_LOSS_CONFIRMATION_REQUIRED" }, 422);
    const { data: deal, error: dealError } = await admin.from("rd_deals")
      .select("id,rd_connection_id,rd_deal_id,raw,win,lost_reason,stage_bucket")
      .eq("rd_connection_id", connectionId).eq("rd_deal_id", rdDealId).maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada na conexão RD selecionada" }, 404);
    const raw = deal.raw && typeof deal.raw === "object" ? deal.raw as Record<string, any> : {};
    const before = raw.deal && typeof raw.deal === "object" ? { ...raw.deal } : { win: deal.win, lost_reason: deal.lost_reason };
    const after = { ...before, ...fields };
    if (JSON.stringify(before) === JSON.stringify(after)) return json({ ok: true, noop: true, deal_id: deal.id });

    const result = await executeRDWrite({
      admin,
      userId,
      connectionId,
      action: "update_deal",
      target: { rd_deal_id: rdDealId },
      before,
      after,
      correlationId,
      method: "PUT",
      path: `/deals/${encodeURIComponent(rdDealId)}`,
      body: { deal: fields },
    });
    const nextRaw = { ...raw, deal: after };
    const update: Record<string, unknown> = { raw: nextRaw, updated_at: new Date().toISOString() };
    if (typeof fields.amount === "number") update.amount_total = fields.amount;
    if (typeof fields.win === "boolean") update.win = fields.win;
    const { error: mirrorError } = await admin.from("rd_deals").update(update).eq("id", deal.id).eq("rd_connection_id", connectionId);
    if (mirrorError) return json({ ok: true, partial: true, audit_id: result.auditId, error: "O RD foi atualizado, mas o espelho local aguarda reconciliação." }, 202);
    return json({ ok: true, audit_id: result.auditId, skipped: result.skipped, deal_id: deal.id, fields: after });
  } catch (error) {
    if (error instanceof RDWriteError) return json({ error: error.message, code: error.code }, error.status);
    console.error("rd-update-deal", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
