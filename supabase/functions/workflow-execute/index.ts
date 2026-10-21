import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

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
type Edge = { source: string; target: string; sourcePort?: string };
type Definition = { id?: string; name?: string; version?: number; nodes: Node[]; connections: Edge[] };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ error: "Payload excede o limite de 256 KB." }, 413);
  const auth = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);
  try {
    const body = await req.json();
    const workflowId = typeof body.workflow_id === "string" ? body.workflow_id : "";
    if (!workflowId) return json({ error: "workflow_id é obrigatório." }, 400);
    const { data: automation, error: automationError } = await admin.from("growdash_automations").select("id,workspace_id,name,status,workflow_definition,workflow_version,error_policy").eq("id", workflowId).maybeSingle();
    if (automationError) throw automationError;
    if (!automation) return json({ error: "Workflow não encontrado." }, 404);
    const { data: member } = await admin.from("workspace_members").select("workspace_id").eq("workspace_id", automation.workspace_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!member) return json({ error: "Workspace não autorizado." }, 403);
    if (automation.status === "paused" && body.mode !== "test") return json({ error: "Workflow pausado." }, 409);
    const definition = (automation.workflow_definition || {}) as Definition;
    const errors = validate(definition);
    if (errors.length) return json({ error: "Workflow inválido.", details: errors }, 422);
    const input = body.input && typeof body.input === "object" ? body.input : {};
    const eventKey = String(body.idempotency_key || input.leadgen_id || input.id || JSON.stringify(input));
    const idempotencyKey = await sha(`${workflowId}:${automation.workflow_version || definition.version || 1}:${eventKey}`);
    const { data: existing } = await admin.from("growdash_automation_runs").select("id,status,created_at").eq("automation_id", workflowId).eq("workspace_id", automation.workspace_id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return json({ ok: true, duplicate: true, run_id: existing.id, status: existing.status });
    const { data: run, error: runError } = await admin.from("growdash_automation_runs").insert({ automation_id: workflowId, workspace_id: automation.workspace_id, trigger_event: redact(input), actions_executed: [], status: "partial", idempotency_key: idempotencyKey, started_at: new Date().toISOString() }).select("id").single();
    if (runError || !run) throw runError || new Error("Não foi possível iniciar a execução.");
    const context: Record<string, unknown> = { trigger: input, lead: input.lead || input, date: { now: new Date().toISOString() }, node: {} };
    const byId = new Map(definition.nodes.map((node) => [node.id, node]));
    const incoming = new Set(definition.connections.map((edge) => edge.target));
    const queue = definition.nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id);
    const visited = new Set<string>(); const outputs: Record<string, unknown> = {}; const executed: unknown[] = [];
    const log = async (level: string, message: string, details: Record<string, unknown> = {}) => { await admin.from("growdash_workflow_logs").insert({ run_id: run.id, workspace_id: automation.workspace_id, level, message, context: redact(details) }); };
    const edgesFrom = (nodeId: string) => definition.connections.filter((edge) => edge.source === nodeId);
    const executeNode = async (node: Node): Promise<unknown> => {
      const p = resolveObject(node.parameters || {}, context) as Record<string, unknown>;
      switch (node.type) {
        case "manual.trigger": case "webhook.trigger": case "schedule.trigger": case "lead.trigger": case "instagram.trigger": case "instagram.message.trigger": case "whatsapp.message.trigger": case "google.drive.trigger": case "google.sheets.trigger": return input;
        case "http.request": {
          const response = await fetch(safeUrl(p.url), { method: String(p.method || "POST").toUpperCase(), headers: { "Content-Type": "application/json", ...(p.headers as Record<string, string> || {}) }, body: ["GET", "HEAD"].includes(String(p.method || "POST").toUpperCase()) ? undefined : JSON.stringify(p.body || {}) });
          const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(result?.message || result?.error || response.statusText)}`); return { status: response.status, body: result };
        }
        case "condition.if": case "logic.filter": { const pass = compare(getPath(context, String(p.field || "")), String(p.operator || "contains"), p.value); return { pass, branch: pass ? "true" : "false" }; }
        case "delay.wait": { const seconds = Math.min(MAX_DELAY_SECONDS, Math.max(0, Number(p.seconds || 0))); if (seconds) await new Promise((resolveDelay) => setTimeout(resolveDelay, seconds * 1000)); return { waited_seconds: seconds }; }
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
        case "logic.stop": return { stopped: true };
        case "error.retry": case "error.fallback": case "logic.merge": case "logic.switch": case "logic.loop": case "approval.manual": case "google.sheets.append": case "google.sheets.lookup": case "google.drive.upload": case "google.drive.lookup": case "instagram.reply": case "instagram.send": case "gmail.send": case "crm.contact.upsert": case "crm.deal.create": case "crm.note.create": case "task.create": case "tag.add": case "crm.stage.change": case "seller.notify": throw new Error(`Nó ${node.type} ainda requer conexão específica no workspace.`);
        default: throw new Error(`Nó não suportado: ${node.type}`);
      }
    };
    while (queue.length && visited.size < MAX_STEPS) {
      const nodeId = queue.shift()!; if (visited.has(nodeId)) continue; const node = byId.get(nodeId); if (!node) continue;
      const started = new Date().toISOString(); const stepBase = { run_id: run.id, workspace_id: automation.workspace_id, node_id: node.id, node_type: node.type, input: redact(context), status: "running", started_at: started, attempt: 1 };
      await admin.from("growdash_workflow_run_steps").insert(stepBase);
      try {
        const output = await executeNode(node); outputs[node.id] = output; context.node = { ...context.node, [node.id]: { output } }; visited.add(node.id); executed.push({ node_id: node.id, type: node.type, status: "success" });
        await admin.from("growdash_workflow_run_steps").update({ status: "success", output: redact(output), finished_at: new Date().toISOString() }).eq("run_id", run.id).eq("node_id", node.id).eq("status", "running");
        await log("info", `Nó ${node.type} concluído`, { node_id: node.id });
        for (const edge of edgesFrom(node.id)) { const branch = (output as any)?.branch; if (node.type === "condition.if" && edge.sourcePort && edge.sourcePort !== branch) continue; queue.push(edge.target); }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido"; executed.push({ node_id: node.id, type: node.type, status: "error", error: message });
        await admin.from("growdash_workflow_run_steps").update({ status: "error", error_message: message, finished_at: new Date().toISOString() }).eq("run_id", run.id).eq("node_id", node.id).eq("status", "running"); await log("error", message, { node_id: node.id });
        await admin.from("growdash_automation_runs").update({ status: "error", actions_executed: executed, error_message: message, finished_at: new Date().toISOString() }).eq("id", run.id); return json({ ok: false, run_id: run.id, error: message, steps: executed }, 422);
      }
    }
    const status = visited.size >= MAX_STEPS ? "error" : "success";
    const finalError = status === "error" ? "Limite de 100 etapas atingido." : null;
    await admin.from("growdash_automation_runs").update({ status, actions_executed: executed, error_message: finalError, finished_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("growdash_automations").update({ run_count: (automation as any).run_count ? Number((automation as any).run_count) + 1 : 1, last_run_at: new Date().toISOString(), last_error: finalError }).eq("id", workflowId);
    return json({ ok: status === "success", run_id: run.id, status, output: redact(outputs), steps: executed });
  } catch (error) { console.error("workflow-execute", error); return json({ error: error instanceof Error ? error.message : "Erro interno do executor." }, 500); }
});
