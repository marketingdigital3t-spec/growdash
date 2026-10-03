import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const DIRECTOR_ROLES = new Set(["ceo", "marketing", "commercial", "finance", "legal"]);

function dateKey(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function authenticate(req: Request, url: string, serviceKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization) return null;
  const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: authorization } } });
  const { data } = await client.auth.getUser();
  return data.user || null;
}

async function callModel(messages: Array<{ role: string; content: string }>) {
  const key = Deno.env.get("AI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  if (!key) return { content: "A IA dos agentes ainda não está configurada no backend. A conversa foi registrada e ficará disponível para processamento quando a chave for habilitada.", configured: false };
  const response = await fetch(Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: Deno.env.get("AI_MODEL") || "gpt-4.1-mini", temperature: 0.2, messages }),
  });
  if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`);
  const payload = await response.json();
  return { content: String(payload.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta agora."), configured: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const user = await authenticate(req, url, serviceKey);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const role = typeof body?.agent_role === "string" ? body.agent_role : "ceo";
    if (!DIRECTOR_ROLES.has(role)) return json({ error: "AGENT_ROLE_NOT_ALLOWED" }, 400);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return json({ error: "QUESTION_REQUIRED" }, 400);
    const startDate = dateKey(body?.scope?.startDate);
    const endDate = dateKey(body?.scope?.endDate);
    const accountIds = Array.isArray(body?.scope?.accountIds) ? body.scope.accountIds.filter((id: unknown) => typeof id === "string") : [];
    const funnelIds = Array.isArray(body?.scope?.funnelIds) ? body.scope.funnelIds.filter((id: unknown) => typeof id === "string") : [];
    const admin = createClient(url, serviceKey);
    const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("id,name,timezone").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
    if (workspaceError || !workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
    const { data: agent, error: agentError } = await admin.from("agent_office_agents").select("id,name,role,department").eq("workspace_id", workspace.id).eq("role", role).eq("is_visible", true).maybeSingle();
    if (agentError || !agent) return json({ error: "AGENT_NOT_FOUND" }, 404);

    let conversationId = typeof body?.conversation_id === "string" ? body.conversation_id : null;
    if (conversationId) {
      const { data: existing } = await admin.from("agent_office_conversations").select("id").eq("id", conversationId).eq("workspace_id", workspace.id).eq("agent_id", agent.id).maybeSingle();
      if (!existing) conversationId = null;
    }
    if (!conversationId) {
      const { data: conversation, error } = await admin.from("agent_office_conversations").insert({ workspace_id: workspace.id, agent_id: agent.id, title: question.slice(0, 80), context: { accountIds, funnelIds, startDate, endDate } }).select("id").single();
      if (error || !conversation) throw error || new Error("CONVERSATION_CREATE_FAILED");
      conversationId = conversation.id;
    }

    const history = await admin.from("agent_office_messages").select("role,content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12);
    const scopedAccounts = accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"];
    let insightsQuery = admin.from("insights").select("ad_account_id,spend,impressions,clicks,leads,date").in("ad_account_id", scopedAccounts);
    if (startDate) insightsQuery = insightsQuery.gte("date", startDate);
    if (endDate) insightsQuery = insightsQuery.lte("date", endDate);
    const { data: insights } = await insightsQuery.limit(5000);
    const facts = (insights || []).reduce((acc, row: any) => ({ spend: acc.spend + Number(row.spend || 0), impressions: acc.impressions + Number(row.impressions || 0), clicks: acc.clicks + Number(row.clicks || 0), leads: acc.leads + Number(row.leads || 0), rows: acc.rows + 1 }), { spend: 0, impressions: 0, clicks: 0, leads: 0, rows: 0 });
    const sourceNote = [{ type: "meta", reference: "insights", label: `${facts.rows} linhas Meta consultadas` }];
    const scopeLabel = `${startDate || "período disponível"} a ${endDate || "hoje"}`;
    const system = `Você é o agente ${agent.name} da Growdash, departamento ${agent.department || role}. Responda em português do Brasil. Escopo: ${scopeLabel}. Conta(s) Meta: ${accountIds.join(", ") || "todas autorizadas"}. Funil(is) RD: ${funnelIds.join(", ") || "não filtrado"}. Use somente os fatos fornecidos. Se uma métrica não estiver disponível, diga indisponível; nunca invente zero. Você pode analisar e preparar recomendações, mas não promete executar alterações. Fatos Meta: ${JSON.stringify(facts)}.`;
    const model = await callModel([{ role: "system", content: system }, ...((history.data || []).reverse() as Array<{ role: string; content: string }>), { role: "user", content: question }]);
    const userMessage = await admin.from("agent_office_messages").insert({ workspace_id: workspace.id, agent_id: agent.id, conversation_id: conversationId, role: "user", content: question, sources: [], scope: { accountIds, funnelIds, startDate, endDate } }).select("id").single();
    const agentMessage = await admin.from("agent_office_messages").insert({ workspace_id: workspace.id, agent_id: agent.id, conversation_id: conversationId, role: "agent", content: model.content, sources: sourceNote, scope: { accountIds, funnelIds, startDate, endDate } }).select("id,created_at").single();
    await admin.from("agent_office_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    if (userMessage.error || agentMessage.error) throw userMessage.error || agentMessage.error;
    return json({ conversationId, agent: { id: agent.id, name: agent.name, role: agent.role }, message: { id: agentMessage.data?.id, role: "agent", content: model.content, sources: sourceNote, createdAt: agentMessage.data?.created_at }, configured: model.configured, facts, status: model.configured ? "answered" : "queued" });
  } catch (error) {
    console.error("agent-office-chat", error);
    return json({ error: "AGENT_CHAT_FAILED", detail: (error as Error).message.slice(0, 160) }, 500);
  }
});
