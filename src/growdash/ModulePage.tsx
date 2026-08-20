/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Facebook,
  FileSpreadsheet,
  FolderPlus,
  Instagram,
  ImageUp,
  LayoutGrid,
  ListFilter,
  MailPlus,
  MessageSquareText,
  MoreHorizontal,
  MoveRight,
  PauseCircle,
  PlayCircle,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  TicketCheck,
  Trash2,
  UserRoundPlus,
  UserRound,
  UsersRound,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { PageHeading } from "./shared";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AgentsOfficePage from "./AgentsOfficePage";
import LifeSimPage from "./LifeSimPage";
import { useToast } from "@/hooks/use-toast";
import { useMetaOAuth } from "@/hooks/useMetaOAuth";
import { useInstagramOAuth } from "@/hooks/useInstagramOAuth";
import { MetaManualConnectionCard } from "@/components/settings/MetaManualConnectionCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

type TabOption = { id: string; label: string };

function Tabs({ options, value, onChange }: { options: TabOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 growdash-scrollbar-hidden" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "min-h-9 shrink-0 rounded-lg px-4 text-xs font-extrabold transition",
            value === option.id ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,190,46,.12)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border bg-card/55 p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">{icon}</span>
        <h2 className="mt-4 text-base font-black">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

function ActionButton({ children, primary = false, onClick }: { children: ReactNode; primary?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={primary ? "gold-action" : "gd-button"}>{children}</button>;
}

type AutomationRow = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: "instagram_comment" | "instagram_message" | "new_lead" | "campaign_underperforming" | "manual";
  trigger_config: Record<string, any>;
  actions: Array<Record<string, any>>;
  status: "draft" | "active" | "paused" | "error";
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  updated_at: string;
};

const automationTriggerLabel: Record<AutomationRow["trigger_type"], string> = {
  instagram_comment: "Comentário no Instagram",
  instagram_message: "Mensagem no Instagram",
  new_lead: "Novo lead",
  campaign_underperforming: "Campanha perdeu performance",
  manual: "Execução manual",
};

const emptyAutomationDraft = {
  name: "",
  description: "",
  triggerType: "instagram_comment" as AutomationRow["trigger_type"],
  socialAccountId: "",
  keyword: "",
  actionType: "instagram_reply" as "instagram_reply" | "webhook" | "audit_only",
  response: "",
  webhookUrl: "",
};

function AutomationsModule() {
  const [tab, setTab] = useState("mine");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(emptyAutomationDraft);
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const connectInstagram = useInstagramOAuth();
  const workspaceReady = !!workspace?.id && !workspace.id.startsWith("legacy-");

  const templates = [
    { title: "Palavra-chave no comentário", description: "Quando alguém comentar a palavra configurada, responda automaticamente pelo perfil profissional conectado.", icon: Instagram, triggerType: "instagram_comment" as const, actionType: "instagram_reply" as const, keyword: "quero" },
    { title: "Mensagem recebida no Instagram", description: "Crie uma resposta inicial para novas conversas e registre cada execução no histórico do workspace.", icon: MessageSquareText, triggerType: "instagram_message" as const, actionType: "instagram_reply" as const, keyword: "" },
    { title: "Enviar para outro sistema", description: "Encaminhe o evento para um webhook HTTPS de CRM, atendimento ou automação externa.", icon: Zap, triggerType: "instagram_comment" as const, actionType: "webhook" as const, keyword: "" },
  ];

  const accountsQuery = useQuery({
    queryKey: ["automation-social-accounts", workspace?.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("social_accounts").select("id,username,display_name,connection_status,workspace_id").eq("provider", "instagram").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const automationsQuery = useQuery({
    queryKey: ["growdash-automations", workspace?.id],
    enabled: workspaceReady,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("growdash_automations").select("*").eq("workspace_id", workspace!.id).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AutomationRow[];
    },
    retry: false,
  });
  const schemaMissing = automationsQuery.error && /growdash_automations|schema cache|relation/i.test((automationsQuery.error as Error).message);

  const saveAutomation = useMutation({
    mutationFn: async ({ activate }: { activate: boolean }) => {
      if (!workspaceReady || !user) throw new Error("O workspace ainda não está pronto para salvar automações.");
      if (!draft.name.trim()) throw new Error("Dê um nome para a automação.");
      if (draft.triggerType.startsWith("instagram") && !draft.socialAccountId) throw new Error("Selecione o perfil do Instagram.");
      if (draft.actionType === "instagram_reply" && !draft.response.trim()) throw new Error("Escreva a resposta automática.");
      if (draft.actionType === "webhook" && !/^https:\/\//i.test(draft.webhookUrl.trim())) throw new Error("Use uma URL HTTPS válida para o webhook.");
      const account = (accountsQuery.data ?? []).find((item: any) => item.id === draft.socialAccountId);
      if (account && account.workspace_id !== workspace!.id) {
        const { error: accountError } = await (supabase as any).from("social_accounts").update({ workspace_id: workspace!.id }).eq("id", account.id);
        if (accountError) throw accountError;
      }
      const action = draft.actionType === "instagram_reply"
        ? { type: "instagram_reply", message: draft.response.trim() }
        : draft.actionType === "webhook"
          ? { type: "webhook", url: draft.webhookUrl.trim() }
          : { type: "audit_only" };
      const { error } = await (supabase as any).from("growdash_automations").insert({
        workspace_id: workspace!.id,
        created_by: user.id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        trigger_type: draft.triggerType,
        trigger_config: { social_account_id: draft.socialAccountId || null, keyword: draft.keyword.trim().toLocaleLowerCase("pt-BR"), match: draft.keyword.trim() ? "contains" : "any" },
        actions: [action],
        status: activate ? "active" : "draft",
      });
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["growdash-automations", workspace?.id] });
      setEditorOpen(false);
      setDraft(emptyAutomationDraft);
      toast({ title: variables.activate ? "Automação ativada" : "Rascunho salvo", description: variables.activate ? "O fluxo está pronto para receber eventos do webhook do Instagram." : "Revise e ative quando estiver pronto." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AutomationRow["status"] }) => {
      const { error } = await (supabase as any).from("growdash_automations").update({ status, last_error: null }).eq("id", id).eq("workspace_id", workspace!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["growdash-automations", workspace?.id] }),
    onError: (error: Error) => toast({ title: "Falha ao alterar automação", description: error.message, variant: "destructive" }),
  });

  const validateFlow = useMutation({
    mutationFn: async (automationId: string) => {
      const { data, error } = await supabase.functions.invoke("instagram-automation-run", { body: { automation_id: automationId, trigger_event: { source: "growdash_editor", text: "teste de validação" }, dry_run: true } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["growdash-automations", workspace?.id] });
      toast({ title: "Fluxo validado", description: `${data?.actions_executed?.length ?? 0} ação(ões) verificadas sem enviar mensagem real.` });
    },
    onError: (error: Error) => toast({ title: "Validação falhou", description: error.message, variant: "destructive" }),
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("growdash_automations").delete().eq("id", id).eq("workspace_id", workspace!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["growdash-automations", workspace?.id] }),
  });

  const openEditor = (template?: typeof templates[number]) => {
    setDraft({ ...emptyAutomationDraft, ...(template ? { name: template.title, description: template.description, triggerType: template.triggerType, actionType: template.actionType, keyword: template.keyword } : {}), socialAccountId: accountsQuery.data?.[0]?.id || "" });
    setEditorOpen(true);
  };
  const automations = (automationsQuery.data ?? []).filter((item) => !search.trim() || item.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) || automationTriggerLabel[item.trigger_type].toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));

  return (
    <Page title="Automações" description="Crie gatilhos, condições e respostas usando os perfis profissionais conectados à Growdash." action={<Button className="gold-action" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" /> Nova automação</Button>}>
      <Tabs options={[{ id: "mine", label: "Minhas Automações" }, { id: "basic", label: "Templates Instagram" }, { id: "sequences", label: "Como funciona" }]} value={tab} onChange={setTab} />
      {schemaMissing && <section className="gd-panel mb-4 border-amber-500/30 p-4"><b className="text-sm text-amber-500">Migration de automações pendente</b><p className="mt-1 text-xs text-muted-foreground">Aplique `20260809100000_instagram_automation_foundation.sql` no Supabase antes de ativar os fluxos.</p></section>}
      {tab === "mine" ? <>
        <Toolbar left={<label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-72"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="Buscar automação" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar automação" className="min-w-0 grow bg-transparent text-sm outline-none" /></label>} right={<Button variant="outline" onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}><Instagram className="mr-2 h-4 w-4" />{connectInstagram.isPending ? "Conectando…" : "Conectar Instagram"}</Button>} />
        {!accountsQuery.data?.length && <section className="gd-panel mb-4 flex flex-col gap-4 border-pink-500/20 p-5 sm:flex-row sm:items-center"><span className="grid h-12 w-12 place-items-center rounded-xl bg-pink-500/10 text-pink-500"><Instagram className="h-6 w-6" /></span><div className="grow"><b className="text-sm">Conecte o Instagram do expert</b><p className="mt-1 text-xs text-muted-foreground">A mesma conta usada na análise de posts será usada nos gatilhos e respostas da automação.</p></div><Button onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}>Conectar agora</Button></section>}
        {automations.length ? <div className="grid gap-3 lg:grid-cols-2">{automations.map((automation) => {
          const account = (accountsQuery.data ?? []).find((item: any) => item.id === automation.trigger_config?.social_account_id);
          const active = automation.status === "active";
          return <article key={automation.id} className="gd-panel p-5"><div className="flex items-start gap-3"><span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}><Workflow className="h-5 w-5" /></span><div className="min-w-0 grow"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-black">{automation.name}</h2><Badge variant="outline" className={cn("text-[9px]", active && "border-emerald-500/35 text-emerald-500")}>{active ? "Ativa" : automation.status === "draft" ? "Rascunho" : automation.status === "paused" ? "Pausada" : "Com erro"}</Badge></div><p className="mt-1 text-[10px] text-muted-foreground">{automationTriggerLabel[automation.trigger_type]}{account ? ` · @${account.username || account.display_name}` : ""}</p></div></div><div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-xs"><b>SE</b> {automation.trigger_config?.keyword ? `contiver “${automation.trigger_config.keyword}”` : "receber qualquer evento compatível"}<br /><b>ENTÃO</b> {automation.actions?.[0]?.type === "instagram_reply" ? `responder “${automation.actions[0].message}”` : automation.actions?.[0]?.type === "webhook" ? "enviar para webhook HTTPS" : "registrar no histórico"}</div>{automation.last_error && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-[10px] text-destructive">{automation.last_error}</p>}<div className="mt-4 flex flex-wrap items-center gap-2"><Button size="sm" variant={active ? "outline" : "default"} onClick={() => updateStatus.mutate({ id: automation.id, status: active ? "paused" : "active" })}>{active ? <PauseCircle className="mr-2 h-3.5 w-3.5" /> : <PlayCircle className="mr-2 h-3.5 w-3.5" />}{active ? "Pausar" : "Ativar"}</Button><Button size="sm" variant="outline" onClick={() => validateFlow.mutate(automation.id)} disabled={validateFlow.isPending}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Validar fluxo</Button><Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Excluir a automação “${automation.name}”?`)) deleteAutomation.mutate(automation.id); }}><Trash2 className="h-3.5 w-3.5" /></Button><span className="w-full text-[9px] text-muted-foreground">{automation.run_count} execução(ões){automation.last_run_at ? ` · última em ${new Date(automation.last_run_at).toLocaleString("pt-BR")}` : ""}</span></div></article>;
        })}</div> : !automationsQuery.isLoading && !schemaMissing ? <EmptyState icon={<Workflow className="h-6 w-6" />} title="Nenhuma automação criada" description="Comece por um fluxo de palavra-chave, mensagem ou webhook. Somente automações ativas processam eventos reais." action={<Button className="gold-action" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" /> Criar automação</Button>} /> : null}
      </> : tab === "basic" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article key={template.title} className="gd-panel p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><template.icon className="h-5 w-5" /></span><h2 className="mt-4 font-black">{template.title}</h2><p className="mt-2 min-h-16 text-xs leading-relaxed text-muted-foreground">{template.description}</p><button type="button" onClick={() => openEditor(template)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary">Configurar <ArrowRight className="h-4 w-4" /></button></article>)}</div> : <section className="grid gap-4 lg:grid-cols-3"><AutomationStep number="1" title="Conecte o perfil" text="Use o login oficial do Instagram Business/Creator. A Growdash reutiliza essa conexão para métricas e automações." /><AutomationStep number="2" title="Defina gatilho e ação" text="Escolha comentário, mensagem, palavra-chave, resposta ou webhook. O rascunho não executa ações." /><AutomationStep number="3" title="Ative e acompanhe" text="Eventos aceitos pelo webhook são auditados. Falhas e quantidade de execuções aparecem em cada fluxo." /></section>}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Editor de automação Instagram</DialogTitle></DialogHeader><div className="grid gap-4"><label className="grid gap-1.5 text-xs font-bold">Nome<Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Enviar material pelo comentário QUERO" /></label><label className="grid gap-1.5 text-xs font-bold">Descrição<Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Objetivo e contexto do fluxo" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold">Gatilho<Select value={draft.triggerType} onValueChange={(value) => setDraft((current) => ({ ...current, triggerType: value as AutomationRow["trigger_type"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="instagram_comment">Comentário no Instagram</SelectItem><SelectItem value="instagram_message">Mensagem no Instagram</SelectItem><SelectItem value="new_lead">Novo lead</SelectItem><SelectItem value="campaign_underperforming">Campanha perdeu performance</SelectItem><SelectItem value="manual">Manual/API</SelectItem></SelectContent></Select></label><label className="grid gap-1.5 text-xs font-bold">Perfil do Instagram<Select value={draft.socialAccountId} onValueChange={(value) => setDraft((current) => ({ ...current, socialAccountId: value }))}><SelectTrigger><SelectValue placeholder="Selecione o perfil" /></SelectTrigger><SelectContent>{(accountsQuery.data ?? []).map((account: any) => <SelectItem key={account.id} value={account.id}>@{account.username || account.display_name}</SelectItem>)}</SelectContent></Select></label></div>{draft.triggerType.startsWith("instagram") && <label className="grid gap-1.5 text-xs font-bold">Palavra-chave opcional<Input value={draft.keyword} onChange={(event) => setDraft((current) => ({ ...current, keyword: event.target.value }))} placeholder="Ex: quero, ebook, preço" /><small className="font-normal text-muted-foreground">Vazio aceita qualquer evento compatível; com texto, exige correspondência sem diferenciar maiúsculas.</small></label>}<label className="grid gap-1.5 text-xs font-bold">Ação<Select value={draft.actionType} onValueChange={(value) => setDraft((current) => ({ ...current, actionType: value as typeof draft.actionType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="instagram_reply">Responder no Instagram</SelectItem><SelectItem value="webhook">Enviar webhook HTTPS</SelectItem><SelectItem value="audit_only">Somente registrar</SelectItem></SelectContent></Select></label>{draft.actionType === "instagram_reply" && <label className="grid gap-1.5 text-xs font-bold">Resposta automática<Textarea value={draft.response} onChange={(event) => setDraft((current) => ({ ...current, response: event.target.value }))} placeholder="Mensagem que será enviada" /><small className="font-normal text-muted-foreground">O envio real exige as permissões `instagram_business_manage_comments` ou `instagram_business_manage_messages` aprovadas no app Meta.</small></label>}{draft.actionType === "webhook" && <label className="grid gap-1.5 text-xs font-bold">Webhook HTTPS<Input type="url" value={draft.webhookUrl} onChange={(event) => setDraft((current) => ({ ...current, webhookUrl: event.target.value }))} placeholder="https://seu-crm.com/webhooks/growdash" /></label>}<div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => saveAutomation.mutate({ activate: false })} disabled={saveAutomation.isPending}>Salvar rascunho</Button><Button className="gold-action" onClick={() => saveAutomation.mutate({ activate: true })} disabled={saveAutomation.isPending}>{saveAutomation.isPending ? "Salvando…" : "Salvar e ativar"}</Button></div></div></DialogContent></Dialog>
    </Page>
  );
}

function AutomationStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="gd-panel p-5"><span className="grid h-9 w-9 place-items-center rounded-full border border-primary/35 bg-primary/10 text-sm font-black text-primary">{number}</span><h2 className="mt-4 font-black">{title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></article>;
}

function KanbanModule() {
  const [tab, setTab] = useState("boards");
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban"); // "kanban" for Trello, "list" for ClickUp
  const { data: workspace } = useWorkspace();
  const { toast } = useToast();

  // Fetch Boards
  const boardsQuery = useQuery({
    queryKey: ["kanban_boards", workspace?.id],
    queryFn: async () => {
      const wId = workspace?.id || "legacy-fallback-workspace";
      const { data, error } = await supabase
        .from("kanban_boards" as any)
        .select("*")
        .eq("workspace_id", wId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Lists/Columns + Cards for Active Board
  const boardDetailsQuery = useQuery({
    queryKey: ["kanban_board_details", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const { data: lists, error: listsError } = await supabase
        .from("kanban_lists" as any)
        .select("*")
        .eq("board_id", selectedBoardId)
        .order("position");
      if (listsError) throw listsError;

      const listIds = (lists || []).map((l: any) => l.id);
      let cards: any[] = [];
      if (listIds.length > 0) {
        const { data: cardsRes, error: cardsError } = await supabase
          .from("kanban_cards" as any)
          .select("*")
          .in("list_id", listIds)
          .order("position");
        if (cardsError) throw cardsError;
        cards = cardsRes || [];
      }

      return { lists: lists || [], cards };
    }
  });

  const createBoard = async (name: string, desc = "") => {
    try {
      const { data: board, error } = await supabase
        .from("kanban_boards" as any)
        .insert({
          workspace_id: workspace?.id || "legacy-fallback-workspace",
          name,
          description: desc
        })
        .select()
        .single();
      if (error) throw error;
      const boardId = (board as { id?: string } | null)?.id;
      if (!boardId) throw new Error("O quadro não foi criado corretamente.");

      // Default Columns
      const columns = ["A Fazer", "Em Progresso", "Concluído"];
      const colInserts = columns.map((colName, index) =>
        supabase.from("kanban_lists" as any).insert({
          board_id: boardId,
          name: colName,
          position: index
        })
      );
      await Promise.all(colInserts);

      toast({ title: "Quadro criado", description: `O quadro "${name}" foi configurado com sucesso.` });
      boardsQuery.refetch();
      setSelectedBoardId(boardId);
    } catch (e: any) {
      toast({ title: "Erro ao criar quadro", description: e.message, variant: "destructive" });
    }
  };

  const createCard = async (listId: string, title: string) => {
    try {
      const columnCards = boardDetailsQuery.data?.cards?.filter((c: any) => c.list_id === listId) || [];
      const newPos = columnCards.length;
      const { error } = await supabase.from("kanban_cards" as any).insert({
        list_id: listId,
        title,
        position: newPos
      });
      if (error) throw error;
      boardDetailsQuery.refetch();
    } catch (e: any) {
      toast({ title: "Erro ao criar cartão", description: e.message, variant: "destructive" });
    }
  };

  const deleteBoard = async (boardId: string) => {
    try {
      const { error } = await supabase.from("kanban_boards" as any).delete().eq("id", boardId);
      if (error) throw error;
      toast({ title: "Quadro excluído" });
      setSelectedBoardId(null);
      boardsQuery.refetch();
    } catch (e: any) {
      toast({ title: "Erro ao excluir quadro", description: e.message, variant: "destructive" });
    }
  };

  const activeBoard = boardsQuery.data?.find((b: any) => b.id === selectedBoardId) as unknown as { id: string; name: string; description?: string | null } | undefined;
  const filteredBoards = boardsQuery.data?.filter((b: any) => b.name.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  if (selectedBoardId && activeBoard) {
    const details = boardDetailsQuery.data || { lists: [], cards: [] };
    return (
      <Page title={activeBoard.name} description={activeBoard.description || "Organização ágil de tarefas."} action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(v => v === "kanban" ? "list" : "kanban")}>
            {viewMode === "kanban" ? "Ver como Lista (ClickUp)" : "Ver como Quadro (Trello)"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedBoardId(null)}>Voltar aos quadros</Button>
          <Button variant="destructive" size="sm" onClick={() => deleteBoard(activeBoard.id)}>Excluir quadro</Button>
        </div>
      }>
        {viewMode === "kanban" ? (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
            {details.lists.map((list: any) => {
              const listCards = details.cards.filter((c: any) => c.list_id === list.id);
              return (
                <div key={list.id} className="min-w-64 max-w-64 gd-panel p-3 bg-muted/40 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">{list.name}</h3>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black">{listCards.length}</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    {listCards.map((card: any) => (
                      <div key={card.id} className="p-3 bg-card border border-border rounded-lg shadow-sm text-xs break-all">
                        {card.title}
                      </div>
                    ))}
                    {listCards.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground text-[10px]">Coluna vazia</div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="w-full text-xs text-primary font-bold" onClick={() => {
                    const title = prompt("Digite o título da tarefa:");
                    if (title?.trim()) void createCard(list.id, title.trim());
                  }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar cartão
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 gd-panel p-4 space-y-6">
            {details.lists.map((list: any) => {
              const listCards = details.cards.filter((c: any) => c.list_id === list.id);
              return (
                <div key={list.id} className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-border pb-1">
                    <h3 className="font-bold text-sm text-primary">{list.name}</h3>
                    <span className="text-xs text-muted-foreground">({listCards.length})</span>
                  </div>
                  <div className="divide-y divide-border">
                    {listCards.map((card: any) => (
                      <div key={card.id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-medium">{card.title}</span>
                      </div>
                    ))}
                    {listCards.length === 0 && (
                      <div className="py-4 text-muted-foreground text-xs italic">Nenhuma tarefa nesta lista</div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="text-[11px] text-primary font-bold mt-1" onClick={() => {
                    const title = prompt("Digite o título da tarefa:");
                    if (title?.trim()) void createCard(list.id, title.trim());
                  }}>
                    <Plus className="mr-1 h-3 w-3" /> Adicionar tarefa
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Page>
    );
  }

  const templates = [
    { name: "Pipeline comercial", desc: "Acompanhe funis e negócios de vendas." },
    { name: "Onboarding de cliente", desc: "Etapas de implantação de novos SaaS." },
    { name: "Produção de campanha", desc: "Gestão de criativos, copys e anúncios." },
    { name: "Acompanhamento de leads", desc: "Rotina de prospecção e triagem diária." }
  ];

  return (
    <Page title="Quadros" description="Organize vendas e operação em quadros visuais compartilhados." action={
      <Button size="sm" className="gold-action" onClick={() => {
        const name = prompt("Nome do quadro:");
        if (name?.trim()) void createBoard(name.trim());
      }}>
        <Plus className="h-4 w-4 mr-1" /> Criar quadro
      </Button>
    }>
      <Tabs options={[{ id: "boards", label: "Meus quadros" }, { id: "templates", label: "Templates" }]} value={tab} onChange={setTab} />
      {tab === "boards" ? (
        <>
          <Toolbar left={
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar quadro" className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
          } right={null} />

          {filteredBoards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredBoards.map((board: any) => (
                <article key={board.id} className="gd-panel p-4 cursor-pointer hover:border-primary/55 hover:shadow-lg transition" onClick={() => setSelectedBoardId(board.id)}>
                  <LayoutGrid className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-bold text-sm mb-1">{board.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{board.description || "Sem descrição."}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<LayoutGrid className="h-6 w-6" />} title="Nenum quadro criado" description="Crie um quadro vazio ou comece por um template. Colunas e cartões poderão ser arrastados sem recarregar a página." action={
              <Button size="sm" className="gold-action" onClick={() => {
                const name = prompt("Nome do quadro:");
                if (name?.trim()) void createBoard(name.trim());
              }}>
                <Plus className="h-4 w-4 mr-1" /> Criar primeiro quadro
              </Button>
            } />
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template, index) => (
            <article key={template.name} className="gd-panel overflow-hidden">
              <div className="h-28 bg-[radial-gradient(circle_at_top_right,rgba(var(--brand-accent-rgb),.24),transparent_55%),linear-gradient(135deg,#080808,#151515)] p-4">
                <div className="flex gap-2">{[0, 1, 2].map((item) => <span key={item} className="h-14 flex-1 rounded-lg border border-white/10 bg-white/[.04]" />)}</div>
              </div>
              <div className="p-4">
                <span className="text-[9px] font-black uppercase tracking-[.16em] text-primary">Template {index + 1}</span>
                <h2 className="mt-1 font-black text-sm">{template.name}</h2>
                <p className="text-[11px] text-muted-foreground mt-1 min-h-10 leading-normal">{template.desc}</p>
                <button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary" onClick={() => void createBoard(template.name, template.desc)}>
                  Usar template <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function TicketsModule() {
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [form, setForm] = useState({ title: "", description: "", requester_name: "", requested_at: new Date().toISOString().slice(0, 10), category: "general", priority: "normal" });
  const { data: workspace } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ["workspace-tickets", workspace?.id],
    enabled: !!workspace?.id && !workspace.id.startsWith("legacy-"),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("workspace_tickets")
        .select("id,title,description,requester_name,requested_at,category,priority,status,created_at,updated_at,created_by")
        .eq("workspace_id", workspace!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; title: string; description: string; requester_name: string | null; requested_at: string | null; category: string; priority: string; status: string; created_at: string; updated_at: string; created_by: string }>;
    },
  });
  const createTicket = useMutation({
    mutationFn: async () => {
      if (!workspace?.id || !user?.id) throw new Error("Seu acesso ainda está sendo carregado.");
      if (form.title.trim().length < 3 || form.description.trim().length < 3) throw new Error("Informe título e descrição com pelo menos 3 caracteres.");
      const { error } = await (supabase as any).from("workspace_tickets").insert({
        workspace_id: workspace.id, created_by: user.id, title: form.title.trim(), description: form.description.trim(), requester_name: form.requester_name.trim() || user.user_metadata?.full_name || user.email || "Solicitante não informado", requested_at: form.requested_at, category: form.category, priority: form.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({ title: "", description: "", requester_name: "", requested_at: new Date().toISOString().slice(0, 10), category: "general", priority: "normal" }); qc.invalidateQueries({ queryKey: ["workspace-tickets"] }); toast({ title: "Chamado aberto", description: "Sua solicitação já está visível para a gestão do workspace." }); },
    onError: (err: Error) => toast({ title: "Não foi possível abrir o chamado", description: err.message, variant: "destructive" }),
  });
  const updateTicket = useMutation({
    mutationFn: async () => {
      if (!editingTicket) return;
      if (form.title.trim().length < 3 || form.description.trim().length < 3) throw new Error("Informe título e descrição com pelo menos 3 caracteres.");
      const { error } = await (supabase as any).from("workspace_tickets").update({ title: form.title.trim(), description: form.description.trim(), requester_name: form.requester_name.trim() || null, requested_at: form.requested_at, category: form.category, priority: form.priority, updated_at: new Date().toISOString() }).eq("id", editingTicket.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditingTicket(null); setOpen(false); qc.invalidateQueries({ queryKey: ["workspace-tickets"] }); toast({ title: "Chamado atualizado" }); },
    onError: (err: Error) => toast({ title: "Não foi possível atualizar o chamado", description: err.message, variant: "destructive" }),
  });
  const deleteTicket = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("workspace_tickets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workspace-tickets"] }); toast({ title: "Chamado excluído" }); },
    onError: (err: Error) => toast({ title: "Não foi possível excluir o chamado", description: err.message, variant: "destructive" }),
  });
  const openEditor = (ticket: any) => { setEditingTicket(ticket); setForm({ title: ticket.title, description: ticket.description, requester_name: ticket.requester_name || "", requested_at: ticket.requested_at || String(ticket.created_at).slice(0, 10), category: ticket.category, priority: ticket.priority }); setOpen(true); };
  const filtered = tab === "all" ? tickets : tickets.filter((ticket) => ticket.status === tab);
  const counters = [
    ["Total", tickets.length], ["Abertos", tickets.filter((ticket) => ticket.status === "open").length], ["Em andamento", tickets.filter((ticket) => ticket.status === "in_progress").length], ["Aguardando", tickets.filter((ticket) => ticket.status === "waiting").length], ["Resolvidos", tickets.filter((ticket) => ticket.status === "resolved").length],
  ] as const;
  return (
    <Page title="Chamados" description="Abra, acompanhe e mantenha as solicitações do seu workspace organizadas." action={<ActionButton primary onClick={() => { setEditingTicket(null); setForm({ title: "", description: "", requester_name: user?.user_metadata?.full_name || user?.email || "", requested_at: new Date().toISOString().slice(0, 10), category: "general", priority: "normal" }); setOpen(true); }}><Plus className="h-4 w-4" /> Novo chamado</ActionButton>}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{counters.map(([label, value]) => <div key={label} className="gd-panel min-w-0 p-4"><span className="block truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><strong className="mt-2 block text-2xl">{value}</strong></div>)}</div>
      <Tabs options={[{ id: "all", label: "Todos" }, { id: "open", label: "Abertos" }, { id: "in_progress", label: "Em andamento" }, { id: "waiting", label: "Aguardando" }, { id: "resolved", label: "Resolvidos" }]} value={tab} onChange={setTab} />
      {error ? <EmptyState icon={<XCircle className="h-6 w-6" />} title="Não foi possível carregar os chamados" description="Atualize a página. Se o erro continuar, a migração de chamados ainda precisa ser aplicada." /> : isLoading ? <div className="gd-panel p-8 text-center text-sm text-muted-foreground">Carregando chamados…</div> : filtered.length ? <div className="space-y-3">{filtered.map((ticket) => <article key={ticket.id} className="gd-panel p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">{ticket.title}</h2><p className="mt-1 max-w-2xl text-xs text-muted-foreground">{ticket.description}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{ticket.status === "open" ? "Aberto" : ticket.status === "in_progress" ? "Em andamento" : ticket.status === "waiting" ? "Aguardando" : "Resolvido"}</Badge><Button size="icon" variant="ghost" aria-label={`Editar chamado ${ticket.title}`} onClick={() => openEditor(ticket)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Excluir chamado ${ticket.title}`} disabled={deleteTicket.isPending} onClick={() => { if (window.confirm(`Excluir o chamado “${ticket.title}”? Esta ação não pode ser desfeita.`)) deleteTicket.mutate(ticket.id); }}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" /> Solicitante: {ticket.requester_name || "Não informado"}</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Solicitação: {ticket.requested_at ? new Date(`${ticket.requested_at}T12:00:00`).toLocaleDateString("pt-BR") : new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span><span>{ticket.category} · prioridade {ticket.priority}</span></div></article>)}</div> : <EmptyState icon={<TicketCheck className="h-6 w-6" />} title="Nenhum chamado por aqui" description="Abra um chamado e ele ficará visível para a gestão desta Growdash." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Abrir chamado</Button>} />}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editingTicket ? "Editar chamado" : "Novo chamado"}</DialogTitle></DialogHeader><div className="grid gap-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Nome do solicitante<Input value={form.requester_name} onChange={(event) => setForm({ ...form, requester_name: event.target.value })} placeholder="Quem está solicitando?" /></label><label className="grid gap-2 text-sm font-medium">Data da solicitação<Input type="date" value={form.requested_at} onChange={(event) => setForm({ ...form, requested_at: event.target.value })} /></label></div><label className="grid gap-2 text-sm font-medium">Título<Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Preciso de ajuda com um relatório" /></label><label className="grid gap-2 text-sm font-medium">Informações e detalhes<Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Explique o contexto, impacto, urgência e o que você precisa." /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-medium">Categoria<Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">Geral</SelectItem><SelectItem value="access">Acesso</SelectItem><SelectItem value="finance">Financeiro</SelectItem><SelectItem value="integration">Integração</SelectItem><SelectItem value="data">Dados</SelectItem></SelectContent></Select></label><label className="grid gap-2 text-sm font-medium">Prioridade<Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="urgent">Urgente</SelectItem></SelectContent></Select></label></div><Button onClick={() => editingTicket ? updateTicket.mutate() : createTicket.mutate()} disabled={createTicket.isPending || updateTicket.isPending}>{createTicket.isPending || updateTicket.isPending ? "Salvando…" : editingTicket ? "Salvar alterações" : "Enviar chamado"}</Button></div></DialogContent></Dialog>
    </Page>
  );
}

function BrandsModule() {
  const [search, setSearch] = useState("");
  const [brandOrder, setBrandOrder] = useState<"pinned" | "updated" | "name-asc" | "name-desc">(() => {
    try {
      const saved = localStorage.getItem("growdash:brands-order");
      return saved === "updated" || saved === "name-asc" || saved === "name-desc" || saved === "pinned" ? saved : "pinned";
    } catch { return "pinned"; }
  });
  const [pinnedBrandKeys, setPinnedBrandKeys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("growdash:pinned-brands") || "[]")); } catch { return new Set(); }
  });
  const [syncing, setSyncing] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: workspace } = useWorkspace();
  const { data: accounts = [] } = useAdAccounts();
  useEffect(() => {
    try { localStorage.setItem("growdash:brands-order", brandOrder); } catch { /* preferência apenas nesta sessão */ }
  }, [brandOrder]);
  useEffect(() => {
    try { localStorage.setItem("growdash:pinned-brands", JSON.stringify([...pinnedBrandKeys])); } catch { /* preferência apenas nesta sessão */ }
  }, [pinnedBrandKeys]);
  const companiesQuery = useQuery({
    queryKey: ["companies", workspace?.id],
    enabled: !!workspace?.id && !workspace.id.startsWith("legacy-"),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("id, workspace_id, business_unit_id, name, status, metadata, created_at, updated_at")
        .eq("workspace_id", workspace!.id)
        .neq("status", "archived")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const storedCompanies = useMemo(() => companiesQuery.data ?? [], [companiesQuery.data]);
  const brands = useMemo(() => {
    const byMetaId = new Map<string, any>();
    const result = storedCompanies.map((company: any) => {
      const metaId = company.metadata?.meta_account_id;
      if (metaId) byMetaId.set(String(metaId), company);
      return company;
    });
    for (const account of accounts) {
      if (byMetaId.has(String(account.account_id))) continue;
      result.push({
        id: `account-${account.id}`,
        name: account.name || `Conta Meta ${account.account_id}`,
        status: "active",
        metadata: { source: "meta_ads", meta_account_id: account.account_id, ad_account_id: account.id, pending_persistence: true },
      });
    }
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const preferenceKey = (brand: any) => String(brand.metadata?.meta_account_id || brand.metadata?.ad_account_id || brand.id);
    return result
      .filter((brand: any) => !query || brand.name.toLocaleLowerCase("pt-BR").includes(query) || String(brand.metadata?.meta_account_id || "").includes(query))
      .sort((a: any, b: any) => {
        if (brandOrder === "pinned") {
          const pinnedDifference = Number(pinnedBrandKeys.has(preferenceKey(b))) - Number(pinnedBrandKeys.has(preferenceKey(a)));
          if (pinnedDifference) return pinnedDifference;
        }
        if (brandOrder === "updated") {
          const dateDifference = new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
          if (dateDifference) return dateDifference;
        }
        const byName = a.name.localeCompare(b.name, "pt-BR");
        return brandOrder === "name-desc" ? -byName : byName;
      });
  }, [accounts, brandOrder, pinnedBrandKeys, search, storedCompanies]);

  const togglePinnedBrand = (brand: any) => {
    const key = String(brand.metadata?.meta_account_id || brand.metadata?.ad_account_id || brand.id);
    setPinnedBrandKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const syncBrands = async () => {
    if (!workspace?.id || workspace.id.startsWith("legacy-") || accounts.length === 0) return;
    setSyncing(true);
    try {
      const rows = accounts.map((account) => ({
        workspace_id: workspace.id,
        business_unit_id: account.business_unit_id || null,
        name: account.name || `Conta Meta ${account.account_id}`,
        status: "active",
        metadata: { source: "meta_ads", ad_account_id: account.id, meta_account_id: account.account_id, auto_created: true },
      }));
      const { error } = await (supabase as any).from("companies").upsert(rows, { onConflict: "workspace_id,name" });
      if (error) throw error;
      await companiesQuery.refetch();
    } finally {
      setSyncing(false);
    }
  };

  const uploadBanner = async (brand: any, file?: File) => {
    if (!file || !workspace?.id || workspace.id.startsWith("legacy-")) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      toast({ title: "Banner inválido", description: "Use PNG, JPG ou WebP com até 10 MB.", variant: "destructive" });
      return;
    }
    setUploadingBrand(brand.id);
    try {
      let companyId = brand.id;
      let metadata = brand.metadata || {};
      if (String(brand.id).startsWith("account-")) {
        const account = accounts.find((item) => item.id === brand.metadata?.ad_account_id);
        const { data, error } = await (supabase as any).from("companies").upsert({
          workspace_id: workspace.id,
          business_unit_id: account?.business_unit_id || null,
          name: brand.name,
          status: "active",
          metadata,
        }, { onConflict: "workspace_id,name" }).select("id,metadata").single();
        if (error) throw error;
        companyId = data.id;
        metadata = data.metadata || metadata;
      }
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${workspace.id}/${companyId}/banner-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("brand-banners").upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("brand-banners").getPublicUrl(path);
      const previousPath = metadata.banner_path;
      const { error: updateError } = await (supabase as any).from("companies").update({ metadata: { ...metadata, banner_path: path, banner_url: publicData.publicUrl }, updated_at: new Date().toISOString() }).eq("id", companyId).eq("workspace_id", workspace.id);
      if (updateError) throw updateError;
      if (previousPath && previousPath !== path) await supabase.storage.from("brand-banners").remove([previousPath]);
      await companiesQuery.refetch();
      toast({ title: "Banner atualizado", description: `A identidade visual de ${brand.name} foi salva.` });
    } catch (error) {
      toast({ title: "Não foi possível alterar o banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingBrand(null);
    }
  };

  return (
    <div className="brands-module">
    <Page title="Marcas" description="Cada conta de anúncio integrada gera automaticamente uma marca com diagnóstico e histórico próprios." action={<Link to="/integracoes" className="gold-action"><Plus className="h-4 w-4" /> Integrar conta</Link>}>
      <Toolbar
        left={<label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-72"><Search className="h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar marca" placeholder="Buscar marca ou ID da conta" className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>}
        right={<><Select value={brandOrder} onValueChange={(value) => setBrandOrder(value as typeof brandOrder)}><SelectTrigger aria-label="Ordenar marcas" className="h-10 w-full bg-background sm:w-52"><ListFilter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pinned">Favoritas primeiro</SelectItem><SelectItem value="updated">Última alteração</SelectItem><SelectItem value="name-asc">Nome: A a Z</SelectItem><SelectItem value="name-desc">Nome: Z a A</SelectItem></SelectContent></Select><button type="button" onClick={syncBrands} disabled={syncing || accounts.length === 0} className="gd-button disabled:cursor-not-allowed disabled:opacity-50"><Zap className={cn("h-4 w-4", syncing && "animate-pulse")} /> {syncing ? "Sincronizando…" : "Sincronizar marcas"}</button></>}
      />
      {brands.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {brands.map((brand: any) => <article key={brand.id} className="gd-panel group overflow-hidden">
          <div className="relative h-32 border-b border-border bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/.28),transparent_36%),radial-gradient(circle_at_85%_20%,hsl(var(--primary)/.12),transparent_42%),linear-gradient(145deg,#050505,#11100d)] bg-cover bg-center" style={brand.metadata?.banner_url ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.08)),url(${brand.metadata.banner_url})` } : undefined}>
            <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-2xl border border-primary/25 bg-black/55 text-primary shadow-[0_0_24px_hsl(var(--primary)/.15)]"><UsersRound className="h-5 w-5" /></span>
            <span className="absolute right-4 top-4 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-400">Integrada</span>
            <button type="button" onClick={() => togglePinnedBrand(brand)} aria-label={pinnedBrandKeys.has(String(brand.metadata?.meta_account_id || brand.metadata?.ad_account_id || brand.id)) ? `Remover ${brand.name} do início` : `Deixar ${brand.name} no início`} title={pinnedBrandKeys.has(String(brand.metadata?.meta_account_id || brand.metadata?.ad_account_id || brand.id)) ? "Remover do início" : "Deixar no início"} className={cn("absolute bottom-3 left-3 grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-black/70 text-white backdrop-blur-md transition hover:bg-black/85", pinnedBrandKeys.has(String(brand.metadata?.meta_account_id || brand.metadata?.ad_account_id || brand.id)) && "border-primary/65 bg-primary text-primary-foreground")}><Star className="h-3.5 w-3.5" fill={pinnedBrandKeys.has(String(brand.metadata?.meta_account_id || brand.metadata?.ad_account_id || brand.id)) ? "currentColor" : "none"} /></button>
            <label className="absolute bottom-3 right-3 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2.5 text-[9px] font-black text-white backdrop-blur-md transition hover:bg-black/85">
              <ImageUp className="h-3.5 w-3.5" />{uploadingBrand === brand.id ? "Enviando…" : "Alterar banner"}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingBrand === brand.id} className="sr-only" onChange={(event) => { void uploadBanner(brand, event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </label>
          </div>
          <div className="p-4">
            <h2 className="truncate text-sm font-black" title={brand.name}>{brand.name}</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">Meta Ads · {brand.metadata?.meta_account_id || "ID em sincronização"}</p>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg border border-border bg-background/50 p-2"><span className="block text-[8px] font-black uppercase text-muted-foreground">Contas</span><strong className="mt-1 block text-sm">1</strong></div><div className="rounded-lg border border-border bg-background/50 p-2"><span className="block text-[8px] font-black uppercase text-muted-foreground">Status</span><strong className="mt-1 block text-sm text-emerald-500">Ativa</strong></div></div>
            <Link to={`/marcas/${encodeURIComponent(brand.id)}`} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary">Abrir diagnóstico <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </article>)}
      </div> : <EmptyState icon={<UsersRound className="h-6 w-6" />} title="Nenhuma conta integrada" description="Ao integrar uma conta Meta Ads, a marca correspondente será criada automaticamente e aparecerá aqui, mesmo antes de receber métricas." action={<Link to="/integracoes" className="gold-action"><Plus className="h-4 w-4" /> Integrar primeira conta</Link>} />}
    </Page>
    </div>
  );
}

function MetaConnectModule() {
  const [tab, setTab] = useState("dashboard");
  const [manualOpen, setManualOpen] = useState(false);
  const { data: accounts = [], isLoading } = useAdAccounts();
  const { data: socialAccounts = [] } = useQuery({ queryKey: ["social_accounts"], queryFn: async () => { const { data, error } = await supabase.from("social_accounts").select("id,username,display_name,connection_status,last_sync_at").order("created_at", { ascending: false }); if (error) throw error; return data || []; }, retry: false });
  const connectMeta = useMetaOAuth();
  const connectInstagram = useInstagramOAuth();
  const connected = useMemo(() => accounts.filter((account) => account.connection_status === "connected"), [accounts]);
  return (
    <Page title="Meta Connect" description="Uma conexão única para Facebook, contas de anúncio e Instagram profissional." action={<div className="flex flex-wrap gap-2"><Button onClick={() => connectMeta.mutate()} disabled={connectMeta.isPending}><Facebook className="mr-2 h-4 w-4" />{connectMeta.isPending ? "Abrindo Facebook…" : "Entrar com Facebook"}</Button><Button variant="outline" onClick={() => setManualOpen(true)}>ID e token</Button></div>}>
      <Tabs options={[{ id: "dashboard", label: "Dashboard" }, { id: "accounts", label: "Contas de anúncio" }, { id: "instagram", label: "Instagram" }, { id: "settings", label: "Configurações" }]} value={tab} onChange={setTab} />
      {tab === "dashboard" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><ConnectionCard icon={<Facebook />} label="Facebook" value={connected.length ? "Conectado" : "Desconectado"} /><ConnectionCard icon={<Instagram />} label="Perfis Instagram" value={socialAccounts.length ? `${socialAccounts.length} conectado(s)` : "Não conectado"} /><ConnectionCard icon={<CircleDot />} label="Contas de anúncio" value={isLoading ? "Carregando…" : String(connected.length)} /><ConnectionCard icon={<Clock3 />} label="Última sincronização" value={connected.length || socialAccounts.length ? "Automática após o login" : "Aguardando conexão"} /></div>}
      {tab === "accounts" && (connected.length ? <div className="grid gap-3 md:grid-cols-2">{connected.map((account) => <article key={account.id} className="gd-panel flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Facebook className="h-5 w-5" /></span><div className="min-w-0 grow"><b className="block truncate text-sm">{account.name}</b><span className="text-xs text-muted-foreground">{account.account_id}</span></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-400">Conectada</span></article>)}</div> : <EmptyState icon={<Facebook className="h-6 w-6" />} title="Nenhuma conta Meta conectada" description="Use o login oficial da Meta ou a conexão manual segura disponível em Integrações." action={<Link to="/integracoes" className="gold-action">Abrir integrações <ArrowRight className="h-4 w-4" /></Link>} />)}
      {tab === "instagram" && (socialAccounts.length ? <div className="grid gap-3 md:grid-cols-2">{socialAccounts.map((account: any) => <article key={account.id} className="gd-panel flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pink-500/10 text-pink-400"><Instagram className="h-5 w-5" /></span><div className="min-w-0 grow"><b className="block truncate text-sm">{account.display_name}</b><span className="text-xs text-muted-foreground">@{account.username || "perfil"} · {account.connection_status}</span></div><Link to="/midia-social" className="gd-button">Analisar</Link></article>)}</div> : <EmptyState icon={<Instagram className="h-6 w-6" />} title="Perfis do Instagram" description="Conecte sua conta profissional para importar seguidores, crescimento, Reels e retenção de vídeo." action={<Button onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}><Instagram className="mr-2 h-4 w-4" />{connectInstagram.isPending ? "Abrindo Instagram…" : "Conectar Instagram"}</Button>} />)}
      {tab === "settings" && <div className="gd-panel divide-y divide-border"><SettingRow title="Sincronização automática" description="Atualiza contas autorizadas sem expor tokens no navegador." href="/integracoes?tab=health" /><SettingRow title="Permissões Meta" description="ads_read, ads_management, business_management e leads_retrieval." href="/integracoes?tab=paid" /><SettingRow title="Saúde dos tokens" description="Audite expiração, permissões e falhas de acesso." href="/saude-dos-dados" /></div>}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Conexão manual Meta</DialogTitle></DialogHeader><MetaManualConnectionCard onConnected={() => setManualOpen(false)} /></DialogContent></Dialog>
    </Page>
  );
}

function FunnelAIModule() {
  return (
    <Page title="IA do Funil" description="Diagnósticos baseados nos dados reais de Meta Ads e RD Station da conta selecionada." action={<Link to="/analise-de-funis" className="gold-action"><Sparkles className="h-4 w-4" /> Analisar funil</Link>}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <EmptyState icon={<Bot className="h-6 w-6" />} title="Selecione um funil com dados sincronizados" description="A IA só gera recomendações quando houver período, conta Meta e funil RD válidos. Nenhum diagnóstico é inventado para preencher a tela." action={<Link to="/analise-de-funis" className="gd-button">Abrir Análise de Funis <ArrowRight className="h-4 w-4" /></Link>} />
        <div className="gd-panel p-5"><h2 className="font-black">O que será analisado</h2><div className="mt-4 space-y-3">{["Gargalos entre etapas", "CPL, CAC e ROAS reconciliados", "Tempo parado e velocidade", "Origem, estado, dia e horário"].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{item}</div>)}</div></div>
      </div>
    </Page>
  );
}

function Page({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1600px]"><PageHeading title={title} description={description} actions={action} />{children}</div>;
}

function Toolbar({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 flex-col gap-2 sm:flex-row">{left}</div><div className="flex min-w-0 flex-col gap-2 sm:flex-row">{right}</div></div>;
}

function SearchField({ placeholder }: { placeholder: string }) {
  return <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-64"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label={placeholder} placeholder={placeholder} className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>;
}

function ConnectionCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className="gd-panel p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><span className="mt-5 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span><strong className="mt-1 block text-lg">{value}</strong></article>;
}

function SettingRow({ title, description, href }: { title: string; description: string; href: string }) {
  return <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 grow"><b className="text-sm">{title}</b><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Link to={href} className="gd-button"><Settings2 className="h-4 w-4" /> Configurar</Link></div>;
}

export default function ModulePage() {
  const { pathname } = useLocation();
  if (pathname === "/automacoes") return <AutomationsModule />;
  if (pathname === "/kanban") return <KanbanModule />;
  if (pathname === "/chamados") return <TicketsModule />;
  if (pathname === "/marcas") return <BrandsModule />;
  if (pathname === "/meta-connect") return <MetaConnectModule />;
  if (pathname === "/agentes" || pathname === "/neural-core") return <AgentsOfficePage />;
  if (pathname === "/life-sim") return <LifeSimPage />;
  if (pathname === "/ia-do-funil") return <FunnelAIModule />;
  return <Navigate to="/" replace />;
}
