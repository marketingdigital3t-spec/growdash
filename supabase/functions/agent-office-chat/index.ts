import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { findMetaSyncCoverage, type MetaSyncCoverageRow } from "../../../src/lib/metaSyncCoverage.ts";
import { CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES, resolveMetaLeadParts } from "../_shared/metaLeadMetrics.ts";

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
    const requestedAccountIds = Array.isArray(body?.scope?.accountIds) ? Array.from(new Set(body.scope.accountIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))) : [];
    const funnelIds = Array.isArray(body?.scope?.funnelIds) ? body.scope.funnelIds.filter((id: unknown) => typeof id === "string") : [];
    const admin = createClient(url, serviceKey);
    const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("id,name,timezone").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
    if (workspaceError || !workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
    let accountQuery = admin.from("ad_accounts").select("id,name,attribution_window,timezone_name").eq("user_id", user.id);
    if (requestedAccountIds.length) accountQuery = accountQuery.in("id", requestedAccountIds);
    const { data: accounts, error: accountsError } = await accountQuery;
    if (accountsError) throw accountsError;
    if (requestedAccountIds.length && (accounts || []).length !== requestedAccountIds.length) return json({ error: "ACCOUNT_SCOPE_NOT_AUTHORIZED" }, 403);
    const accountIds = (accounts || []).map((account) => account.id);
    let coverageRows: MetaSyncCoverageRow[] = [];
    if (startDate && endDate && accountIds.length) {
      const { data, error } = await admin.from("meta_sync_scope_state")
        .select("ad_account_id,campaign_scope,start_date,end_date,covered_start_date,covered_end_date,timezone,attribution_window,status,block_status,updated_at")
        .in("ad_account_id", accountIds).lte("start_date", endDate).gte("end_date", startDate);
      if (error) throw error;
      coverageRows = (data || []) as unknown as MetaSyncCoverageRow[];
    }
    const isBlockConfirmed = (account: (typeof accounts)[number], block: string) => Boolean(startDate && endDate && findMetaSyncCoverage(
      coverageRows,
      { accountId: account.id, timezone: account.timezone_name || "America/Sao_Paulo", attributionWindow: account.attribution_window || "account_default" },
      startDate,
      endDate,
      [],
      block,
    ));
    const insightsConfirmed = accountIds.length > 0 && (accounts || []).every((account) => isBlockConfirmed(account, "insights"));
    const actionsConfirmed = accountIds.length > 0 && (accounts || []).every((account) => isBlockConfirmed(account, "actions"));
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

    const history = await admin.from("agent_office_messages").select("role,content").eq("conversation_id", conversationId).eq("workspace_id", workspace.id).eq("agent_id", agent.id).order("created_at", { ascending: false }).limit(12);
    const insightRows: any[] = [];
    for (let offset = 0; accountIds.length; offset += 1000) {
      let query = admin.from("insights").select("ad_account_id,ad_id,campaign_id,attribution_window,spend,impressions,clicks,date")
        .in("ad_account_id", accountIds).order("date", { ascending: true }).order("ad_id", { ascending: true }).range(offset, offset + 999);
      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);
      const { data, error } = await query;
      if (error) throw error;
      insightRows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const accountById = new Map((accounts || []).map((account) => [account.id, account]));
    const uniqueInsights = Array.from(new Map(insightRows
      .filter((row) => (row.attribution_window || "account_default") === (accountById.get(row.ad_account_id)?.attribution_window || "account_default"))
      .map((row) => [`${row.ad_account_id}|${row.ad_id}|${row.date}|${row.attribution_window || "account_default"}`, row])).values());
    const { data: lpConfigs, error: lpError } = accountIds.length
      ? await admin.from("account_lp_config").select("ad_account_id,action_type").in("ad_account_id", accountIds)
      : { data: [], error: null };
    if (lpError) throw lpError;
    const siteActionByAccount = Object.fromEntries((lpConfigs || []).map((config) => [config.ad_account_id, config.action_type || undefined]));
    const actionsByAd: Record<string, Record<string, number>> = {};
    const actionTypes = Array.from(new Set([...FORM_ACTION_TYPES, ...SITE_ACTION_TYPES, ...CONVERSATION_ACTION_TYPES, "lead", ...Object.values(siteActionByAccount).filter(Boolean)]));
    const actionScope = new Map<string, { adAccountId: string; window: string; adIds: string[] }>();
    for (const account of accounts || []) {
      const adIds = Array.from(new Set(uniqueInsights.filter((row) => row.ad_account_id === account.id).map((row) => row.ad_id).filter(Boolean)));
      if (!adIds.length) continue;
      const window = account.attribution_window || "account_default";
      actionScope.set(account.id, { adAccountId: account.id, window, adIds });
    }
    let actionRowCount = 0;
    for (const group of actionScope.values()) {
      for (let idsOffset = 0; idsOffset < group.adIds.length; idsOffset += 200) {
        const ids = group.adIds.slice(idsOffset, idsOffset + 200);
        for (let offset = 0; ; offset += 1000) {
          let query = admin.from("insight_actions").select("ad_id,date,action_type,value,attribution_window")
            .in("ad_id", ids).in("action_type", actionTypes).order("date", { ascending: true }).range(offset, offset + 999);
          if (startDate) query = query.gte("date", startDate);
          if (endDate) query = query.lte("date", endDate);
          query = group.window === "account_default" ? query.or("attribution_window.eq.account_default,attribution_window.is.null") : query.eq("attribution_window", group.window);
          const { data, error } = await query;
          if (error) throw error;
          for (const row of data || []) {
            const key = `${row.ad_id}|${row.date}`;
            const totals = actionsByAd[key] || {};
            totals[row.action_type] = Math.max(totals[row.action_type] || 0, Math.max(0, Number(row.value || 0)));
            actionsByAd[key] = totals;
            actionRowCount += 1;
          }
          if (!data || data.length < 1000) break;
        }
      }
    }
    const facts = uniqueInsights.reduce((acc, row) => {
      const actions = actionsByAd[`${row.ad_id}|${row.date}`] || {};
      const leads = resolveMetaLeadParts(actions, siteActionByAccount[row.ad_account_id]);
      const key = `${row.ad_account_id}|${row.ad_id}|${row.date}`;
      if (!acc.counted.has(key)) {
        acc.leads += leads.total;
        acc.counted.add(key);
      }
      acc.spend += Number(row.spend || 0);
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      acc.rows += 1;
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, leads: 0, rows: 0, counted: new Set<string>() });
    const leadActionSnapshotAvailable = actionsConfirmed;
    const factsForModel = {
      spend: insightsConfirmed ? facts.spend : null,
      impressions: insightsConfirmed ? facts.impressions : null,
      clicks: insightsConfirmed ? facts.clicks : null,
      insights_status: insightsConfirmed ? "confirmed" : "unavailable",
      leads: leadActionSnapshotAvailable ? facts.leads : null,
      leads_status: leadActionSnapshotAvailable ? "confirmed" : "unavailable",
      lead_definition: "por conta/anúncio/dia e janela de atribuição: selecionar o primeiro alias presente por prioridade canônica em cada grupo (formulário, site, conversa) e somar apenas os três grupos distintos; nunca usar insights.leads",
      rows: facts.rows,
      action_rows: actionRowCount,
      attribution_window_by_account: Object.fromEntries((accounts || []).map((account) => [account.id, account.attribution_window || "account_default"])),
      timezone_by_account: Object.fromEntries((accounts || []).map((account) => [account.id, account.timezone_name || "America/Sao_Paulo"])),
    };
    const sourceNote = [
      { type: "meta", reference: "insights", label: insightsConfirmed ? `${facts.rows} linhas confirmadas de entrega Meta` : "Insights Meta sem cobertura confirmada para todas as contas" },
      { type: "meta", reference: "insight_actions", label: leadActionSnapshotAvailable ? `${actionRowCount} linhas de ações Meta canônicas; cobertura confirmada` : "Ações de lead Meta indisponíveis neste recorte" },
    ];
    const scopeLabel = `${startDate || "período disponível"} a ${endDate || "hoje"}`;
    const system = `Você é o agente ${agent.name} da Growdash, departamento ${agent.department || role}. Responda em português do Brasil. Escopo: ${scopeLabel}. Conta(s) Meta: ${accountIds.join(", ") || "nenhuma conta selecionada"}. Funil(is) RD: ${funnelIds.join(", ") || "não filtrado"}. Use somente os fatos fornecidos. Se insights_status for unavailable, diga que investimento e entrega Meta estão indisponíveis, não zero; se leads_status for unavailable, diga que Leads Meta e CPL estão indisponíveis, não zero. Nunca use leads legado. Diferencie Meta de RD; não atribua dados de CRM à Meta. Nunca invente zero. Você pode analisar e preparar recomendações, mas não promete executar alterações. Fatos Meta: ${JSON.stringify(factsForModel)}.`;
    const model = await callModel([{ role: "system", content: system }, ...((history.data || []).reverse() as Array<{ role: string; content: string }>), { role: "user", content: question }]);
    const userMessage = await admin.from("agent_office_messages").insert({ workspace_id: workspace.id, agent_id: agent.id, conversation_id: conversationId, role: "user", content: question, sources: [], scope: { accountIds, funnelIds, startDate, endDate } }).select("id").single();
    const agentMessage = await admin.from("agent_office_messages").insert({ workspace_id: workspace.id, agent_id: agent.id, conversation_id: conversationId, role: "agent", content: model.content, sources: sourceNote, scope: { accountIds, funnelIds, startDate, endDate } }).select("id,created_at").single();
    await admin.from("agent_office_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    if (userMessage.error || agentMessage.error) throw userMessage.error || agentMessage.error;
    return json({ conversationId, agent: { id: agent.id, name: agent.name, role: agent.role }, message: { id: agentMessage.data?.id, role: "agent", content: model.content, sources: sourceNote, createdAt: agentMessage.data?.created_at }, configured: model.configured, facts: factsForModel, status: model.configured ? "answered" : "queued" });
  } catch (error) {
    console.error("agent-office-chat", error);
    return json({ error: "AGENT_CHAT_FAILED", detail: (error as Error).message.slice(0, 160) }, 500);
  }
});
