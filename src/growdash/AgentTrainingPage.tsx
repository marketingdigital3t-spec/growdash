import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, BookOpen, Check, Clock3, ExternalLink, FileText, Plus, Save, Sparkles, Trash2, Upload, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AgentMode = "ai" | "ai_handoff" | "human_assist";
type KnowledgeContract = { version: 1; content: string };
type Agent = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  mode: AgentMode;
  model: string;
  system_prompt: string;
  knowledge: KnowledgeContract | Record<string, unknown> | null;
};

type AgentForm = {
  id: string;
  name: string;
  mode: AgentMode;
  model: string;
  systemPrompt: string;
  knowledge: string;
};

type WorkspaceFile = {
  id: string;
  bucket_id: string | null;
  object_path: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

type Followup = {
  id: string;
  sequence_no: number;
  scheduled_at: string;
  status: "pending" | "processing" | "sent" | "cancelled" | "failed";
  reason: string;
  message_body: string | null;
};

type QueryResult<T> = { data: T | null; error: { message: string } | null };
type AgentQuery = {
  select: (columns: string) => AgentQuery;
  eq: (column: string, value: unknown) => AgentQuery;
  order: (column: string, options?: { ascending?: boolean }) => AgentQuery;
  update: (payload: Record<string, unknown>) => AgentQuery;
  insert: (payload: Record<string, unknown>) => AgentQuery;
  single: () => AgentQuery;
};
type AgentClient = { from: (table: string) => AgentQuery };
type TableQuery = {
  select: (columns: string) => TableQuery;
  eq: (column: string, value: unknown) => TableQuery;
  neq: (column: string, value: unknown) => TableQuery;
  order: (column: string, options?: { ascending?: boolean }) => TableQuery;
  update: (payload: Record<string, unknown>) => TableQuery;
  insert: (payload: Record<string, unknown>) => TableQuery;
} & PromiseLike<QueryResult<unknown>>;
type TableClient = { from: (table: string) => TableQuery };

const emptyForm: AgentForm = { id: "", name: "", mode: "ai_handoff", model: "gpt-4o-mini", systemPrompt: "", knowledge: "" };

function knowledgeText(value: Agent["knowledge"]): string {
  if (!value || typeof value !== "object") return "";
  if ("content" in value && typeof value.content === "string") return value.content;
  return Object.entries(value).map(([key, item]) => `${key}: ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
}

function formFromAgent(agent: Agent): AgentForm {
  return { id: agent.id, name: agent.name, mode: agent.mode, model: agent.model, systemPrompt: agent.system_prompt, knowledge: knowledgeText(agent.knowledge) };
}

export default function AgentTrainingPage() {
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = workspace?.id;
  const isAdmin = workspace?.role === "owner" || workspace?.role === "admin";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const fileInput = useRef<HTMLInputElement>(null);

  const agents = useQuery({
    queryKey: ["whatsapp_agents_training", workspaceId],
    enabled: !!workspaceId && isAdmin,
    queryFn: async () => {
      const result = await (supabase as unknown as AgentClient)
        .from("whatsapp_agents")
        .select("id,name,status,mode,model,system_prompt,knowledge")
        .eq("workspace_id", workspaceId)
        .order("name") as unknown as QueryResult<Agent[]>;
      const { data, error } = result;
      if (error) throw error;
      return (data || []) as Agent[];
    },
  });

  const selected = useMemo(() => agents.data?.find((agent) => agent.id === selectedId) || null, [agents.data, selectedId]);

  const files = useQuery({
    queryKey: ["agent-knowledge-files", workspaceId, selectedId],
    enabled: !!workspaceId && !!selectedId && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as TableClient).from("workspace_files")
        .select("id,bucket_id,object_path,original_name,mime_type,size_bytes,created_at")
        .eq("workspace_id", workspaceId)
        .eq("module", "agent_knowledge")
        .eq("entity_type", "whatsapp_agent")
        .eq("entity_id", selectedId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WorkspaceFile[];
    },
  });

  const followups = useQuery({
    queryKey: ["agent-followups", workspaceId, selectedId],
    enabled: !!workspaceId && !!selectedId && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as TableClient).from("whatsapp_followups")
        .select("id,sequence_no,scheduled_at,status,reason,message_body")
        .eq("workspace_id", workspaceId)
        .eq("agent_id", selectedId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Followup[];
    },
  });

  useEffect(() => {
    if (selected) setForm(formFromAgent(selected));
  }, [selected]);

  const save = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !user?.id) throw new Error("Workspace não carregado.");
      const name = form.name.trim();
      if (!name) throw new Error("Informe o nome do expert.");
      const payload = {
        workspace_id: workspaceId,
        name,
        status: "active",
        mode: form.mode,
        model: form.model.trim() || "gpt-4o-mini",
        system_prompt: form.systemPrompt.trim(),
        knowledge: { version: 1, content: form.knowledge.trim() },
        created_by: user.id,
      };
      if (form.id) {
        const result = await (supabase as unknown as AgentClient).from("whatsapp_agents").update(payload).eq("id", form.id).eq("workspace_id", workspaceId) as unknown as QueryResult<null>;
        const { error } = result;
        if (error) throw error;
        return form.id;
      }
      const result = await (supabase as unknown as AgentClient).from("whatsapp_agents").insert(payload).select("id").single() as unknown as QueryResult<{ id: string }>;
      const { data, error } = result;
      if (error) throw error;
      if (!data) throw new Error("O expert foi salvo, mas não retornou um identificador.");
      return data.id;
    },
    onSuccess: (id) => {
      setSelectedId(id);
      setForm((current) => ({ ...current, id }));
      void agents.refetch();
      toast.success("Treinamento salvo", { description: "A IA usará este conhecimento nas próximas respostas do expert." });
    },
    onError: (error: Error) => toast.error("Não foi possível salvar", { description: error.message }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!workspaceId || !selectedId || !user?.id) throw new Error("Selecione e salve um expert antes de enviar arquivos.");
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Envie somente arquivos PDF.");
      if (file.size > 100 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 100 MB.");
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
      const path = `${workspaceId}/agent-knowledge/${selectedId}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage.from("workspace-files").upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (storageError) throw storageError;
      const { error: registryError } = await (supabase as unknown as TableClient).from("workspace_files").insert({
        workspace_id: workspaceId,
        owner_id: user.id,
        bucket_id: "workspace-files",
        object_path: path,
        original_name: file.name,
        mime_type: "application/pdf",
        size_bytes: file.size,
        module: "agent_knowledge",
        entity_type: "whatsapp_agent",
        entity_id: selectedId,
        source: "upload",
        status: "active",
        metadata: { agent_name: form.name },
      });
      if (registryError) {
        await supabase.storage.from("workspace-files").remove([path]);
        throw registryError;
      }
    },
    onSuccess: () => {
      void files.refetch();
      toast.success("PDF adicionado", { description: "O arquivo ficou vinculado somente a este expert." });
    },
    onError: (error: Error) => toast.error("Não foi possível enviar o PDF", { description: error.message }),
  });

  const deleteFile = useMutation({
    mutationFn: async (file: WorkspaceFile) => {
      if (!file.bucket_id || !file.object_path) throw new Error("Arquivo sem caminho no Storage.");
      const { error: storageError } = await supabase.storage.from(file.bucket_id).remove([file.object_path]);
      if (storageError) throw storageError;
      const { error } = await (supabase as unknown as TableClient).from("workspace_files").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", file.id).eq("workspace_id", workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      void files.refetch();
      toast.success("PDF removido");
    },
    onError: (error: Error) => toast.error("Não foi possível remover o PDF", { description: error.message }),
  });

  const openFile = async (file: WorkspaceFile) => {
    if (!file.bucket_id || !file.object_path) return;
    const { data, error } = await supabase.storage.from(file.bucket_id).createSignedUrl(file.object_path, 60);
    if (error) toast.error("Não foi possível abrir o PDF", { description: error.message });
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const startNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Operação · IA</p>
          <h1 className="mt-1 text-3xl font-black">Inteligência dos agentes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Concentre conhecimento, PDFs, follow-ups e o fluxo de atendimento de cada expert em um só lugar.</p>
        </div>
        {isAdmin && <Button onClick={startNew}><Plus className="h-4 w-4" />Novo expert</Button>}
      </header>

      {!isAdmin && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Somente administradores podem consultar e editar o treinamento dos agentes.</section>}

      <div className="grid min-h-[560px] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="gd-panel overflow-y-auto p-3">
          <div className="mb-3 flex items-center gap-2 px-2"><Bot className="h-4 w-4 text-primary" /><h2 className="text-xs font-black uppercase tracking-wider">Experts cadastrados</h2></div>
          <div className="space-y-1">
            {agents.data?.map((agent) => <button key={agent.id} type="button" onClick={() => setSelectedId(agent.id)} className={cn("w-full rounded-xl border px-3 py-3 text-left transition", selectedId === agent.id ? "border-primary/45 bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/50")}><div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{agent.name}</b><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", agent.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground")}>{agent.status === "active" ? "Ativo" : agent.status === "paused" ? "Pausado" : "Rascunho"}</span></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{agent.knowledge && knowledgeText(agent.knowledge) ? "Conhecimento configurado" : "Sem conhecimento ainda"}</p></button>)}
            {!agents.isLoading && !agents.data?.length && <p className="p-3 text-xs text-muted-foreground">Nenhum expert cadastrado. Crie o primeiro para começar.</p>}
          </div>
        </aside>

        <section className="gd-panel p-5 lg:p-7">
          <div className="mb-5 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-xl font-black">{form.id ? `Inteligência · ${form.name || "expert"}` : "Cadastrar expert"}</h2><p className="mt-1 text-sm text-muted-foreground">O conteúdo abaixo será usado junto do prompt quando este expert estiver vinculado a um número.</p></div></div>
          {!form.id ? <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Salve o expert para liberar arquivos, follow-ups e o fluxo operacional.</div> : <Tabs defaultValue="knowledge" className="space-y-5">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto"><TabsTrigger value="knowledge"><BookOpen className="mr-2 h-4 w-4" />Conhecimento</TabsTrigger><TabsTrigger value="files"><FileText className="mr-2 h-4 w-4" />Arquivos PDF ({files.data?.length || 0})</TabsTrigger><TabsTrigger value="followups"><Clock3 className="mr-2 h-4 w-4" />Follow-ups</TabsTrigger><TabsTrigger value="flow"><Workflow className="mr-2 h-4 w-4" />Fluxo</TabsTrigger></TabsList>
            <TabsContent value="knowledge" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-xs font-bold"><span>Nome do expert</span><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Dra. Ranniely" disabled={!isAdmin} /></label>
                <label className="space-y-1.5 text-xs font-bold"><span>Modelo da IA</span><Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="gpt-4o-mini" disabled={!isAdmin} /></label>
                <label className="space-y-1.5 text-xs font-bold md:col-span-2"><span>Modo de atendimento</span><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as AgentMode })} disabled={!isAdmin}><option value="ai_handoff">IA com transferência para vendedor</option><option value="ai">Somente IA</option><option value="human_assist">Humano com apoio da IA</option></select></label>
                <label className="space-y-1.5 text-xs font-bold md:col-span-2"><span>Instruções do agente</span><Textarea className="min-h-28 font-normal" value={form.systemPrompt} onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })} placeholder="Ex.: qualifique o lead, faça uma pergunta por vez e transfira quando ele pedir um vendedor." disabled={!isAdmin} /></label>
                <label className="space-y-1.5 text-xs font-bold md:col-span-2"><span>Conhecimento do expert</span><Textarea className="min-h-64 font-normal" value={form.knowledge} onChange={(event) => setForm({ ...form, knowledge: event.target.value })} placeholder="Cole aqui serviços, público, diferenciais, perguntas frequentes, objeções, preços autorizados e regras de qualificação." disabled={!isAdmin} /><span className="block text-[11px] font-normal text-muted-foreground">O texto fica separado por expert e não mistura outras operações.</span></label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />Depois de salvar, vincule este expert ao número na tela WhatsApp.</div>{isAdmin && <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}><Save className="h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar conhecimento"}</Button>}</div>
              {form.id && <p className="flex items-center gap-1 text-[11px] text-emerald-400"><Check className="h-3.5 w-3.5" />Conhecimento persistido no banco.</p>}
            </TabsContent>
            <TabsContent value="files" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4"><div><p className="text-sm font-bold">PDFs deste expert</p><p className="mt-1 text-xs text-muted-foreground">Até 100 MB por arquivo. O PDF fica privado e separado por expert.</p></div>{isAdmin && <><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} /><Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}><Upload className="mr-2 h-4 w-4" />{upload.isPending ? "Enviando…" : "Adicionar PDF"}</Button></>}</div>
              <div className="space-y-2">{files.data?.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.original_name}</p><p className="text-[11px] text-muted-foreground">{formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString("pt-BR")}</p></div><Button variant="ghost" size="icon" onClick={() => void openFile(file)} title="Abrir PDF"><ExternalLink className="h-4 w-4" /></Button>{isAdmin && <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Remover “${file.original_name}”?`)) deleteFile.mutate(file); }} disabled={deleteFile.isPending} title="Remover PDF"><Trash2 className="h-4 w-4 text-rose-500" /></Button>}</div>)}{!files.isLoading && !files.data?.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">Nenhum PDF vinculado a este expert.</p>}</div>
            </TabsContent>
            <TabsContent value="followups" className="space-y-4"><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-sm font-bold">Fila de follow-ups</p><p className="mt-1 text-xs text-muted-foreground">Somente registros associados a este expert. A fila é gerada pelo atendimento do WhatsApp.</p></div><div className="space-y-2">{followups.data?.map((item) => <article key={item.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">#{item.sequence_no}</span><span className="text-sm font-semibold">{statusLabel(item.status)}</span></div><time className="text-[11px] text-muted-foreground">{new Date(item.scheduled_at).toLocaleString("pt-BR")}</time></div><p className="mt-2 text-xs text-muted-foreground">Motivo: {item.reason || "não informado"}</p>{item.message_body && <p className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">{item.message_body}</p>}</article>)}{!followups.isLoading && !followups.data?.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">Nenhum follow-up encontrado para este expert.</p>}</div></TabsContent>
            <TabsContent value="flow" className="space-y-4"><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-sm font-bold">Fluxo deste atendimento</p><p className="mt-1 text-xs text-muted-foreground">A visão resume o caminho atual e abre o editor existente para configurar automações.</p></div><div className="grid gap-3 md:grid-cols-5">{["Entrada WhatsApp", "IA com conhecimento", "Qualificação", "Follow-up", "Handoff"].map((step, index) => <div key={step} className="relative rounded-xl border border-primary/25 bg-primary/5 p-4 text-center text-xs font-bold"><span className="mx-auto mb-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">{index + 1}</span>{step}{index < 4 && <span className="absolute -right-3 top-1/2 hidden text-primary md:block">→</span>}</div>)}</div><Button asChild variant="outline"><Link to="/automacoes"><Workflow className="mr-2 h-4 w-4" />Abrir automações</Link></Button></TabsContent>
          </Tabs>}
        </section>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function statusLabel(status: Followup["status"]) {
  return { pending: "Pendente", processing: "Processando", sent: "Enviado", cancelled: "Cancelado", failed: "Falhou" }[status];
}
