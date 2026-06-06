import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  rd_deal_id?: string;
  rd_funnel_id?: string;
  patch?: {
    stage_id?: string;
    stage_name?: string;
  };
};

type StageRow = {
  rd_stage_id: string;
  name: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);

    const body = await req.json() as Body;
    const rdDealId = String(body.rd_deal_id || "").trim();
    if (!rdDealId) return json({ error: "rd_deal_id obrigatório" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: deal, error: dealError } = await admin
      .from("rd_deals")
      .select("id, rd_deal_id, rd_funnel_id, user_id")
      .eq("user_id", userId)
      .eq("rd_deal_id", rdDealId)
      .maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada para este usuário" }, 404);

    const { data: integration } = await admin
      .from("integrations")
      .select("api_token")
      .eq("user_id", userId)
      .eq("provider", "rd_station_crm")
      .eq("is_active", true)
      .maybeSingle();
    if (!integration?.api_token) {
      return json({ error: "RD Station CRM não conectado. Configure o token nas Configurações." }, 400);
    }

    const patch = body.patch || {};
    let stage: StageRow | null = null;

    if (patch.stage_id || patch.stage_name) {
      let stageQuery = admin
        .from("rd_funnel_stages")
        .select("rd_stage_id, name, order, is_won, is_lost")
        .eq("user_id", userId)
        .eq("rd_funnel_id", deal.rd_funnel_id);

      if (patch.stage_id) stageQuery = stageQuery.eq("rd_stage_id", patch.stage_id);
      if (!patch.stage_id && patch.stage_name) stageQuery = stageQuery.eq("name", patch.stage_name);

      const { data: stageRow, error: stageError } = await stageQuery.maybeSingle();
      if (stageError) throw stageError;
      if (!stageRow) return json({ error: "Etapa RD não encontrada. Sincronize os estágios do funil antes de editar." }, 400);
      stage = stageRow as StageRow;
    }

    if (!stage) return json({ error: "Nenhuma alteração suportada enviada" }, 400);

    const rdPayload = { deal: { deal_stage_id: stage.rd_stage_id } };
    const rdUrl = `https://crm.rdstation.com/api/v1/deals/${encodeURIComponent(rdDealId)}?token=${encodeURIComponent(integration.api_token)}`;

    let rdResponse = await fetch(rdUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rdPayload),
    });

    if (!rdResponse.ok && rdResponse.status === 404) {
      rdResponse = await fetch(rdUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rdPayload),
      });
    }

    if (!rdResponse.ok) {
      const txt = await rdResponse.text();
      return json({ error: `RD API ${rdResponse.status}: ${txt.slice(0, 300)}` }, 502);
    }

    await admin.from("rd_deals").update({
      rd_stage_id: stage.rd_stage_id,
      rd_stage_name: stage.name,
      rd_stage_order: stage.order,
      stage_bucket: stage.is_won ? "client" : stage.is_lost ? "lost" : "opportunity",
      win: stage.is_won,
      lost_reason: stage.is_lost ? "Atualizado pela plataforma" : null,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", deal.id);

    return json({ ok: true, rd_deal_id: rdDealId, stage });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
