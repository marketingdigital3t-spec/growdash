import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { executeRDWrite, RDWriteError } from "../_shared/rdWrite.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const user = userRes.user;
    if (!user) return json({ error: "Usuário inválido" }, 401);

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : "";
    const rdDealId = typeof body?.rd_deal_id === "string" ? body.rd_deal_id : "";
    const noteBody = typeof body?.body === "string" ? body.body.trim() : "";
    const correlationId = typeof body?.correlation_id === "string" && body.correlation_id ? body.correlation_id : crypto.randomUUID();
    if (!connectionId || !rdDealId || !noteBody) return json({ error: "rd_connection_id, rd_deal_id e body são obrigatórios" }, 400);
    if (noteBody.length > 4000) return json({ error: "A anotação deve ter no máximo 4.000 caracteres" }, 422);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: deal, error: dealError } = await admin
      .from("rd_deals")
      .select("id,rd_connection_id,rd_deal_id,rd_funnel_id")
      .eq("rd_connection_id", connectionId)
      .eq("rd_deal_id", rdDealId)
      .maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada na conexão RD selecionada" }, 404);

    const { data: profile } = await admin.from("profiles").select("full_name,email").eq("user_id", user.id).maybeSingle();
    const authorName = String(profile?.full_name || profile?.email || user.email || "Usuário Growdash").trim();
    const result = await executeRDWrite({
      admin,
      userId: user.id,
      connectionId,
      action: "add_note",
      target: { rd_deal_id: rdDealId, rd_funnel_id: deal.rd_funnel_id },
      before: {},
      after: { body: noteBody, author_name: authorName },
      correlationId,
      method: "POST",
      path: "/activities",
      body: { deal_id: rdDealId, type: "note", description: noteBody },
    });

    if (!result.skipped) {
      const { error: noteError } = await admin.from("rd_deal_notes").insert({
        rd_deal_id: deal.id,
        author_id: user.id,
        author_name: authorName,
        body: noteBody,
      });
      if (noteError) {
        console.error("rd-add-deal-note local mirror failed", noteError);
        return json({ ok: true, partial: true, audit_id: result.auditId, error: "A anotação foi enviada ao RD, mas o histórico local aguarda reconciliação." }, 202);
      }
    }
    return json({ ok: true, skipped: result.skipped, audit_id: result.auditId, deal_id: deal.id });
  } catch (error) {
    if (error instanceof RDWriteError) return json({ error: error.message, code: error.code }, error.status);
    console.error("rd-add-deal-note", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
