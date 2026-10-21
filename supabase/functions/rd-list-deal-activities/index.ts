import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { resolveRDConnection } from "../_shared/rdConnection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const text = (value: unknown) => String(value ?? "").trim();

function activityList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function isNote(activity: any) {
  const type = text(activity?.type || activity?.activity_type || activity?.event_type).toLowerCase();
  return !type || type.includes("note") || type.includes("anota") || type === "text";
}

function normalizeActivity(activity: any, index: number) {
  const body = text(activity?.description || activity?.body || activity?.content || activity?.text || activity?.note);
  const createdAt = text(activity?.created_at || activity?.createdAt || activity?.date || activity?.event_at || activity?.timestamp);
  const author = activity?.user || activity?.author || activity?.owner || {};
  return {
    id: text(activity?.id || activity?.uuid || activity?.activity_id) || `rd-activity-${index}`,
    rd_deal_id: text(activity?.deal_id || activity?.rd_deal_id),
    author_id: text(author?.id || activity?.user_id || activity?.author_id),
    author_name: text(author?.name || author?.full_name || activity?.user_name || activity?.author_name) || "RD Station",
    body,
    created_at: createdAt || new Date(0).toISOString(),
    source: "rd" as const,
    activity_type: text(activity?.type || activity?.activity_type || activity?.event_type) || "note",
  };
}

async function listActivities(token: string, dealId: string) {
  const pageSize = 100;
  const result: any[] = [];
  let page = 1;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const url = new URL("https://crm.rdstation.com/api/v1/activities");
    url.searchParams.set("token", token);
    url.searchParams.set("deal_id", dealId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`RD activities HTTP ${response.status}`);
    const rows = activityList(payload);
    result.push(...rows);
    const meta = payload?.meta || payload?.pagination || payload?.paging || {};
    const hasMore = meta?.has_more === true || meta?.hasNext === true || Boolean(meta?.next_page);
    if (!rows.length || (!hasMore && rows.length < pageSize)) break;
    page += 1;
  }
  return result;
}

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
    const connectionId = text(body?.rd_connection_id);
    const rdDealId = text(body?.rd_deal_id);
    if (!connectionId || !rdDealId) return json({ error: "rd_connection_id e rd_deal_id são obrigatórios" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const connection = await resolveRDConnection(admin, { connectionId });
    let allowed = connection.user_id === userId;
    if (!allowed && connection.workspace_id) {
      const { data: manager } = await admin.rpc("can_manage_workspace", { _workspace_id: connection.workspace_id, _user_id: userId });
      allowed = manager === true;
    }
    if (!allowed) return json({ error: "Usuário sem acesso a esta conexão RD" }, 403);
    const { data: deal, error: dealError } = await admin.from("rd_deals").select("id,rd_deal_id,rd_connection_id,user_id").eq("rd_connection_id", connectionId).eq("rd_deal_id", rdDealId).maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada na conexão RD selecionada" }, 404);
    const activities = (await listActivities(connection.api_token!, rdDealId)).filter(isNote).map(normalizeActivity);
    return json({ ok: true, deal_id: deal.id, activities });
  } catch (error) {
    console.error("rd-list-deal-activities", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 502);
  }
});
