import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { resumeWorkflow } from "../_shared/workflowResume.ts";
import { getFreshGoogleToken } from "../_shared/googleToken.ts";
import { resolveRDConnection } from "../_shared/rdConnection.ts";
import { normalizeSellerNotification, normalizeTagAssignment, normalizeTask } from "../_shared/automationActions.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-workflow-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_BODY = 256 * 1024;
const MAX_STEPS = 100;
const MAX_DELAY_SECONDS = 60;
type Node = { id: string; type: string; parameters?: Record<string, unknown> };
type Edge = { source: string; target: string; sourcePort?: string; targetPort?: string };
type Definition = { id?: string; name?: string; version?: number; nodes: Node[]; connections: Edge[] };
type QueueItem = { nodeId: string; key: string; loopContext?: { item: unknown; index: number; items: unknown[] } };

const INTERNAL_SECRET = Deno.env.get("AUTOMATION_INTERNAL_SECRET") ?? "";
const isInternalCall = (req: Request) => INTERNAL_SECRET.length >= 24 && req.headers.get("x-growdash-automation-secret") === INTERNAL_SECRET;
const sleep = (milliseconds: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const integrationFor = async (admin: any, userId: string, provider: string, providerAccountId?: string | null) => {
  let query = admin.from("integrations").select("id,api_token,token_expires_at,provider_account_id").eq("user_id", userId).eq("provider", provider).eq("is_active", true);
  if (providerAccountId) query = query.eq("provider_account_id", providerAccountId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data?.api_token) throw new Error(`Integração ${provider} não configurada para este workflow.`);
  return data;
};
const googleRequest = async (admin: any, userId: string, url: string, init: RequestInit = {}) => {
  const integration = await integrationFor(admin, userId, "google_workspace");
  let token = (await getFreshGoogleToken(admin, integration)).accessToken;
  const request = () => fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  let response = await request();
  if (response.status === 401) {
    token = (await getFreshGoogleToken(admin, integration, "api_request", true)).accessToken;
    response = await request();
  }
  return response;
};
const safeHeaderMap = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key, item]) => /^[A-Za-z0-9-]+$/.test(key) && typeof item === "string").map(([key, item]) => [key, String(item)]));
};
const base64Url = (value: string) => btoa(unescape(encodeURIComponent(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => /token|secret|password|authorization|access_key/i.test(key) ? [key, "[REDACTED]"] : [key, redact(item)]));
}
function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce((value: any, part) => value == null ? undefined : value[part], source as any);
}
function resolve(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;
  const exact = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (exact) return getPath(context, exact[1]);
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => String(getPath(context, path.trim()) ?? ""));
}
function resolveObject(value: unknown, context: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveObject(item, context));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveObject(item, context)]));
  return resolve(value, context);
}
function validate(definition: Definition) {
  const errors: string[] = [];
  const ids = new Set(definition.nodes.map((node) => node.id));
  if (!definition.name?.trim()) errors.push("O workflow precisa de um nome.");
  if (!definition.nodes.length) errors.push("Adicione pelo menos um nó.");
  const adjacency = new Map<string, string[]>();
  for (const edge of definition.connections) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push(`Conexão inválida: ${edge.source} → ${edge.target}`);
    const list = adjacency.get(edge.source) ?? []; list.push(edge.target); adjacency.set(edge.source, list);
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string) => { if (visiting.has(id)) errors.push("O workflow não pode conter ciclos."); if (visited.has(id)) return; visiting.add(id); for (const target of adjacency.get(id) ?? []) visit(target); visiting.delete(id); visited.add(id); };
  for (const id of ids) visit(id);
  return [...new Set(errors)];
}
function safeUrl(raw: unknown): string {
  const url = new URL(String(raw || ""));
  if (!/^https?:$/.test(url.protocol)) throw new Error("A URL deve usar HTTPS ou HTTP público.");
  const host = url.hostname.toLowerCase();
  if (url.protocol === "http:" && host !== "localhost") throw new Error("Requisições externas precisam usar HTTPS.");
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|::1$)/.test(host) || host.endsWith(".local")) throw new Error("URL privada bloqueada por segurança.");
  return url.toString();
}
async function sha(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join(""); }
function compare(actual: unknown, operator: string, expected: unknown) { const a = String(actual ?? ""); const b = String(expected ?? ""); if (operator === "equals") return a === b; if (operator === "not_equals") return a !== b; if (operator === "starts_with") return a.startsWith(b); if (operator === "exists") return actual !== undefined && actual !== null && a !== ""; return a.toLowerCase().includes(b.toLowerCase()); }

async function providerJson(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload && typeof payload === "object" && "error" in payload && payload.error)) {
    const detail = typeof payload?.error === "string" ? payload.error : payload?.error?.message || payload?.message;
    throw new Error(detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${response.status})`);
  }
  return payload;
}

async function executeGoogleNode(admin: any, actorId: string, type: string, parameters: Record<string, unknown>, context: Record<string, unknown>) {
  if (type === "gmail.send") {
    const to = String(parameters.to || getPath(context, "lead.email") || "").trim();
    const subject = String(parameters.subject || "").trim();
    const html = String(parameters.html || parameters.body || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(to) || !subject || !html) throw new Error("Gmail exige destinatário, assunto e conteúdo.");
    const raw = [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", html].join("\r\n");
    return providerJson(await googleRequest(admin, actorId, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: base64Url(raw) }) }), "O Gmail recusou o envio");
  }
  if (type === "google.sheets.append" || type === "google.sheets.lookup") {
    const spreadsheetId = String(parameters.spreadsheetId || parameters.spreadsheet_id || "").trim();
    const sheetName = String(parameters.sheetName || parameters.sheet_name || "Leads").trim();
    if (!spreadsheetId) throw new Error("Informe o ID da planilha Google Sheets.");
    const range = encodeURIComponent(`${sheetName}!A:ZZ`);
    if (type === "google.sheets.lookup") {
      const payload = await providerJson(await googleRequest(admin, actorId, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`), "Não foi possível ler o Google Sheets");
      return { spreadsheet_id: spreadsheetId, sheet: sheetName, values: Array.isArray(payload.values) ? payload.values : [] };
    }
    const row = Array.isArray(parameters.values) ? parameters.values : [parameters.row || context.lead || context.trigger];
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    return providerJson(await googleRequest(admin, actorId, appendUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }) }), "Não foi possível adicionar a linha no Google Sheets");
  }
  if (type === "google.drive.lookup") {
    const query = String(parameters.query || parameters.name || "").trim().replaceAll("'", "\\'");
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `${query ? `name contains '${query}' and ` : ""}trashed = false`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", "files(id,name,mimeType,size,webViewLink,modifiedTime)");
    const payload = await providerJson(await googleRequest(admin, actorId, url.toString()), "Não foi possível buscar no Google Drive");
    return { files: Array.isArray(payload.files) ? payload.files : [] };
  }
  if (type === "google.drive.upload") {
    const name = String(parameters.name || "arquivo").trim();
    const mimeType = String(parameters.mimeType || parameters.mime_type || "application/octet-stream");
    let bytes: Uint8Array;
    if (String(parameters.contentBase64 || "")) bytes = Uint8Array.from(atob(String(parameters.contentBase64)), (char) => char.charCodeAt(0));
    else if (String(parameters.fileUrl || "")) {
      const response = await fetch(safeUrl(parameters.fileUrl));
      if (!response.ok) throw new Error(`Não foi possível baixar o arquivo (HTTP ${response.status}).`);
      bytes = new Uint8Array(await response.arrayBuffer());
    } else throw new Error("Informe contentBase64 ou fileUrl para enviar um arquivo ao Drive.");
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Arquivos de automação devem ter no máximo 10 MB.");
    const boundary = `growdash-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name, mimeType, ...(parameters.folderId ? { parents: [String(parameters.folderId)] } : {}) });
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, bytes, `\r\n--${boundary}--`]);
    const payload = await providerJson(await googleRequest(admin, actorId, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,modifiedTime", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body }), "Não foi possível enviar o arquivo ao Google Drive");
    return { file: payload };
  }
  throw new Error(`Nó Google não suportado: ${type}`);
}

async function executeInstagramNode(admin: any, actorId: string, type: string, parameters: Record<string, unknown>, context: Record<string, unknown>) {
  const accountId = String(parameters.socialAccountId || parameters.social_account_id || getPath(context, "trigger.social_account_id") || "");
  const { data: account } = await admin.from("social_accounts").select("id,provider_account_id").eq("id", accountId).maybeSingle();
  if (!account) throw new Error("Selecione uma conta do Instagram para este nó.");
  const integration = await integrationFor(admin, actorId, "instagram_business", account.provider_account_id);
  const version = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") ?? "v25.0";
  const message = String(parameters.message || parameters.text || "").trim();
  if (!message) throw new Error("A mensagem do Instagram é obrigatória.");
  const trigger = (context.trigger || {}) as Record<string, unknown>;
  if (type === "instagram.reply") {
    const commentId = String(parameters.commentId || trigger.comment_id || trigger.id || "");
    const senderId = String(parameters.recipientId || trigger.sender_id || trigger.recipient_id || "");
    if (commentId) {
      const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(commentId)}/replies`);
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ message, access_token: String(integration.api_token) }) });
      return providerJson(response, "O Instagram recusou a resposta ao comentário");
    }
    if (!senderId) throw new Error("O evento do Instagram não contém comment_id ou sender_id.");
    const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(account.provider_account_id)}/messages`);
    url.searchParams.set("access_token", String(integration.api_token));
    return providerJson(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: senderId }, message: { text: message } }) }), "O Instagram recusou a mensagem");
  }
  const recipientId = String(parameters.recipientId || trigger.recipient_id || trigger.sender_id || "");
  if (!recipientId) throw new Error("Informe recipientId para enviar uma mensagem no Instagram.");
  const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(account.provider_account_id)}/messages`);
  url.searchParams.set("access_token", String(integration.api_token));
  return providerJson(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }) }), "O Instagram recusou o envio");
}

async function executeRDNode(admin: any, actorId: string, type: string, parameters: Record<string, unknown>, context: Record<string, unknown>) {
  const trigger = (context.trigger || {}) as Record<string, unknown>;
  const connectionId = String(parameters.rd_connection_id || parameters.rdConnectionId || trigger.rd_connection_id || "").trim();
  const connection = await resolveRDConnection(admin, { connectionId, userId: actorId });
  if (!connection.write_enabled) throw new Error("As escritas no RD estão desativadas para esta conexão.");
  const token = String(connection.api_token || "");
  const dealId = String(parameters.rd_deal_id || parameters.rdDealId || trigger.rd_deal_id || getPath(context, "lead.rd_deal_id") || "").trim();
  const fields = parameters.fields && typeof parameters.fields === "object" && !Array.isArray(parameters.fields) ? parameters.fields as Record<string, unknown> : {};
  if (type === "crm.note.create") {
    if (!dealId || !String(parameters.body || parameters.note || "").trim()) throw new Error("A anotação RD exige rd_deal_id e body.");
    const response = await fetch(`https://crm.rdstation.com/api/v1/activities?token=${encodeURIComponent(token)}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ deal_id: dealId, type: "note", description: String(parameters.body || parameters.note).trim() }) });
    return providerJson(response, "O RD Station recusou a anotação");
  }
  if (type === "crm.contact.upsert") {
    const contact = { ...fields, ...(dealId ? { deal_ids: Array.from(new Set([...(Array.isArray(fields.deal_ids) ? fields.deal_ids : []), dealId])) } : {}) };
    if (!Object.keys(contact).length) throw new Error("Informe fields para criar ou atualizar o contato RD.");
    const response = await fetch(`https://crm.rdstation.com/api/v1/contacts?token=${encodeURIComponent(token)}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ contact }) });
    return providerJson(response, "O RD Station recusou o contato");
  }
  if (type === "crm.deal.create") {
    const deal = { ...fields, ...(parameters.deal_stage_id ? { deal_stage_id: String(parameters.deal_stage_id) } : {}) };
    if (!Object.keys(deal).length) throw new Error("Informe fields para criar a negociação RD.");
    const response = await fetch(`https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(token)}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ deal }) });
    return providerJson(response, "O RD Station recusou a negociação");
  }
  if (type === "crm.stage.change") {
    const stageId = String(parameters.deal_stage_id || parameters.stageId || "").trim();
    if (!dealId || !stageId) throw new Error("Alterar etapa exige rd_deal_id e deal_stage_id.");
    const response = await fetch(`https://crm.rdstation.com/api/v1/deals/${encodeURIComponent(dealId)}?token=${encodeURIComponent(token)}`, { method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ deal_stage_id: stageId }) });
    return providerJson(response, "O RD Station recusou a alteração de etapa");
  }
  throw new Error(`Nó RD não suportado: ${type}`);
}

async function assertWorkspaceUser(admin: any, workspaceId: string, userId: string, label: string) {
  const { data, error } = await admin.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${label} não pertence ao workspace ativo.`);
}

async function executeInternalAction(admin: any, automation: { id: string; workspace_id: string }, runId: string, actorId: string, type: string, parameters: Record<string, unknown>) {
  if (type === "task.create") {
    const task = normalizeTask(parameters);
    if (task.assignee_user_id) await assertWorkspaceUser(admin, automation.workspace_id, task.assignee_user_id, "O responsável da tarefa");
    const { data, error } = await admin.from("growdash_automation_tasks").insert({ ...task, workspace_id: automation.workspace_id, automation_id: automation.id, run_id: runId, created_by: actorId }).select("id,title,status,priority,assignee_user_id,due_at,entity_type,entity_id,created_at").single();
    if (error) throw error;
    return { task: data };
  }
  if (type === "tag.add") {
    const assignment = normalizeTagAssignment(parameters);
    let { data: tag, error: tagError } = await admin.from("growdash_automation_tags").select("id,name,color").eq("workspace_id", automation.workspace_id).ilike("name", assignment.name).maybeSingle();
    if (tagError) throw tagError;
    if (!tag) {
      const created = await admin.from("growdash_automation_tags").insert({ workspace_id: automation.workspace_id, name: assignment.name, color: assignment.color }).select("id,name,color").single();
      if (created.error && String(created.error.code || "") === "23505") {
        const retry = await admin.from("growdash_automation_tags").select("id,name,color").eq("workspace_id", automation.workspace_id).ilike("name", assignment.name).maybeSingle();
        if (retry.error || !retry.data) throw retry.error || new Error("Não foi possível obter a tag criada.");
        tag = retry.data;
      } else {
        if (created.error || !created.data) throw created.error || new Error("Não foi possível criar a tag.");
        tag = created.data;
      }
    }
    const { data, error } = await admin.from("growdash_automation_tag_assignments").upsert({ workspace_id: automation.workspace_id, tag_id: tag.id, entity_type: assignment.entity_type, entity_id: assignment.entity_id, automation_id: automation.id, run_id: runId }, { onConflict: "workspace_id,tag_id,entity_type,entity_id" }).select("id,tag_id,entity_type,entity_id,created_at").single();
    if (error) throw error;
    return { tag, assignment: data };
  }
  if (type === "seller.notify") {
    const notification = normalizeSellerNotification(parameters);
    await assertWorkspaceUser(admin, automation.workspace_id, notification.recipient_user_id, "O destinatário");
    const { data, error } = await admin.from("growdash_automation_notifications").insert({ ...notification, workspace_id: automation.workspace_id, automation_id: automation.id, run_id: runId }).select("id,recipient_user_id,title,message,link,created_at").single();
    if (error) throw error;
    return { notification: data };
  }
  throw new Error(`Ação interna não suportada: ${type}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ error: "Payload excede o limite de 256 KB." }, 413);
  const auth = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json();
    const workflowId = typeof body.workflow_id === "string" ? body.workflow_id : "";
    if (!workflowId) return json({ error: "workflow_id é obrigatório." }, 400);
    const internalCall = isInternalCall(req);
    if (internalCall && !["webhook", "schedule", "resume"].includes(String(body.mode || ""))) return json({ error: "A chamada interna só pode disparar workflows por webhook, agendamento ou retomada aprovada." }, 403);
    let user: { id: string } | null = null;
    if (!internalCall) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const authResult = await userClient.auth.getUser();
      user = authResult.data.user;
      if (!user) return json({ error: "Não autorizado" }, 401);
    }
    const { data: automation, error: automationError } = await admin.from("growdash_automations").select("id,workspace_id,created_by,name,status,run_count,workflow_definition,workflow_version,error_policy").eq("id", workflowId).maybeSingle();
    if (automationError) throw automationError;
    if (!automation) return json({ error: "Workflow não encontrado." }, 404);
    const actorId = internalCall ? String(automation.created_by || "") : user!.id;
    if (!actorId) return json({ error: "Workflow sem proprietário válido." }, 422);
    if (!internalCall) {
      const { data: member } = await admin.from("workspace_members").select("workspace_id").eq("workspace_id", automation.workspace_id).eq("user_id", actorId).eq("status", "active").maybeSingle();
      if (!member) return json({ error: "Workspace não autorizado." }, 403);
    }
    if (automation.status === "paused" && body.mode !== "test") return json({ error: "Workflow pausado." }, 409);
    const definition = (automation.workflow_definition || {}) as Definition;
    const errors = validate(definition);
    if (errors.length) return json({ error: "Workflow inválido.", details: errors }, 422);
    let input = body.input && typeof body.input === "object" ? body.input : {};
    const resumeApprovalId = body.mode === "resume" ? String(body.approval_id || "") : "";
    let resumeNodeId: string | null = null;
    let run: { id: string; actions_executed?: unknown[] | null };
    if (resumeApprovalId) {
      const { data: approval, error: approvalError } = await admin.from("growdash_workflow_approvals").select("id,run_id,node_id,status").eq("id", resumeApprovalId).eq("workspace_id", automation.workspace_id).maybeSingle();
      if (approvalError) throw approvalError;
      if (!approval || approval.status !== "approved") return json({ error: "A aprovação ainda não está aprovada ou não existe." }, 409);
      const { data: existingRun, error: existingRunError } = await admin.from("growdash_automation_runs").select("id,status,trigger_event,actions_executed").eq("id", approval.run_id).eq("automation_id", workflowId).maybeSingle();
      if (existingRunError) throw existingRunError;
      if (!existingRun || existingRun.status !== "partial") return json({ error: "A execução não está aguardando aprovação." }, 409);
      input = existingRun.trigger_event && typeof existingRun.trigger_event === "object" ? existingRun.trigger_event : {};
      run = existingRun;
      resumeNodeId = String(approval.node_id);
    } else {
      const eventKey = String(body.idempotency_key || input.leadgen_id || input.id || JSON.stringify(input));
      const idempotencyKey = await sha(`${workflowId}:${automation.workflow_version || definition.version || 1}:${eventKey}`);
      const { data: existing } = await admin.from("growdash_automation_runs").select("id,status,created_at").eq("automation_id", workflowId).eq("workspace_id", automation.workspace_id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing) return json({ ok: true, duplicate: true, run_id: existing.id, status: existing.status });
      const { data: createdRun, error: runError } = await admin.from("growdash_automation_runs").insert({ automation_id: workflowId, workspace_id: automation.workspace_id, trigger_event: redact(input), actions_executed: [], status: "partial", idempotency_key: idempotencyKey, started_at: new Date().toISOString() }).select("id,actions_executed").single();
      if (runError || !createdRun) throw runError || new Error("Não foi possível iniciar a execução.");
      run = createdRun;
    }
    const context: Record<string, unknown> = { trigger: input, lead: input.lead || input, date: { now: new Date().toISOString() }, node: {} };
    if (resumeNodeId) {
      const { data: previousSteps } = await admin.from("growdash_workflow_run_steps").select("node_id,output").eq("run_id", run.id).eq("status", "success").order("created_at", { ascending: true });
      for (const step of previousSteps || []) {
        (context.node as Record<string, unknown>)[step.node_id] = { output: step.output };
      }
    }
    const byId = new Map(definition.nodes.map((node) => [node.id, node]));
    const edgesFrom = (nodeId: string) => definition.connections.filter((edge) => edge.source === nodeId);
    const incoming = new Set(definition.connections.map((edge) => edge.target));
    const resumed = resumeNodeId ? resumeWorkflow(definition.connections, resumeNodeId) : null;
    const queue: QueueItem[] = resumed
      ? resumed.queue.map((nodeId) => ({ nodeId, key: nodeId }))
      : definition.nodes.filter((node) => !incoming.has(node.id)).map((node) => ({ nodeId: node.id, key: node.id }));
    const visited = new Set<string>(resumed?.visited || []); const outputs: Record<string, unknown> = {}; const executed: unknown[] = Array.isArray(run.actions_executed) ? [...run.actions_executed] : [];
    const log = async (level: string, message: string, details: Record<string, unknown> = {}) => { await admin.from("growdash_workflow_logs").insert({ run_id: run.id, workspace_id: automation.workspace_id, level, message, context: redact(details) }); };
    const mergeInputs = new Map<string, Record<string, unknown>>();
    const executeNode = async (node: Node): Promise<unknown> => {
      const p = resolveObject(node.parameters || {}, context) as Record<string, unknown>;
      switch (node.type) {
        case "manual.trigger": case "webhook.trigger": case "schedule.trigger": case "lead.trigger": case "instagram.trigger": case "instagram.message.trigger": case "whatsapp.message.trigger": case "google.drive.trigger": case "google.sheets.trigger": return input;
        case "http.request": {
          const method = String(p.method || "POST").toUpperCase();
          let requestBody: unknown = p.body || {};
          if (typeof requestBody === "string") { try { requestBody = JSON.parse(requestBody); } catch { /* envia texto literal quando não for JSON */ } }
          const response = await fetch(safeUrl(p.url), { method, headers: { "Content-Type": "application/json", ...safeHeaderMap(p.headers) }, body: ["GET", "HEAD"].includes(method) ? undefined : typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody) });
          const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(result?.message || result?.error || response.statusText)}`); return { status: response.status, body: result };
        }
        case "condition.if": case "logic.filter": {
          const pass = compare(getPath(context, String(p.field || "")), String(p.operator || "contains"), p.value);
          return { pass, branch: pass ? "true" : "false" };
        }
        case "logic.switch": {
          const actual = getPath(context, String(p.field || ""));
          const cases = Array.isArray(p.cases) ? p.cases : [];
          const match = cases.find((item: any) => compare(actual, String(item?.operator || "equals"), item?.value));
          return { value: actual, branch: String(match?.port || match?.label || "default") };
        }
        case "logic.merge": return { merged: true, inputs: mergeInputs.get(node.id) || context.node };
        case "logic.loop": {
          const items = Array.isArray(p.items) ? p.items : getPath(context, String(p.itemsPath || "lead.items"));
          if (!Array.isArray(items)) throw new Error("Loop exige uma lista em items ou itemsPath.");
          return { count: Math.min(items.length, Number(p.maxItems || 100)), items: items.slice(0, Number(p.maxItems || 100)) };
        }
        case "logic.stop": return { stopped: true, branch: "stop" };
        case "error.fallback": return { fallback: resolveObject(p.value ?? p.fallback ?? null, context) };
        case "error.retry": return { retry: Math.max(0, Math.min(5, Number(p.attempts || 1))), delay_seconds: Math.max(0, Math.min(30, Number(p.delaySeconds || 1))) };
        case "approval.manual": {
          const { data: approval, error: approvalError } = await admin.from("growdash_workflow_approvals").insert({ run_id: run.id, workspace_id: automation.workspace_id, node_id: node.id, status: "pending" }).select("id,status").single();
          if (approvalError) throw approvalError;
          return { status: "pending", approval_id: approval?.id };
        }
        case "delay.wait": { const seconds = Math.min(MAX_DELAY_SECONDS, Math.max(0, Number(p.seconds || 0))); if (seconds) await new Promise((resolveDelay) => setTimeout(resolveDelay, seconds * 1000)); return { waited_seconds: seconds }; }
        case "google.sheets.append": case "google.sheets.lookup": case "google.drive.upload": case "google.drive.lookup": case "gmail.send": return executeGoogleNode(admin, actorId, node.type, p, context);
        case "instagram.reply": case "instagram.send": return executeInstagramNode(admin, actorId, node.type, p, context);
        case "crm.contact.upsert": case "crm.deal.create": case "crm.note.create": case "crm.stage.change": return executeRDNode(admin, actorId, node.type, p, context);
        case "whatsapp.send": {
          const phone = String(p.phone || "").replace(/\D/g, ""); const message = String(p.message || ""); if (phone.length < 10 || !message) throw new Error("WhatsApp exige telefone e mensagem.");
          const { data: number } = await admin.from("whatsapp_numbers").select("id,phone_number_id,access_token").eq("workspace_id", automation.workspace_id).eq("status", "connected").limit(1).maybeSingle();
          if (!number) throw new Error("Nenhum número WhatsApp conectado neste workspace.");
          const response = await fetch(`https://graph.facebook.com/v23.0/${number.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${number.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }) });
          const result = await response.json().catch(() => ({})); if (!response.ok || result.error) throw new Error(result.error?.message || "A Meta recusou o envio."); return { message_id: result.messages?.[0]?.id || null, status: "sent" };
        }
        case "agent.run": {
          const key = Deno.env.get("OPENAI_API_KEY"); if (!key) throw new Error("Agente IA indisponível: OPENAI_API_KEY não configurada.");
          const prompt = String(p.prompt || ""); if (!prompt) throw new Error("A instrução do agente é obrigatória.");
          const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: String(p.model || "gpt-4o-mini"), temperature: Number(p.temperature ?? 0.2), max_tokens: Math.min(2000, Number(p.maxTokens || 500)), messages: [{ role: "user", content: resolve(prompt, context) }] }) });
          const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error?.message || "Falha no agente IA."); const text = result.choices?.[0]?.message?.content || ""; return p.output === "json" ? JSON.parse(text) : text;
        }
        case "task.create": case "tag.add": case "seller.notify": return executeInternalAction(admin, { id: workflowId, workspace_id: automation.workspace_id }, run.id, actorId, node.type, p);
        default: throw new Error(`Nó não suportado: ${node.type}`);
      }
    };
    while (queue.length && visited.size < MAX_STEPS) {
      const item = queue.shift()!; const nodeId = item.nodeId; if (visited.has(item.key)) continue; const node = byId.get(nodeId); if (!node) continue;
      if (node.type === "logic.merge") {
        const parents = definition.connections.filter((edge) => edge.target === node.id).map((edge) => edge.source);
        const hasVisitedNode = (parent: string) => [...visited].some((key) => key === parent || key.startsWith(`${parent}:loop:`));
        if (parents.some((parent) => !hasVisitedNode(parent))) {
          queue.push(item);
          if (queue.every((queued) => queued.nodeId === node.id)) break;
          continue;
        }
        mergeInputs.set(node.id, Object.fromEntries(parents.map((parent) => [parent, (context.node as Record<string, unknown>)[parent]])));
      }
      if (item.loopContext) context.loop = item.loopContext; else delete context.loop;
      const started = new Date().toISOString(); const stepBase = { run_id: run.id, workspace_id: automation.workspace_id, node_id: node.id, node_type: node.type, input: redact(context), status: "running", started_at: started, attempt: 1 };
      const { data: stepRow } = await admin.from("growdash_workflow_run_steps").insert(stepBase).select("id").single();
      try {
        const policyRetry = Number((automation.error_policy as any)?.retry || 0);
        const nodeRetry = Number((node.parameters as any)?.retryAttempts || 0);
        const maxAttempts = Math.min(5, Math.max(1, Math.floor(Math.max(policyRetry, nodeRetry)) + 1));
        let output: unknown;
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try { output = await executeNode(node); lastError = null; break; } catch (error) {
            lastError = error;
            if (attempt >= maxAttempts) break;
            await admin.from("growdash_workflow_run_steps").update({ status: "retrying", attempt, error_message: error instanceof Error ? error.message : "Falha transitória" }).eq("run_id", run.id).eq("node_id", node.id).eq("status", "running");
            await sleep(Math.min(30_000, 500 * (2 ** (attempt - 1))));
          }
        }
        if (lastError) throw lastError;
        outputs[node.id] = output; context.node = { ...context.node, [node.id]: { output } }; visited.add(item.key); executed.push({ node_id: node.id, type: node.type, status: "success", ...(item.loopContext ? { loop_index: item.loopContext.index } : {}) });
        const stepQuery = admin.from("growdash_workflow_run_steps").update({ status: "success", output: redact(output), finished_at: new Date().toISOString() });
        await (stepRow?.id ? stepQuery.eq("id", stepRow.id) : stepQuery.eq("run_id", run.id).eq("node_id", node.id).eq("status", "running"));
        await log("info", `Nó ${node.type} concluído`, { node_id: node.id });
        if ((output as any)?.status === "pending" && node.type === "approval.manual") {
          await admin.from("growdash_automation_runs").update({ status: "partial", actions_executed: executed, error_message: "Aguardando aprovação manual.", finished_at: null }).eq("id", run.id);
          return json({ ok: true, run_id: run.id, status: "partial", waiting_for_approval: true, output: redact(outputs), steps: executed });
        }
        for (const edge of edgesFrom(node.id)) {
          const branch = (output as any)?.branch;
          if (["condition.if", "logic.filter", "logic.switch"].includes(node.type) && edge.sourcePort && edge.sourcePort !== branch) continue;
          if (node.type === "logic.stop") continue;
          const items = node.type === "logic.loop" && Array.isArray((output as any)?.items) ? (output as any).items as unknown[] : null;
          if (items) {
            items.forEach((loopItem, index) => queue.push({ nodeId: edge.target, key: `${edge.target}:loop:${index}`, loopContext: { item: loopItem, index, items } }));
          } else {
            queue.push({ nodeId: edge.target, key: item.loopContext ? `${edge.target}:loop:${item.loopContext.index}` : edge.target, loopContext: item.loopContext });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido"; executed.push({ node_id: node.id, type: node.type, status: "error", error: message });
        const stepQuery = admin.from("growdash_workflow_run_steps").update({ status: "error", error_message: message, finished_at: new Date().toISOString() });
        await (stepRow?.id ? stepQuery.eq("id", stepRow.id) : stepQuery.eq("run_id", run.id).eq("node_id", node.id).eq("status", "running")); await log("error", message, { node_id: node.id });
        await admin.from("growdash_automation_runs").update({ status: "error", actions_executed: executed, error_message: message, finished_at: new Date().toISOString() }).eq("id", run.id); return json({ ok: false, run_id: run.id, error: message, steps: executed }, 422);
      }
    }
    const status = visited.size >= MAX_STEPS ? "error" : "success";
    const finalError = status === "error" ? "Limite de 100 etapas atingido." : null;
    await admin.from("growdash_automation_runs").update({ status, actions_executed: executed, error_message: finalError, finished_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("growdash_automations").update({ run_count: Number(automation.run_count || 0) + 1, last_run_at: new Date().toISOString(), last_error: finalError }).eq("id", workflowId);
    return json({ ok: status === "success", run_id: run.id, status, output: redact(outputs), steps: executed });
  } catch (error) { console.error("workflow-execute", error); return json({ error: error instanceof Error ? error.message : "Erro interno do executor." }, 500); }
});
