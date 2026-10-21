import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, Clock3, Copy, FileSpreadsheet, FolderUp, Globe2, Instagram, Mail, MessageCircle, Pause, Play, Plus, Save, Split, Tag, Trash2, UserPlus, Webhook, Workflow, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { emptyWorkflow, type WorkflowDefinition, type WorkflowNode, type WorkflowNodeType } from "./workflowTypes";
import { validateWorkflowDefinition } from "./workflowValidation";

const labels: Record<WorkflowNodeType, string> = {
  "webhook.trigger": "Webhook",
  "manual.trigger": "Manual",
  "schedule.trigger": "Agendamento",
  "lead.trigger": "Novo lead",
  "instagram.message.trigger": "Nova mensagem Instagram",
  "whatsapp.message.trigger": "Nova mensagem WhatsApp",
  "google.drive.trigger": "Novo arquivo Drive",
  "google.sheets.trigger": "Nova linha Sheets",
  "http.request": "HTTP Request",
  "google.sheets.append": "Google Sheets",
  "google.sheets.lookup": "Buscar no Sheets",
  "instagram.trigger": "Instagram — gatilho",
  "instagram.reply": "Instagram — resposta",
  "instagram.send": "Enviar Instagram",
  "whatsapp.send": "WhatsApp — enviar",
  "google.drive.upload": "Google Drive — arquivo",
  "google.drive.lookup": "Buscar arquivo Drive",
  "gmail.send": "Enviar Gmail",
  "agent.run": "Agente IA",
  "crm.contact.upsert": "Criar/atualizar contato",
  "crm.deal.create": "Criar negociação",
  "crm.note.create": "Criar anotação",
  "task.create": "Criar tarefa",
  "tag.add": "Adicionar tag",
  "crm.stage.change": "Alterar etapa CRM",
  "seller.notify": "Notificar vendedor",
  "condition.if": "Condição IF",
  "logic.filter": "Filtro",
  "logic.switch": "Switch",
  "delay.wait": "Aguardar",
  "logic.loop": "Loop",
  "logic.merge": "Merge",
  "logic.stop": "Parar",
  "error.retry": "Retry",
  "error.fallback": "Fallback",
  "approval.manual": "Aprovação manual",
};
const icons: Record<WorkflowNodeType, typeof Webhook> = {
  "webhook.trigger": Webhook,
  "manual.trigger": Zap,
  "schedule.trigger": Clock3,
  "lead.trigger": UserPlus,
  "instagram.message.trigger": Instagram,
  "whatsapp.message.trigger": MessageCircle,
  "google.drive.trigger": FolderUp,
  "google.sheets.trigger": FileSpreadsheet,
  "http.request": Globe2,
  "google.sheets.append": FileSpreadsheet,
  "google.sheets.lookup": FileSpreadsheet,
  "instagram.trigger": Instagram,
  "instagram.reply": Instagram,
  "instagram.send": Instagram,
  "whatsapp.send": MessageCircle,
  "google.drive.upload": FolderUp,
  "google.drive.lookup": FolderUp,
  "gmail.send": Mail,
  "agent.run": Bot,
  "crm.contact.upsert": UserPlus,
  "crm.deal.create": Workflow,
  "crm.note.create": FileSpreadsheet,
  "task.create": CheckCircle2,
  "tag.add": Tag,
  "crm.stage.change": Workflow,
  "seller.notify": MessageCircle,
  "condition.if": Split,
  "logic.filter": Split,
  "logic.switch": Split,
  "delay.wait": Clock3,
  "logic.loop": Workflow,
  "logic.merge": Workflow,
  "logic.stop": Trash2,
  "error.retry": Zap,
  "error.fallback": Zap,
  "approval.manual": CheckCircle2,
};
const storageKey = (workspaceId?: string | null) => `growdash:automation-workflow:draft:${workspaceId || "anonymous"}`;
type AutomationRunRow = { id: string; status: string; created_at: string; error_message?: string | null };

function newNode(type: WorkflowNodeType, index: number): WorkflowNode {
  const parameters: Record<string, unknown> = type === "http.request"
    ? { method: "POST", url: "https://" }
    : type === "instagram.trigger"
      ? { event: "comment", keyword: "" }
      : type === "instagram.reply"
        ? { message: "" }
        : type === "whatsapp.send"
          ? { phone: "", message: "" }
          : type === "google.drive.upload"
            ? { fileUrl: "", folderId: "" }
            : type === "agent.run"
              ? { prompt: "", output: "text" }
              : type === "condition.if"
                ? { field: "", operator: "contains", value: "" }
                : type === "delay.wait"
                  ? { seconds: 60 }
                  : {};
  return { id: `${type.split(".")[0]}-${Date.now()}-${index}`, type, position: { x: index * 250, y: 80 }, parameters };
}

export function WorkflowEditor() {
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey()) || "") as WorkflowDefinition; } catch { return emptyWorkflow(); }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ status?: string; run_id?: string; error?: string } | null>(null);
  const [runs, setRuns] = useState<Array<{ id: string; status: string; created_at: string; error_message?: string | null }>>([]);
  const [loadedWorkspace, setLoadedWorkspace] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState({ source: "", target: "", sourcePort: "" });
  const selected = workflow.nodes.find((node) => node.id === selectedId) ?? null;
  const validation = useMemo(() => validateWorkflowDefinition(workflow), [workflow]);
  const StatusIcon = workflow.active ? Pause : Play;

  const loadRuns = useCallback(async () => {
    if (!workspace?.id || workspace.id.startsWith("legacy-")) return;
    // These tables are newer than the generated Supabase type snapshot.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data } = await client.from("growdash_automation_runs").select("id,status,created_at,error_message").eq("automation_id", workflow.id).order("created_at", { ascending: false }).limit(5);
    setRuns((data || []) as AutomationRunRow[]);
  }, [workflow.id, workspace?.id]);

  useEffect(() => {
    if (!workspace?.id || !user?.id || workspace.id.startsWith("legacy-") || loadedWorkspace === workspace.id) return;
    setLoadedWorkspace(workspace.id);
    void (async () => {
      // These tables are newer than the generated Supabase type snapshot.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data } = await client.from("growdash_automations").select("id,name,status,workflow_definition,workflow_version").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const saved = data?.workflow_definition;
      if (saved && validateWorkflowDefinition(saved).ok) {
        const next = { ...saved, active: data.status === "active", version: Number(data.workflow_version || saved.version || 1) } as WorkflowDefinition;
        setWorkflow(next); localStorage.setItem(storageKey(workspace.id), JSON.stringify(next));
      }
    })();
  }, [workspace?.id, user?.id, loadedWorkspace]);
  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const addNode = (type: WorkflowNodeType) => {
    const node = newNode(type, workflow.nodes.length);
    setWorkflow((current) => ({ ...current, nodes: [...current.nodes, node], connections: current.nodes.length ? [...current.connections, { source: current.nodes[current.nodes.length - 1].id, target: node.id }] : current.connections }));
    setSelectedId(node.id);
    setMessage("");
  };
  const updateSelected = (parameters: Record<string, unknown>) => setWorkflow((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, parameters } : node) }));
  const removeSelected = () => { if (!selectedId) return; setWorkflow((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selectedId), connections: current.connections.filter((edge) => edge.source !== selectedId && edge.target !== selectedId) })); setSelectedId(null); };
  const addConnection = () => {
    const { source, target, sourcePort } = connectionDraft;
    if (!source || !target || source === target) return;
    setWorkflow((current) => current.connections.some((edge) => edge.source === source && edge.target === target && edge.sourcePort === (sourcePort || undefined))
      ? current
      : { ...current, connections: [...current.connections, { source, target, ...(sourcePort ? { sourcePort } : {}) }] });
  };
  const removeConnection = (index: number) => setWorkflow((current) => ({ ...current, connections: current.connections.filter((_, itemIndex) => itemIndex !== index) }));
  const save = async (nextStatus?: "draft" | "active" | "paused") => {
    if (!validation.ok) { setMessage(validation.errors.join(" ")); return; }
    localStorage.setItem(storageKey(workspace?.id), JSON.stringify(workflow));
    if (!workspace?.id || !user?.id || workspace.id.startsWith("legacy-")) { setMessage("Rascunho salvo neste navegador; conecte um workspace para persistir na conta."); return; }
    const client = supabase as unknown as { from: (table: string) => { upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message: string } | null }> } };
    const status = nextStatus || (workflow.active ? "active" : "draft");
    const nextWorkflow = { ...workflow, active: status === "active" };
    setWorkflow(nextWorkflow);
    const trigger = workflow.nodes.find((node) => node.type.endsWith(".trigger"));
    const triggerType = trigger?.type === "webhook.trigger" ? "manual" : trigger?.type === "lead.trigger" ? "new_lead" : trigger?.type === "instagram.message.trigger" ? "instagram_message" : trigger?.type === "instagram.trigger" ? "instagram_comment" : "manual";
    const triggerConfig = trigger?.parameters || {};
    const { error } = await client.from("growdash_automations").upsert({ id: workflow.id, workspace_id: workspace.id, created_by: user.id, name: workflow.name.trim(), description: "Workflow visual Growdash", trigger_type: triggerType, trigger_config: triggerConfig, actions: [], status, workflow_definition: nextWorkflow, workflow_version: workflow.version, current_version: workflow.version, published_at: status === "active" ? new Date().toISOString() : null }, { onConflict: "id" });
    if (!error) {
      await client.from("growdash_workflow_versions").upsert({ workflow_id: workflow.id, workspace_id: workspace.id, version: workflow.version, definition: nextWorkflow, status: status === "active" ? "published" : "draft", created_by: user.id }, { onConflict: "workflow_id,version" });
      if (trigger?.type === "webhook.trigger" && status === "active") {
        const pathToken = String(trigger.parameters.pathToken || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
        const secret = String(trigger.parameters.secret || "").trim() || null;
        const secretHash = secret ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))), (byte) => byte.toString(16).padStart(2, "0")).join("") : null;
        const webhookClient = supabase as unknown as { from: (table: string) => { upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<unknown> } };
        await webhookClient.from("growdash_workflow_webhooks").upsert({ workflow_id: workflow.id, workspace_id: workspace.id, path_token: pathToken, secret_hash: secretHash, status: "active" }, { onConflict: "workflow_id" });
        setMessage(`Workflow salvo. Webhook: /functions/v1/workflow-webhook/${pathToken}`);
      }
    }
    setMessage(error ? `Rascunho local salvo. Banco: ${error.message}` : "Workflow salvo no workspace.");
  };

  const execute = async () => {
    if (!workspace?.id || !user?.id || workspace.id.startsWith("legacy-")) { setMessage("Conecte um workspace para testar o executor."); return; }
    if (!validation.ok) { setMessage(validation.errors.join(" ")); return; }
    setRunning(true); setRunResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("workflow-execute", { body: { workflow_id: workflow.id, mode: "test", input: { source: "manual_test", timestamp: new Date().toISOString() }, idempotency_key: `manual-test:${Date.now()}` } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setRunResult(data); setMessage(`Execução ${data?.status === "success" ? "concluída" : "finalizada com erro"}. Run: ${data?.run_id || "-"}`);
      await loadRuns();
    } catch (error) { setRunResult({ status: "error", error: error instanceof Error ? error.message : "Falha na execução" }); setMessage(error instanceof Error ? error.message : "Falha na execução"); }
    finally { setRunning(false); }
  };
  const duplicate = () => { const suffix = `-copy-${Date.now()}`; const idMap = new Map(workflow.nodes.map((node) => [node.id, `${node.id}${suffix}`])); const copy = { ...workflow, id: crypto.randomUUID(), name: `${workflow.name} — cópia`, version: 1, active: false, nodes: workflow.nodes.map((node) => ({ ...node, id: idMap.get(node.id)! })), connections: workflow.connections.map((edge) => ({ ...edge, source: idMap.get(edge.source) || edge.source, target: idMap.get(edge.target) || edge.target })) }; localStorage.setItem(storageKey(workspace?.id), JSON.stringify(copy)); setWorkflow(copy); setSelectedId(null); setMessage("Cópia criada como rascunho."); };

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section className="gd-panel min-h-[560px] overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><div><h2 className="font-black">Editor visual</h2><p className="text-xs text-muted-foreground">Monte o fluxo, teste e publique com histórico de execução.</p></div><div className="flex flex-wrap gap-2"><Input className="h-9 w-44" value={workflow.name} onChange={(event) => setWorkflow((current) => ({ ...current, name: event.target.value }))} aria-label="Nome do workflow" /><Button size="sm" variant="outline" onClick={duplicate}><Copy className="mr-2 h-3.5 w-3.5" />Duplicar</Button><Button size="sm" variant="outline" onClick={execute} disabled={running}><Play className="mr-2 h-3.5 w-3.5" />{running ? "Executando" : "Testar"}</Button><Button size="sm" onClick={() => void save()}><Save className="mr-2 h-3.5 w-3.5" />Salvar</Button><Button size="sm" variant={workflow.active ? "outline" : "default"} onClick={() => void save(workflow.active ? "paused" : "active")}><StatusIcon className="mr-2 h-3.5 w-3.5" />{workflow.active ? "Pausar" : "Ativar"}</Button></div></div>
      <div className="mt-4 flex min-h-[440px] flex-wrap content-start items-start gap-4 rounded-xl border border-dashed border-border bg-background/40 p-6">
        {workflow.nodes.length === 0 && <div className="m-auto max-w-sm text-center text-sm text-muted-foreground">Adicione um nó à esquerda para começar.</div>}
        {workflow.nodes.map((node, index) => { const Icon = icons[node.type]; return <div key={node.id} className="flex items-center gap-3"><button type="button" onClick={() => setSelectedId(node.id)} className={cn("w-48 rounded-xl border p-4 text-left transition", selectedId === node.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/50")}><span className="flex items-center gap-2 text-xs font-black"><Icon className="h-4 w-4 text-primary" />{labels[node.type]}</span><span className="mt-2 block truncate text-[10px] text-muted-foreground">{node.type === "http.request" ? String(node.parameters.url || "URL não configurada") : node.type === "whatsapp.send" ? "Enviar mensagem" : node.type === "agent.run" ? "Executar instrução" : node.type === "condition.if" ? "Avaliar condição" : node.type === "delay.wait" ? `${String(node.parameters.seconds || 0)} segundos` : node.type.endsWith("trigger") ? "Receber evento" : "Executar ação"}</span></button>{index < workflow.nodes.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}</div>; })}
      </div>
      {message && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-xs text-primary">{message}</p>}
      {runResult && <div className={cn("mt-3 rounded-lg p-3 text-xs", runResult.status === "success" ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive")}><strong>Última execução: {runResult.status}</strong>{runResult.error && <span className="ml-2">{runResult.error}</span>}</div>}
      {runs.length > 0 && <div className="mt-3 rounded-lg border border-border p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Histórico recente</span><button type="button" className="text-[10px] text-primary" onClick={() => void loadRuns()}>Atualizar</button></div><div className="grid gap-1.5">{runs.map((run) => <div key={run.id} className="flex items-center justify-between gap-2 text-[10px]"><span className={cn("rounded px-1.5 py-0.5 font-bold", run.status === "success" ? "bg-emerald-500/15 text-emerald-700" : run.status === "error" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{run.status}</span><span className="truncate text-muted-foreground">{new Date(run.created_at).toLocaleString("pt-BR")}</span><code className="hidden truncate text-muted-foreground sm:block">{run.id.slice(0, 8)}</code></div>)}</div></div>}
      {!validation.ok && workflow.nodes.length > 0 && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{validation.errors.join(" ")}</p>}
    </section>
    <aside className="space-y-4">
      <section className="gd-panel p-4"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Adicionar nó</h3><div className="mt-3 grid gap-2">{(Object.keys(labels) as WorkflowNodeType[]).map((type) => { const Icon = icons[type]; return <Button key={type} variant="outline" className="justify-start" onClick={() => addNode(type)}><Plus className="mr-2 h-4 w-4" /><Icon className="mr-2 h-4 w-4 text-primary" />{labels[type]}</Button>; })}</div></section>
      <section className="gd-panel p-4"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Conexões</h3><div className="mt-3 grid gap-2"><select className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="Nó de origem" value={connectionDraft.source} onChange={(event) => setConnectionDraft((current) => ({ ...current, source: event.target.value }))}><option value="">Origem</option>{workflow.nodes.map((node) => <option key={node.id} value={node.id}>{labels[node.type]} · {node.id.slice(-6)}</option>)}</select><select className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="Nó de destino" value={connectionDraft.target} onChange={(event) => setConnectionDraft((current) => ({ ...current, target: event.target.value }))}><option value="">Destino</option>{workflow.nodes.map((node) => <option key={node.id} value={node.id}>{labels[node.type]} · {node.id.slice(-6)}</option>)}</select><select className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="Saída da conexão" value={connectionDraft.sourcePort} onChange={(event) => setConnectionDraft((current) => ({ ...current, sourcePort: event.target.value }))}><option value="">Saída padrão</option><option value="true">true</option><option value="false">false</option><option value="default">default</option></select><Button type="button" size="sm" variant="outline" onClick={addConnection} disabled={!connectionDraft.source || !connectionDraft.target}>Adicionar conexão</Button></div><div className="mt-3 grid gap-1.5">{workflow.connections.map((edge, index) => <div key={`${edge.source}-${edge.target}-${index}`} className="flex items-center gap-2 text-[10px]"><span className="min-w-0 grow truncate">{edge.source.slice(-6)} → {edge.target.slice(-6)}{edge.sourcePort ? ` (${edge.sourcePort})` : ""}</span><button type="button" className="text-destructive" onClick={() => removeConnection(index)} aria-label="Remover conexão">×</button></div>)}</div></section>
      <section className="gd-panel p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Configuração</h3>{selected && <Button variant="ghost" size="icon" onClick={removeSelected} aria-label="Excluir nó"><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>{selected ? <NodeForm node={selected} onChange={updateSelected} /> : <p className="mt-3 text-xs text-muted-foreground">Selecione um nó no canvas.</p>}</section>
    </aside>
  </div>;
}

function NodeForm({ node, onChange }: { node: WorkflowNode; onChange: (parameters: Record<string, unknown>) => void }) {
  if (node.type === "http.request") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">URL<Input value={String(node.parameters.url || "")} onChange={(event) => onChange({ ...node.parameters, url: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Método<Input value={String(node.parameters.method || "POST")} onChange={(event) => onChange({ ...node.parameters, method: event.target.value.toUpperCase() })} /></label><label className="grid gap-1 text-xs font-bold">Corpo JSON<Textarea value={String(node.parameters.body || "")} onChange={(event) => onChange({ ...node.parameters, body: event.target.value })} placeholder='{"lead_id":"{{id}}"}' /></label></div>;
  if (node.type === "google.sheets.append") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">ID da planilha<Input value={String(node.parameters.spreadsheetId || "")} onChange={(event) => onChange({ ...node.parameters, spreadsheetId: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Aba<Input value={String(node.parameters.sheetName || "Leads")} onChange={(event) => onChange({ ...node.parameters, sheetName: event.target.value })} /></label></div>;
  if (node.type === "google.sheets.lookup") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">ID da planilha<Input value={String(node.parameters.spreadsheetId || "")} onChange={(event) => onChange({ ...node.parameters, spreadsheetId: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Aba<Input value={String(node.parameters.sheetName || "Leads")} onChange={(event) => onChange({ ...node.parameters, sheetName: event.target.value })} /></label></div>;
  if (node.type === "instagram.trigger") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Evento<Input value={String(node.parameters.event || "comment")} onChange={(event) => onChange({ ...node.parameters, event: event.target.value })} placeholder="comment ou message" /></label><label className="grid gap-1 text-xs font-bold">Palavra-chave opcional<Input value={String(node.parameters.keyword || "")} onChange={(event) => onChange({ ...node.parameters, keyword: event.target.value })} /></label></div>;
  if (node.type === "webhook.trigger") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Token do caminho<Input value={String(node.parameters.pathToken || "")} onChange={(event) => onChange({ ...node.parameters, pathToken: event.target.value })} placeholder="gerado ao ativar" /></label><label className="grid gap-1 text-xs font-bold">Secret opcional<Input type="password" value={String(node.parameters.secret || "")} onChange={(event) => onChange({ ...node.parameters, secret: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">Envie o secret no cabeçalho <code>x-workflow-secret</code>.</p></div>;
  if (node.type === "instagram.reply") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Mensagem<Textarea value={String(node.parameters.message || "")} onChange={(event) => onChange({ ...node.parameters, message: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">Usa a conta Instagram conectada à Growdash e as permissões aprovadas pela Meta.</p></div>;
  if (node.type === "instagram.send") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">ID do destinatário<Input value={String(node.parameters.recipientId || "")} onChange={(event) => onChange({ ...node.parameters, recipientId: event.target.value })} placeholder="{{trigger.sender_id}}" /></label><label className="grid gap-1 text-xs font-bold">Mensagem<Textarea value={String(node.parameters.message || "")} onChange={(event) => onChange({ ...node.parameters, message: event.target.value })} /></label></div>;
  if (node.type === "whatsapp.send") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Telefone ou campo dinâmico<Input value={String(node.parameters.phone || "")} onChange={(event) => onChange({ ...node.parameters, phone: event.target.value })} placeholder="{{lead.whatsapp}}" /></label><label className="grid gap-1 text-xs font-bold">Mensagem<Textarea value={String(node.parameters.message || "")} onChange={(event) => onChange({ ...node.parameters, message: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">O envio usa a conexão oficial de WhatsApp configurada no workspace.</p></div>;
  if (node.type === "google.drive.upload") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Arquivo ou URL dinâmica<Input value={String(node.parameters.fileUrl || "")} onChange={(event) => onChange({ ...node.parameters, fileUrl: event.target.value })} placeholder="{{arquivo.url}}" /></label><label className="grid gap-1 text-xs font-bold">Pasta do Drive (opcional)<Input value={String(node.parameters.folderId || "")} onChange={(event) => onChange({ ...node.parameters, folderId: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">Usa a conta Google Workspace conectada à Growdash.</p></div>;
  if (node.type === "google.drive.lookup") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Nome ou busca no Drive<Input value={String(node.parameters.query || "")} onChange={(event) => onChange({ ...node.parameters, query: event.target.value })} placeholder="contrato" /></label></div>;
  if (node.type === "gmail.send") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Destinatário<Input type="email" value={String(node.parameters.to || "")} onChange={(event) => onChange({ ...node.parameters, to: event.target.value })} placeholder="{{lead.email}}" /></label><label className="grid gap-1 text-xs font-bold">Assunto<Input value={String(node.parameters.subject || "")} onChange={(event) => onChange({ ...node.parameters, subject: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Mensagem HTML<Textarea value={String(node.parameters.html || "")} onChange={(event) => onChange({ ...node.parameters, html: event.target.value })} /></label></div>;
  if (node.type === "agent.run") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Instrução do agente<Textarea value={String(node.parameters.prompt || "")} onChange={(event) => onChange({ ...node.parameters, prompt: event.target.value })} placeholder="Analise o lead e classifique o próximo passo." /></label><label className="grid gap-1 text-xs font-bold">Saída<Input value={String(node.parameters.output || "text")} onChange={(event) => onChange({ ...node.parameters, output: event.target.value })} placeholder="text ou json" /></label></div>;
  if (node.type === "condition.if") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Campo dinâmico<Input value={String(node.parameters.field || "")} onChange={(event) => onChange({ ...node.parameters, field: event.target.value })} placeholder="lead.interesse" /></label><label className="grid gap-1 text-xs font-bold">Operador<Input value={String(node.parameters.operator || "contains")} onChange={(event) => onChange({ ...node.parameters, operator: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Valor<Input value={String(node.parameters.value || "")} onChange={(event) => onChange({ ...node.parameters, value: event.target.value })} /></label></div>;
  if (node.type === "logic.switch") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Campo dinâmico<Input value={String(node.parameters.field || "")} onChange={(event) => onChange({ ...node.parameters, field: event.target.value })} placeholder="lead.status" /></label><label className="grid gap-1 text-xs font-bold">Casos JSON<Textarea value={String(node.parameters.cases ? JSON.stringify(node.parameters.cases, null, 2) : "[]")} onChange={(event) => { try { onChange({ ...node.parameters, cases: JSON.parse(event.target.value) }); } catch { /* mantém o último JSON válido */ } }} placeholder='[{"value":"won","port":"won"}]' /></label></div>;
  if (node.type === "delay.wait") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Segundos<Input type="number" min="1" value={String(node.parameters.seconds || 60)} onChange={(event) => onChange({ ...node.parameters, seconds: Number(event.target.value) })} /></label></div>;
  return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Parâmetros JSON<Textarea value={JSON.stringify(node.parameters, null, 2)} onChange={(event) => { try { onChange(JSON.parse(event.target.value)); } catch { /* mantém o último JSON válido */ } }} /></label><p className="text-[10px] text-muted-foreground">Use variáveis como <code>{"{{lead.email}}"}</code> para dados do evento.</p></div>;
}
