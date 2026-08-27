import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, Columns3, Headphones, LayoutGrid, List, ListTodo, Megaphone, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { PageHeading } from "./shared";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Board = { id: string; name: string; description: string | null; created_at: string };
type KanbanList = { id: string; board_id: string; name: string; position: number };
type KanbanCard = { id: string; list_id: string; title: string; description: string | null; due_date: string | null; priority: string; position: number };
type BoardTemplate = {
  id: string;
  name: string;
  description: string;
  columns: string[];
  cards: Array<{ column: string; title: string; priority?: string }>;
  icon: typeof BriefcaseBusiness;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente em alguns instantes.";
}

const PRIORITIES = [{ value: "none", label: "Sem prioridade" }, { value: "low", label: "Baixa" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }, { value: "urgent", label: "Urgente" }];

const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "sales",
    name: "Comercial e vendas",
    description: "Acompanhe leads, oportunidades, propostas, follow-ups e fechamentos.",
    columns: ["Novos leads", "Contato", "Qualificação", "Proposta", "Ganho"],
    cards: [
      { column: "Novos leads", title: "Definir critérios de qualificação", priority: "medium" },
      { column: "Contato", title: "Agendar primeiro contato", priority: "high" },
      { column: "Proposta", title: "Enviar proposta comercial", priority: "high" },
    ],
    icon: BriefcaseBusiness,
  },
  {
    id: "paid-traffic",
    name: "Operação de tráfego pago",
    description: "Organize alertas, otimizações, criativos e validações de cada conta de anúncio.",
    columns: ["Radar e alertas", "Diagnóstico", "Em otimização", "Aguardando dados", "Validado"],
    cards: [
      { column: "Radar e alertas", title: "Verificar campanhas com CPL acima da meta", priority: "high" },
      { column: "Diagnóstico", title: "Analisar criativos e frequência da campanha", priority: "medium" },
      { column: "Em otimização", title: "Testar variação de criativo e copy", priority: "high" },
      { column: "Aguardando dados", title: "Aguardar janela mínima de aprendizado", priority: "low" },
    ],
    icon: Megaphone,
  },
  {
    id: "management",
    name: "Gestão da operação",
    description: "Centralize prioridades, responsáveis, reuniões e entregas do time.",
    columns: ["Prioridades", "Esta semana", "Em andamento", "Bloqueado", "Concluído"],
    cards: [
      { column: "Prioridades", title: "Revisar saúde e riscos das contas", priority: "high" },
      { column: "Esta semana", title: "Definir responsáveis e prazos", priority: "medium" },
      { column: "Em andamento", title: "Acompanhar plano de ação da operação", priority: "high" },
      { column: "Bloqueado", title: "Registrar dependência externa", priority: "medium" },
    ],
    icon: ListTodo,
  },
  {
    id: "marketing",
    name: "Calendário de marketing",
    description: "Organize o ciclo de produção de campanhas, conteúdos e criativos.",
    columns: ["Ideias", "Em produção", "Revisão", "Agendado", "Publicado"],
    cards: [
      { column: "Ideias", title: "Pauta da próxima campanha", priority: "medium" },
      { column: "Em produção", title: "Criar briefing do criativo", priority: "high" },
      { column: "Revisão", title: "Validar copy e CTA", priority: "medium" },
    ],
    icon: Megaphone,
  },
  {
    id: "sprint",
    name: "Sprint de produto",
    description: "Planeje uma sprint com visão de backlog, execução e entrega.",
    columns: ["Backlog", "Próxima sprint", "Em andamento", "Em revisão", "Concluído"],
    cards: [
      { column: "Backlog", title: "Registrar próxima melhoria", priority: "low" },
      { column: "Próxima sprint", title: "Definir critério de aceite", priority: "medium" },
      { column: "Em revisão", title: "Validar entrega com o time", priority: "high" },
    ],
    icon: ListTodo,
  },
  {
    id: "support",
    name: "Atendimento e operação",
    description: "Controle solicitações, pendências e resoluções da operação.",
    columns: ["Entrada", "Em atendimento", "Aguardando retorno", "Resolvido"],
    cards: [
      { column: "Entrada", title: "Triar novas solicitações", priority: "high" },
      { column: "Em atendimento", title: "Atualizar responsável e prazo", priority: "medium" },
      { column: "Aguardando retorno", title: "Fazer follow-up com cliente", priority: "medium" },
    ],
    icon: Headphones,
  },
];

export default function KanbanPage() {
  const { data: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [boardDialog, setBoardDialog] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [cardDialog, setCardDialog] = useState<{ listId: string; card?: KanbanCard } | null>(null);
  const [listDialog, setListDialog] = useState(false);
  const [boardForm, setBoardForm] = useState({ name: "", description: "" });
  const [boardTemplate, setBoardTemplate] = useState("sales");
  const [listName, setListName] = useState("");
  const [cardForm, setCardForm] = useState({ title: "", description: "", due_date: "", priority: "none", list_id: "" });
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const boardsQuery = useQuery({
    queryKey: ["kanban_boards", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_boards").select("id,name,description,created_at").eq("workspace_id", workspace!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Board[];
    },
  });
  const activeBoard = boardsQuery.data?.find((board) => board.id === selectedBoardId) || null;
  const detailsQuery = useQuery({
    queryKey: ["kanban_board_details", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const { data: lists, error: listError } = await supabase.from("kanban_lists").select("id,board_id,name,position").eq("board_id", selectedBoardId).order("position");
      if (listError) throw listError;
      const ids = (lists || []).map((list: KanbanList) => list.id);
      if (!ids.length) return { lists: lists as KanbanList[], cards: [] as KanbanCard[] };
      const { data: cards, error: cardError } = await supabase.from("kanban_cards").select("id,list_id,title,description,due_date,priority,position").in("list_id", ids).order("position");
      if (cardError) throw cardError;
      return { lists: (lists || []) as KanbanList[], cards: (cards || []) as KanbanCard[] };
    },
  });
  const details = detailsQuery.data || { lists: [], cards: [] };
  const visibleBoards = useMemo(() => (boardsQuery.data || []).filter((board) => board.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [boardsQuery.data, search]);

  function invalidate(boardId = selectedBoardId) {
    void queryClient.invalidateQueries({ queryKey: ["kanban_boards", workspace?.id] });
    void queryClient.invalidateQueries({ queryKey: ["kanban_board_details", boardId] });
  }

  async function createBoard() {
    if (!workspace?.id || !boardForm.name.trim() || creatingBoard) return;
    let createdBoardId: string | null = null;
    setCreatingBoard(true);
    try {
      const template = BOARD_TEMPLATES.find((item) => item.id === boardTemplate) ?? BOARD_TEMPLATES[0];
      const { data: board, error } = await supabase.from("kanban_boards").insert({ workspace_id: workspace.id, name: boardForm.name.trim(), description: boardForm.description.trim() || template.description }).select("id").single();
      if (error) throw error;
      createdBoardId = board.id;
      const { data: createdLists, error: listError } = await supabase.from("kanban_lists").insert(template.columns.map((name, position) => ({ board_id: board.id, name, position }))).select("id,name");
      if (listError) throw listError;
      const listByName = new Map((createdLists || []).map((list: { id: string; name: string }) => [list.name, list.id]));
      const starterCards = template.cards.flatMap((card, position) => {
        const listId = listByName.get(card.column);
        return listId ? [{ list_id: listId, title: card.title, description: null, due_date: null, priority: card.priority || "none", position }] : [];
      });
      if (starterCards.length) {
        const { error: cardError } = await supabase.from("kanban_cards").insert(starterCards);
        if (cardError) throw cardError;
      }
      setBoardDialog(false); setBoardForm({ name: "", description: "" }); setBoardTemplate("sales"); setSelectedBoardId(board.id); invalidate(board.id);
      toast({ title: "Quadro criado" });
    } catch (error: unknown) {
      if (createdBoardId) {
        const { error: cleanupError } = await supabase.from("kanban_boards").delete().eq("id", createdBoardId);
        if (cleanupError) {
          toast({ title: "O quadro foi criado parcialmente", description: "Não foi possível concluir o template nem removê-lo automaticamente. Atualize a tela e tente novamente.", variant: "destructive" });
          return;
        }
      }
      toast({ title: "Não foi possível criar o quadro", description: errorMessage(error), variant: "destructive" });
    } finally { setCreatingBoard(false); }
  }

  async function createList() {
    if (!selectedBoardId || !listName.trim() || creatingList) return;
    setCreatingList(true);
    try {
      const position = details.lists.length ? Math.max(...details.lists.map((list) => list.position)) + 1 : 0;
      const { error } = await supabase.from("kanban_lists").insert({ board_id: selectedBoardId, name: listName.trim(), position });
      if (error) throw error;
      setListDialog(false); setListName(""); invalidate();
    } catch (error: unknown) { toast({ title: "Não foi possível criar a coluna", description: errorMessage(error), variant: "destructive" }); } finally { setCreatingList(false); }
  }

  async function renameList(list: KanbanList, name: string) {
    if (!selectedBoardId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Informe um nome para a etapa", variant: "destructive" });
      throw new Error("Nome da etapa vazio");
    }
    const { error } = await supabase.from("kanban_lists").update({ name: trimmed }).eq("id", list.id).eq("board_id", selectedBoardId);
    if (error) {
      toast({ title: "Não foi possível renomear a etapa", description: errorMessage(error), variant: "destructive" });
      throw error;
    }
    invalidate(selectedBoardId);
    toast({ title: "Etapa renomeada" });
  }

  async function deleteBoard() {
    if (!workspace?.id || !boardToDelete || deletingBoard) return;
    setDeletingBoard(true);
    try {
      // O filtro do workspace é uma segunda barreira no cliente. O banco ainda
      // aplica RLS; se ele não devolver a linha, não escondemos uma falha de
      // permissão como se a exclusão tivesse funcionado.
      const { data, error } = await supabase
        .from("kanban_boards")
        .delete()
        .eq("id", boardToDelete.id)
        .eq("workspace_id", workspace.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Você não tem permissão para excluir este quadro ou ele já foi removido.");
      const removedId = boardToDelete.id;
      setBoardToDelete(null);
      if (selectedBoardId === removedId) setSelectedBoardId(null);
      queryClient.removeQueries({ queryKey: ["kanban_board_details", removedId] });
      invalidate();
      toast({ title: "Projeto excluído", description: "As colunas e cartões vinculados também foram removidos." });
    } catch (error: unknown) {
      toast({ title: "Não foi possível excluir o projeto", description: errorMessage(error), variant: "destructive" });
    } finally {
      setDeletingBoard(false);
    }
  }

  async function saveCard() {
    if (!cardDialog || !cardForm.title.trim() || savingCard) return;
    setSavingCard(true);
    try {
      if (cardDialog.card) {
        const updates = { title: cardForm.title.trim(), description: cardForm.description.trim() || null, due_date: cardForm.due_date || null, priority: cardForm.priority };
        const targetListId = cardForm.list_id || cardDialog.card.list_id;
        if (targetListId === cardDialog.card.list_id) {
          const { error } = await supabase.from("kanban_cards").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", cardDialog.card.id);
          if (error) throw error;
        } else if (!await moveCard(cardDialog.card, targetListId, undefined, updates)) {
          return;
        }
      } else {
        const position = details.cards.filter((card) => card.list_id === cardDialog.listId).length;
        const { error } = await supabase.from("kanban_cards").insert({ list_id: cardDialog.listId, title: cardForm.title.trim(), description: cardForm.description.trim() || null, due_date: cardForm.due_date || null, priority: cardForm.priority, position });
        if (error) throw error;
      }
      setCardDialog(null); invalidate();
    } catch (error: unknown) { toast({ title: "Não foi possível salvar o cartão", description: errorMessage(error), variant: "destructive" }); } finally { setSavingCard(false); }
  }

  async function moveCard(card: KanbanCard, listId: string, targetPosition?: number, updates?: Pick<KanbanCard, "title" | "description" | "due_date" | "priority">) {
    const sourceListId = card.list_id;
    const sourceCards = details.cards.filter((item) => item.list_id === sourceListId && item.id !== card.id).sort((a, b) => a.position - b.position);
    const targetCards = sourceListId === listId
      ? sourceCards
      : details.cards.filter((item) => item.list_id === listId && item.id !== card.id).sort((a, b) => a.position - b.position);
    const position = Math.max(0, Math.min(targetPosition ?? targetCards.length, targetCards.length));
    const nextTargetCards = [...targetCards];
    nextTargetCards.splice(position, 0, { ...card, ...updates, list_id: listId, position });
    try {
      if (sourceListId !== listId) {
        const { error } = await supabase.from("kanban_cards").update({ ...updates, list_id: listId, position, updated_at: new Date().toISOString() }).eq("id", card.id);
        if (error) throw error;
      }
      const touched = sourceListId === listId ? nextTargetCards : [...sourceCards, ...nextTargetCards];
      for (const item of touched) {
        const nextPosition = (sourceListId === listId ? nextTargetCards : item.list_id === sourceListId ? sourceCards : nextTargetCards).findIndex((candidate) => candidate.id === item.id);
        if (nextPosition < 0 || (item.id === card.id && sourceListId !== listId)) continue;
        const { error } = await supabase.from("kanban_cards").update({ ...(item.id === card.id ? updates : {}), list_id: item.list_id, position: nextPosition, updated_at: new Date().toISOString() }).eq("id", item.id);
        if (error) throw error;
      }
      invalidate();
      return true;
    } catch (error: unknown) { toast({ title: "Não foi possível mover o cartão", description: errorMessage(error), variant: "destructive" }); return false; }
  }

  async function deleteCard(card: KanbanCard) {
    if (!window.confirm(`Excluir o cartão “${card.title}”?`)) return;
    const { error } = await supabase.from("kanban_cards").delete().eq("id", card.id);
    if (error) toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" }); else invalidate();
  }

  function openCard(listId: string, card?: KanbanCard) {
    setCardDialog({ listId, card });
    setCardForm({ title: card?.title || "", description: card?.description || "", due_date: card?.due_date || "", priority: card?.priority || "none", list_id: card?.list_id || listId });
  }

  if (activeBoard) {
    const ViewIcon = viewMode === "kanban" ? List : LayoutGrid;
    return <div className="gd-module-shell mx-auto max-w-[1700px] space-y-5">
    <PageHeading eyebrow="Operação visual" title={activeBoard.name} description={activeBoard.description || "Quadro compartilhado para tarefas, CRM e operação."} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setViewMode((mode) => mode === "kanban" ? "list" : "kanban")}><ViewIcon className="mr-2 h-4 w-4" />{viewMode === "kanban" ? "Modo ClickUp" : "Modo Trello"}</Button><Button variant="outline" onClick={() => setSelectedBoardId(null)}><ArrowLeft className="mr-2 h-4 w-4" />Quadros</Button><Button onClick={() => setListDialog(true)}><Plus className="mr-2 h-4 w-4" />Coluna</Button><Button variant="destructive" onClick={() => setBoardToDelete(activeBoard)}><Trash2 className="mr-2 h-4 w-4" />Excluir projeto</Button></div>} />
    {detailsQuery.isLoading ? <div className="gd-panel grid min-h-96 place-items-center text-sm text-muted-foreground" role="status" aria-live="polite">Carregando quadro…</div> : detailsQuery.isError ? <div className="gd-panel grid min-h-96 place-items-center p-8 text-center"><div><LayoutGrid className="mx-auto h-8 w-8 text-destructive" /><h2 className="mt-3 font-black">Não foi possível carregar este quadro</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage(detailsQuery.error)}</p><Button className="mt-4" variant="outline" onClick={() => void detailsQuery.refetch()}>Tentar novamente</Button></div></div> : viewMode === "kanban" ? <div className="flex min-h-[560px] items-start gap-3 overflow-x-auto pb-4">{details.lists.map((list) => <KanbanColumn key={list.id} list={list} cards={details.cards.filter((card) => card.list_id === list.id).sort((a, b) => a.position - b.position)} onDrop={(cardId, targetPosition) => { const card = details.cards.find((item) => item.id === cardId); if (card) void moveCard(card, list.id, targetPosition); }} onAdd={() => openCard(list.id)} onEdit={openCard} onDelete={deleteCard} onRename={renameList} />)}</div> : <div className="gd-panel overflow-hidden"><div className="divide-y divide-border">{details.lists.map((list) => <KanbanListSection key={list.id} list={list} cards={details.cards.filter((card) => card.list_id === list.id).sort((a, b) => a.position - b.position)} onAdd={() => openCard(list.id)} onEdit={openCard} onRename={renameList} />)}</div></div>}
    <CardDialog dialog={cardDialog} form={cardForm} lists={details.lists} saving={savingCard} setForm={setCardForm} onClose={() => setCardDialog(null)} onSave={() => void saveCard()} />
    <Dialog open={listDialog} onOpenChange={setListDialog}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Nova coluna</DialogTitle></DialogHeader><Label htmlFor="kanban-list-name">Nome</Label><Input id="kanban-list-name" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Ex.: Em revisão" /><DialogFooter><Button variant="outline" onClick={() => setListDialog(false)} disabled={creatingList}>Cancelar</Button><Button onClick={() => void createList()} disabled={creatingList || !listName.trim()}>{creatingList ? "Criando…" : "Criar coluna"}</Button></DialogFooter></DialogContent></Dialog>
    <BoardDeleteDialog board={boardToDelete} deleting={deletingBoard} onClose={() => !deletingBoard && setBoardToDelete(null)} onConfirm={() => void deleteBoard()} />
    </div>;
  }

  return <div className="mx-auto max-w-[1500px]"><PageHeading eyebrow="Operação visual" title="Quadros" description="Escolha o modo Trello para fluxo visual ou ClickUp para uma lista operacional." actions={<Button onClick={() => setBoardDialog(true)}><Plus className="mr-2 h-4 w-4" />Novo quadro</Button>} /><div className="gd-panel mb-4 flex items-center gap-2 p-3"><Search className="h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar quadro" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar quadro" className="border-0 bg-transparent shadow-none focus-visible:ring-0" /></div>{boardsQuery.isLoading ? <div className="gd-panel grid min-h-64 place-items-center text-sm text-muted-foreground">Carregando quadros…</div> : boardsQuery.isError ? <div className="gd-panel grid min-h-64 place-items-center p-8 text-center"><div><LayoutGrid className="mx-auto h-8 w-8 text-destructive" /><h2 className="mt-3 font-black">Não foi possível carregar os quadros</h2><p className="mt-1 text-sm text-muted-foreground">Verifique a conexão e tente novamente.</p><Button className="mt-4" variant="outline" onClick={() => void boardsQuery.refetch()}>Tentar novamente</Button></div></div> : visibleBoards.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleBoards.map((board) => <article key={board.id} className="gd-panel group relative p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/50"><button type="button" onClick={() => setSelectedBoardId(board.id)} className="block w-full text-left"><LayoutGrid className="h-6 w-6 text-primary" /><h2 className="mt-4 pr-8 font-black">{board.name}</h2><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{board.description || "Sem descrição."}</p><span className="mt-5 inline-flex items-center gap-1 text-[10px] font-black text-primary">Abrir quadro <ArrowLeft className="h-3 w-3 rotate-180 transition-transform group-hover:translate-x-1" /></span></button><Button variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Excluir projeto ${board.name}`} title={`Excluir projeto ${board.name}`} onClick={() => setBoardToDelete(board)}><Trash2 className="h-4 w-4" /></Button></article>)}</div> : <div className="gd-panel grid min-h-64 place-items-center p-8 text-center"><div><LayoutGrid className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-3 font-black">Nenhum quadro criado</h2><p className="mt-1 text-sm text-muted-foreground">Crie um quadro para começar a organizar sua operação.</p><Button className="mt-4" onClick={() => setBoardDialog(true)}><Plus className="mr-2 h-4 w-4" />Criar primeiro quadro</Button></div></div>}
    <Dialog open={boardDialog} onOpenChange={setBoardDialog}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Começar um quadro</DialogTitle></DialogHeader><div className="space-y-5"><div><Label className="text-xs uppercase tracking-[.14em] text-muted-foreground">Escolha um template pronto</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{BOARD_TEMPLATES.map((template) => { const Icon = template.icon; const selected = boardTemplate === template.id; return <button key={template.id} type="button" aria-pressed={selected} onClick={() => { setBoardTemplate(template.id); setBoardForm((form) => ({ name: form.name.trim() ? form.name : template.name, description: form.description.trim() ? form.description : template.description })); }} disabled={creatingBoard} className={cn("rounded-xl border p-3 text-left transition", selected ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/.35)]" : "border-border bg-muted/20 hover:border-primary/50")}><div className="flex items-start gap-3"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}><Icon className="h-4 w-4" /></span><span className="min-w-0"><strong className="block text-sm">{template.name}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span></span></div><span className="mt-2 block text-[10px] font-bold text-primary">{template.columns.length} colunas · {template.cards.length} cartões iniciais</span></button>; })}</div></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="kanban-board-name">Nome do quadro</Label><Input id="kanban-board-name" value={boardForm.name} onChange={(event) => setBoardForm({ ...boardForm, name: event.target.value })} placeholder="Pipeline comercial" disabled={creatingBoard} /></div><div><Label htmlFor="kanban-board-description">Descrição personalizada</Label><Textarea id="kanban-board-description" value={boardForm.description} onChange={(event) => setBoardForm({ ...boardForm, description: event.target.value })} placeholder="Como este quadro será usado?" disabled={creatingBoard} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setBoardDialog(false)} disabled={creatingBoard}>Cancelar</Button><Button onClick={() => void createBoard()} disabled={creatingBoard || !boardForm.name.trim()}><Plus className="mr-2 h-4 w-4" />{creatingBoard ? "Criando quadro…" : "Criar quadro com template"}</Button></DialogFooter></DialogContent></Dialog>
    <BoardDeleteDialog board={boardToDelete} deleting={deletingBoard} onClose={() => !deletingBoard && setBoardToDelete(null)} onConfirm={() => void deleteBoard()} />
  </div>;
}

function BoardDeleteDialog({ board, deleting, onClose, onConfirm }: { board: Board | null; deleting: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Dialog open={!!board} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Excluir projeto?</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">Você está prestes a excluir <b className="text-foreground">{board?.name}</b>. As colunas e cartões vinculados serão removidos permanentemente.</p><DialogFooter><Button variant="outline" onClick={onClose} disabled={deleting}>Cancelar</Button><Button variant="destructive" onClick={onConfirm} disabled={deleting}>{deleting ? "Excluindo…" : "Excluir projeto"}</Button></DialogFooter></DialogContent></Dialog>;
}

function KanbanListSection({ list, cards, onAdd, onEdit, onRename }: { list: KanbanList; cards: KanbanCard[]; onAdd: () => void; onEdit: (listId: string, card: KanbanCard) => void; onRename: (list: KanbanList, name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [saving, setSaving] = useState(false);
  const cancel = () => { setName(list.name); setEditing(false); };
  const save = async () => { if (!name.trim() || saving) return; setSaving(true); try { await onRename(list, name); setEditing(false); } finally { setSaving(false); } };
  return <section className="p-4"><div className="mb-2 flex items-center gap-2"><Columns3 className="h-4 w-4 shrink-0 text-primary" />{editing ? <Input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") cancel(); }} autoFocus disabled={saving} aria-label={`Nome da etapa ${list.name}`} className="h-8 max-w-sm text-sm font-black" /> : <h2 className="font-black">{list.name}</h2>}<span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{cards.length}</span><div className="ml-auto flex items-center gap-1">{editing ? <><Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={() => void save()} disabled={saving || !name.trim()} aria-label="Salvar nome da etapa"><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={cancel} disabled={saving} aria-label="Cancelar edição da etapa"><X className="h-4 w-4" /></Button></> : <Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={() => { setName(list.name); setEditing(true); }} aria-label={`Editar etapa ${list.name}`} title="Editar nome da etapa"><Pencil className="h-4 w-4" /></Button>}</div></div>{cards.map((card) => <button key={card.id} type="button" onClick={() => onEdit(list.id, card)} className="flex w-full items-center gap-3 border-t border-border/60 py-3 text-left text-sm hover:bg-muted/30"><span className="min-w-0 grow truncate">{card.title}</span><PriorityBadge priority={card.priority} /><span className="text-[10px] text-muted-foreground">{card.due_date ? format(new Date(`${card.due_date}T12:00:00`), "dd/MM/yyyy") : ""}</span></button>)}<Button variant="ghost" className="kanban-add-card mt-2 w-full justify-start text-xs font-bold" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar cartão</Button></section>;
}

function KanbanColumn({ list, cards, onDrop, onAdd, onEdit, onDelete, onRename }: { list: KanbanList; cards: KanbanCard[]; onDrop: (cardId: string, targetPosition?: number) => void; onAdd: () => void; onEdit: (listId: string, card: KanbanCard) => void; onDelete: (card: KanbanCard) => void; onRename: (list: KanbanList, name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [saving, setSaving] = useState(false);
  const cancel = () => { setName(list.name); setEditing(false); };
  const save = async () => { if (!name.trim() || saving) return; setSaving(true); try { await onRename(list, name); setEditing(false); } finally { setSaving(false); } };
  return <section className="gd-panel w-[300px] shrink-0 bg-muted/25 p-3" aria-label={`Coluna ${list.name}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/kanban-card"); if (id) onDrop(id, cards.length); }}><header className="mb-3 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Columns3 className="h-4 w-4 shrink-0 text-primary" />{editing ? <Input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") cancel(); }} autoFocus disabled={saving} aria-label={`Nome da etapa ${list.name}`} className="h-8 min-w-0 text-sm font-black" /> : <h2 className="truncate text-sm font-black">{list.name}</h2>}<span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">{cards.length}</span></div><div className="flex items-center gap-1">{editing ? <><Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={() => void save()} disabled={saving || !name.trim()} aria-label="Salvar nome da etapa"><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={cancel} disabled={saving} aria-label="Cancelar edição da etapa"><X className="h-4 w-4" /></Button></> : <><Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={() => { setName(list.name); setEditing(true); }} aria-label={`Editar etapa ${list.name}`} title="Editar nome da etapa"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="kanban-column-action h-8 w-8" onClick={onAdd} aria-label={`Adicionar em ${list.name}`}><Plus className="h-4 w-4" /></Button></>}</div></header><div className="min-h-24 space-y-2" role="list">{cards.map((card, index) => <article key={card.id} role="listitem" aria-label={`Cartão ${card.title}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/kanban-card", card.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const id = event.dataTransfer.getData("text/kanban-card"); if (id) onDrop(id, index); }} className="group cursor-grab rounded-xl border border-border bg-background p-3 shadow-sm active:cursor-grabbing"><div className="flex items-start gap-2"><button type="button" onClick={() => onEdit(list.id, card)} className="min-w-0 grow text-left"><b className="block break-words text-xs">{card.title}</b>{card.description && <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{card.description}</p>}</button><button type="button" onClick={() => onDelete(card)} className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Excluir cartão ${card.title}`}><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-muted-foreground"><PriorityBadge priority={card.priority} />{card.due_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(new Date(`${card.due_date}T12:00:00`), "dd/MM")}</span>}</div></article>)}{!cards.length && <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border p-4 text-[10px] text-muted-foreground">Arraste cartões para cá</div>}</div><Button variant="ghost" className="kanban-add-card mt-2 w-full justify-start text-xs font-bold" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar cartão</Button></section>;
}

function PriorityBadge({ priority }: { priority: string }) { const item = PRIORITIES.find((option) => option.value === priority); return item?.value === "none" ? null : <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black", item?.value === "urgent" ? "bg-rose-500/15 text-rose-500" : item?.value === "high" ? "bg-amber-500/15 text-amber-500" : item?.value === "medium" ? "bg-blue-500/15 text-blue-500" : "bg-muted text-muted-foreground")}>{item?.label}</span>; }

function CardDialog({ dialog, form, lists, saving, setForm, onClose, onSave }: { dialog: { listId: string; card?: KanbanCard } | null; form: { title: string; description: string; due_date: string; priority: string; list_id: string }; lists: KanbanList[]; saving: boolean; setForm: (form: { title: string; description: string; due_date: string; priority: string; list_id: string }) => void; onClose: () => void; onSave: () => void }) {
  return <Dialog open={!!dialog} onOpenChange={(open) => !open && !saving && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{dialog?.card ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader><div className="space-y-3"><div><Label htmlFor="kanban-card-title">Título</Label><Input id="kanban-card-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus disabled={saving} /></div><div><Label htmlFor="kanban-card-description">Descrição</Label><Textarea id="kanban-card-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} disabled={saving} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="kanban-card-due-date">Prazo</Label><Input id="kanban-card-due-date" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} disabled={saving} /></div><div><Label>Prioridade</Label><Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })} disabled={saving}><SelectTrigger aria-label="Prioridade do cartão"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div></div>{dialog?.card && <div><Label>Mover para coluna</Label><Select value={form.list_id} onValueChange={(value) => setForm({ ...form, list_id: value })} disabled={saving}><SelectTrigger aria-label="Coluna do cartão"><SelectValue /></SelectTrigger><SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent></Select></div>}</div><DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button onClick={onSave} disabled={saving || !form.title.trim()}><Check className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar cartão"}</Button></DialogFooter></DialogContent></Dialog>;
}
