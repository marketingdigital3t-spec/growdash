import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { executeRDWrite, RDWriteError } from "../_shared/rdWrite.ts";

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
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : "";
    const rdDealId = typeof body?.rd_deal_id === "string" ? body.rd_deal_id : "";
    const destinationStageId = typeof body?.deal_stage_id === "string" ? body.deal_stage_id : "";
    const destinationFunnelId = typeof body?.destination_rd_funnel_id === "string" ? body.destination_rd_funnel_id : "";
    const correlationId = typeof body?.correlation_id === "string" && body.correlation_id ? body.correlation_id : crypto.randomUUID();
    if (!connectionId || !rdDealId || !destinationStageId) {
      return json({ error: "rd_connection_id, rd_deal_id e deal_stage_id são obrigatórios" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: deal, error: dealError } = await admin
      .from("rd_deals")
      .select("id,user_id,ad_account_id,rd_connection_id,rd_funnel_id,rd_deal_id,rd_stage_id,rd_stage_name,rd_stage_order,stage_bucket,win,lost_reason,stage_updated_at")
      .eq("rd_connection_id", connectionId)
      .eq("rd_deal_id", rdDealId)
      .maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada na conexão RD selecionada" }, 404);

    const targetFunnelId = destinationFunnelId || deal.rd_funnel_id;
    const { data: destinationFunnel, error: destinationFunnelError } = await admin
      .from("rd_funnels")
      .select("id,rd_connection_id,rd_funnel_id,name,ad_account_id,is_active")
      .eq("id", targetFunnelId)
      .eq("rd_connection_id", connectionId)
      .eq("is_active", true)
      .maybeSingle();
    if (destinationFunnelError) throw destinationFunnelError;
    if (!destinationFunnel) return json({ error: "O pipeline destino não pertence à conexão RD selecionada" }, 422);
    if (destinationFunnel.ad_account_id && deal.ad_account_id && destinationFunnel.ad_account_id !== deal.ad_account_id) {
      return json({ error: "O pipeline destino pertence a outra conta Meta; selecione um pipeline da mesma conta." }, 422);
    }

    const { data: stage, error: stageError } = await admin
      .from("rd_funnel_stages")
      .select("rd_funnel_id,rd_stage_id,name,order,is_won,is_lost")
      .eq("rd_funnel_id", targetFunnelId)
      .eq("rd_stage_id", destinationStageId)
      .maybeSingle();
    if (stageError) throw stageError;
    if (!stage) return json({ error: "A etapa destino não pertence ao pipeline selecionado" }, 422);

    const funnelChanged = String(deal.rd_funnel_id || "") !== targetFunnelId;
    const stageChanged = String(deal.rd_stage_id || "") !== destinationStageId || funnelChanged;
    if (!stageChanged) {
      return json({ ok: true, noop: true, reason: "A negociação já está nesta etapa", deal_id: deal.id });
    }

    const win = stage.is_won === true;
    const lost = stage.is_lost === true;
    const stageBucket = win ? "client" : lost ? "lost" : "opportunity";
    const before = {
      rd_stage_id: deal.rd_stage_id,
      rd_stage_name: deal.rd_stage_name,
      rd_stage_order: deal.rd_stage_order,
      rd_funnel_id: deal.rd_funnel_id,
      stage_bucket: deal.stage_bucket,
      win: deal.win,
      lost_reason: deal.lost_reason,
    };
    const after = {
      rd_stage_id: destinationStageId,
      rd_stage_name: stage.name,
      rd_stage_order: stage.order,
      rd_funnel_id: targetFunnelId,
      rd_funnel_name: destinationFunnel.name,
      stage_bucket: stageBucket,
      win,
      lost_reason: lost ? deal.lost_reason : null,
    };

    const result = await executeRDWrite({
      admin,
      userId,
      connectionId,
      action: "move_stage",
      target: { rd_deal_id: rdDealId, from_rd_funnel_id: deal.rd_funnel_id, to_rd_funnel_id: targetFunnelId, deal_stage_id: destinationStageId },
      before,
      after,
      correlationId,
      method: "PUT",
      path: `/deals/${encodeURIComponent(rdDealId)}`,
      body: { deal_stage_id: destinationStageId },
    });

    const now = new Date().toISOString();
    const { error: mirrorError } = await admin
      .from("rd_deals")
      .update({
        rd_stage_id: destinationStageId,
        rd_stage_name: stage.name,
        rd_stage_order: stage.order,
        rd_funnel_id: targetFunnelId,
        stage_bucket: stageBucket,
        win,
        lost_reason: lost ? deal.lost_reason : null,
        stage_updated_at: now,
        updated_at: now,
      })
      .eq("id", deal.id)
      .eq("rd_connection_id", connectionId);
    if (mirrorError) {
      console.error("rd-move-deal mirror update failed", mirrorError);
      return json({ ok: true, partial: true, audit_id: result.auditId, error: "O RD foi atualizado, mas o espelho local aguarda reconciliação." }, 202);
    }
    return json({ ok: true, audit_id: result.auditId, skipped: result.skipped, deal_id: deal.id, stage: after, funnel_changed: funnelChanged });
  } catch (error) {
    if (error instanceof RDWriteError) return json({ error: error.message, code: error.code }, error.status);
    console.error("rd-move-deal", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
