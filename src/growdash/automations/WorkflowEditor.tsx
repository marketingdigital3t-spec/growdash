import { useMemo, useState } from "react";
import { ArrowRight, Bot, Clock3, FileSpreadsheet, FolderUp, Globe2, Instagram, MessageCircle, Plus, Save, Split, Trash2, Webhook } from "lucide-react";
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
  "http.request": "HTTP Request",
  "google.sheets.append": "Google Sheets",
  "instagram.trigger": "Instagram — gatilho",
  "instagram.reply": "Instagram — resposta",
  "whatsapp.send": "WhatsApp — enviar",
  "google.drive.upload": "Google Drive — arquivo",
  "agent.run": "Agente IA",
  "condition.if": "Condição IF",
  "delay.wait": "Aguardar",
};
const icons: Record<WorkflowNodeType, typeof Webhook> = {
  "webhook.trigger": Webhook,
  "http.request": Globe2,
  "google.sheets.append": FileSpreadsheet,
  "instagram.trigger": Instagram,
  "instagram.reply": Instagram,
  "whatsapp.send": MessageCircle,
  "google.drive.upload": FolderUp,
  "agent.run": Bot,
  "condition.if": Split,
  "delay.wait": Clock3,
};
const storageKey = "growdash:automation-workflow:draft";

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
    try { return JSON.parse(localStorage.getItem(storageKey) || "") as WorkflowDefinition; } catch { return emptyWorkflow(); }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const selected = workflow.nodes.find((node) => node.id === selectedId) ?? null;
  const validation = useMemo(() => validateWorkflowDefinition(workflow), [workflow]);

  const addNode = (type: WorkflowNodeType) => {
    const node = newNode(type, workflow.nodes.length);
    setWorkflow((current) => ({ ...current, nodes: [...current.nodes, node], connections: current.nodes.length ? [...current.connections, { source: current.nodes[current.nodes.length - 1].id, target: node.id }] : current.connections }));
    setSelectedId(node.id);
    setMessage("");
  };
  const updateSelected = (parameters: Record<string, unknown>) => setWorkflow((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, parameters } : node) }));
  const removeSelected = () => { if (!selectedId) return; setWorkflow((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selectedId), connections: current.connections.filter((edge) => edge.source !== selectedId && edge.target !== selectedId) })); setSelectedId(null); };
  const save = async () => {
    if (!validation.ok) { setMessage(validation.errors.join(" ")); return; }
    localStorage.setItem(storageKey, JSON.stringify(workflow));
    if (!workspace?.id || !user?.id || workspace.id.startsWith("legacy-")) { setMessage("Rascunho salvo neste navegador; conecte um workspace para persistir na conta."); return; }
    const client = supabase as unknown as { from: (table: string) => { upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message: string } | null }> } };
    const { error } = await client.from("growdash_automations").upsert({ id: workflow.id, workspace_id: workspace.id, created_by: user.id, name: workflow.name.trim(), description: "Workflow visual Growdash", trigger_type: "manual", trigger_config: {}, actions: [], status: workflow.active ? "active" : "draft", workflow_definition: workflow, workflow_version: workflow.version }, { onConflict: "id" });
    setMessage(error ? `Rascunho local salvo. Banco: ${error.message}` : "Workflow salvo no workspace.");
  };

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section className="gd-panel min-h-[560px] overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><div><h2 className="font-black">Editor visual</h2><p className="text-xs text-muted-foreground">Monte o fluxo e configure cada nó.</p></div><div className="flex gap-2"><Input className="h-9 w-44" value={workflow.name} onChange={(event) => setWorkflow((current) => ({ ...current, name: event.target.value }))} aria-label="Nome do workflow" /><Button size="sm" onClick={save}><Save className="mr-2 h-3.5 w-3.5" />Salvar</Button></div></div>
      <div className="mt-4 flex min-h-[440px] flex-wrap content-start items-start gap-4 rounded-xl border border-dashed border-border bg-background/40 p-6">
        {workflow.nodes.length === 0 && <div className="m-auto max-w-sm text-center text-sm text-muted-foreground">Adicione um nó à esquerda para começar.</div>}
        {workflow.nodes.map((node, index) => { const Icon = icons[node.type]; return <div key={node.id} className="flex items-center gap-3"><button type="button" onClick={() => setSelectedId(node.id)} className={cn("w-48 rounded-xl border p-4 text-left transition", selectedId === node.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/50")}><span className="flex items-center gap-2 text-xs font-black"><Icon className="h-4 w-4 text-primary" />{labels[node.type]}</span><span className="mt-2 block truncate text-[10px] text-muted-foreground">{node.type === "http.request" ? String(node.parameters.url || "URL não configurada") : node.type === "whatsapp.send" ? "Enviar mensagem" : node.type === "agent.run" ? "Executar instrução" : node.type === "condition.if" ? "Avaliar condição" : node.type === "delay.wait" ? `${String(node.parameters.seconds || 0)} segundos` : node.type.endsWith("trigger") ? "Receber evento" : "Executar ação"}</span></button>{index < workflow.nodes.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}</div>; })}
      </div>
      {message && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-xs text-primary">{message}</p>}
      {!validation.ok && workflow.nodes.length > 0 && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{validation.errors.join(" ")}</p>}
    </section>
    <aside className="space-y-4">
      <section className="gd-panel p-4"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Adicionar nó</h3><div className="mt-3 grid gap-2">{(Object.keys(labels) as WorkflowNodeType[]).map((type) => { const Icon = icons[type]; return <Button key={type} variant="outline" className="justify-start" onClick={() => addNode(type)}><Plus className="mr-2 h-4 w-4" /><Icon className="mr-2 h-4 w-4 text-primary" />{labels[type]}</Button>; })}</div></section>
      <section className="gd-panel p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Configuração</h3>{selected && <Button variant="ghost" size="icon" onClick={removeSelected} aria-label="Excluir nó"><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>{selected ? <NodeForm node={selected} onChange={updateSelected} /> : <p className="mt-3 text-xs text-muted-foreground">Selecione um nó no canvas.</p>}</section>
    </aside>
  </div>;
}

function NodeForm({ node, onChange }: { node: WorkflowNode; onChange: (parameters: Record<string, unknown>) => void }) {
  if (node.type === "http.request") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">URL<Input value={String(node.parameters.url || "")} onChange={(event) => onChange({ ...node.parameters, url: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Método<Input value={String(node.parameters.method || "POST")} onChange={(event) => onChange({ ...node.parameters, method: event.target.value.toUpperCase() })} /></label><label className="grid gap-1 text-xs font-bold">Corpo JSON<Textarea value={String(node.parameters.body || "")} onChange={(event) => onChange({ ...node.parameters, body: event.target.value })} placeholder='{"lead_id":"{{id}}"}' /></label></div>;
  if (node.type === "google.sheets.append") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">ID da planilha<Input value={String(node.parameters.spreadsheetId || "")} onChange={(event) => onChange({ ...node.parameters, spreadsheetId: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Aba<Input value={String(node.parameters.sheetName || "Leads")} onChange={(event) => onChange({ ...node.parameters, sheetName: event.target.value })} /></label></div>;
  if (node.type === "instagram.trigger") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Evento<Input value={String(node.parameters.event || "comment")} onChange={(event) => onChange({ ...node.parameters, event: event.target.value })} placeholder="comment ou message" /></label><label className="grid gap-1 text-xs font-bold">Palavra-chave opcional<Input value={String(node.parameters.keyword || "")} onChange={(event) => onChange({ ...node.parameters, keyword: event.target.value })} /></label></div>;
  if (node.type === "instagram.reply") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Mensagem<Textarea value={String(node.parameters.message || "")} onChange={(event) => onChange({ ...node.parameters, message: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">Usa a conta Instagram conectada à Growdash e as permissões aprovadas pela Meta.</p></div>;
  if (node.type === "whatsapp.send") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Telefone ou campo dinâmico<Input value={String(node.parameters.phone || "")} onChange={(event) => onChange({ ...node.parameters, phone: event.target.value })} placeholder="{{lead.whatsapp}}" /></label><label className="grid gap-1 text-xs font-bold">Mensagem<Textarea value={String(node.parameters.message || "")} onChange={(event) => onChange({ ...node.parameters, message: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">O envio usa a conexão oficial de WhatsApp configurada no workspace.</p></div>;
  if (node.type === "google.drive.upload") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Arquivo ou URL dinâmica<Input value={String(node.parameters.fileUrl || "")} onChange={(event) => onChange({ ...node.parameters, fileUrl: event.target.value })} placeholder="{{arquivo.url}}" /></label><label className="grid gap-1 text-xs font-bold">Pasta do Drive (opcional)<Input value={String(node.parameters.folderId || "")} onChange={(event) => onChange({ ...node.parameters, folderId: event.target.value })} /></label><p className="text-[10px] text-muted-foreground">Usa a conta Google Workspace conectada à Growdash.</p></div>;
  if (node.type === "agent.run") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Instrução do agente<Textarea value={String(node.parameters.prompt || "")} onChange={(event) => onChange({ ...node.parameters, prompt: event.target.value })} placeholder="Analise o lead e classifique o próximo passo." /></label><label className="grid gap-1 text-xs font-bold">Saída<Input value={String(node.parameters.output || "text")} onChange={(event) => onChange({ ...node.parameters, output: event.target.value })} placeholder="text ou json" /></label></div>;
  if (node.type === "condition.if") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Campo dinâmico<Input value={String(node.parameters.field || "")} onChange={(event) => onChange({ ...node.parameters, field: event.target.value })} placeholder="lead.interesse" /></label><label className="grid gap-1 text-xs font-bold">Operador<Input value={String(node.parameters.operator || "contains")} onChange={(event) => onChange({ ...node.parameters, operator: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Valor<Input value={String(node.parameters.value || "")} onChange={(event) => onChange({ ...node.parameters, value: event.target.value })} /></label></div>;
  if (node.type === "delay.wait") return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Segundos<Input type="number" min="1" value={String(node.parameters.seconds || 60)} onChange={(event) => onChange({ ...node.parameters, seconds: Number(event.target.value) })} /></label></div>;
  return <div className="mt-3 grid gap-3"><label className="grid gap-1 text-xs font-bold">Rota<Input value={String(node.parameters.path || "/webhook/lead")} onChange={(event) => onChange({ ...node.parameters, path: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Método<Input value={String(node.parameters.method || "POST")} onChange={(event) => onChange({ ...node.parameters, method: event.target.value.toUpperCase() })} /></label></div>;
}
