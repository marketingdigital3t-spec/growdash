import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, BookOpen, Check, Plus, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  const startNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Operação · IA</p>
          <h1 className="mt-1 text-3xl font-black">Treinamento dos agentes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Cadastre um expert por vez e mantenha o conhecimento de Ranniely, José, Natália e dos próximos agentes separado.</p>
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
          <div className="mb-5 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-xl font-black">{form.id ? "Editar treinamento" : "Cadastrar expert"}</h2><p className="mt-1 text-sm text-muted-foreground">O conteúdo abaixo será enviado junto do prompt da IA quando este expert estiver vinculado a um número.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold"><span>Nome do expert</span><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Ranniely" disabled={!isAdmin} /></label>
            <label className="space-y-1.5 text-xs font-bold"><span>Modelo da IA</span><Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="gpt-4o-mini" disabled={!isAdmin} /></label>
            <label className="space-y-1.5 text-xs font-bold md:col-span-2"><span>Modo de atendimento</span><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as AgentMode })} disabled={!isAdmin}><option value="ai_handoff">IA com transferência para vendedor</option><option value="ai">Somente IA</option><option value="human_assist">Humano com apoio da IA</option></select></label>
            <label className="space-y-1.5 text-xs font-bold md:col-span-2"><span>Instruções do agente</span><Textarea className="min-h-28 font-normal" value={form.systemPrompt} onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })} placeholder="Ex.: qualifique o lead, faça uma pergunta por vez e transfira quando ele pedir um vendedor." disabled={!isAdmin} /></label>
            <label className="space-y-1.5 text-xs font-bold md:col-span-2"><span>Conhecimento do expert</span><Textarea className="min-h-64 font-normal" value={form.knowledge} onChange={(event) => setForm({ ...form, knowledge: event.target.value })} placeholder="Cole aqui produtos, serviços, público, diferenciais, perguntas frequentes, objeções, preços autorizados e regras de qualificação." disabled={!isAdmin} /><span className="block text-[11px] font-normal text-muted-foreground">Escreva em texto livre. O conhecimento fica separado por expert e é usado pela IA sem misturar as operações.</span></label>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />Depois de salvar, vincule este expert ao número na tela WhatsApp.</div>{isAdmin && <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}><Save className="h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar treinamento"}</Button>}</div>
          {form.id && <p className="mt-3 flex items-center gap-1 text-[11px] text-emerald-400"><Check className="h-3.5 w-3.5" />Este treinamento está persistido no banco e será enviado para a IA.</p>}
        </section>
      </div>
    </div>
  );
}
