import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, Columns3, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

const PRIORITIES = [{ value: "none", label: "Sem prioridade" }, { value: "low", label: "Baixa" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }, { value: "urgent", label: "Urgente" }];

export default function KanbanPage() {
  const { data: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [boardDialog, setBoardDialog] = useState(false);
  const [cardDialog, setCardDialog] = useState<{ listId: string; card?: KanbanCard } | null>(null);
  const [listDialog, setListDialog] = useState(false);
  const [boardForm, setBoardForm] = useState({ name: "", description: "" });
  const [listName, setListName] = useState("");
  const [cardForm, setCardForm] = useState({ title: "", description: "", due_date: "", priority: "none" });

  const boardsQuery = useQuery({
    queryKey: ["kanban_boards", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kanban_boards").select("id,name,description,created_at").eq("workspace_id", workspace!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Board[];
    },
  });
  const activeBoard = boardsQuery.data?.find((board) => board.id === selectedBoardId) || null;
  const detailsQuery = useQuery({
    queryKey: ["kanban_board_details", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const { data: lists, error: listError } = await (supabase as any).from("kanban_lists").select("id,board_id,name,position").eq("board_id", selectedBoardId).order("position");
      if (listError) throw listError;
      const ids = (lists || []).map((list: KanbanList) => list.id);
      if (!ids.length) return { lists: lists as KanbanList[], cards: [] as KanbanCard[] };
      const { data: cards, error: cardError } = await (supabase as any).from("kanban_cards").select("id,list_id,title,description,due_date,priority,position").in("list_id", ids).order("position");
      if (cardError) throw cardError;
      return { lists: (lists || []) as KanbanList[], cards: (cards || []) as KanbanCard[] };
    },
  });
  const details = detailsQuery.data || { lists: [], cards: [] };
  const visibleBoards = useMemo(() => (boardsQuery.data || []).filter((board) => board.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [boardsQuery.data, search]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["kanban_boards", workspace?.id] });
    void queryClient.invalidateQueries({ queryKey: ["kanban_board_details", selectedBoardId] });
  }

  async function createBoard() {
    if (!workspace?.id || !boardForm.name.trim()) return;
    try {
      const { data: board, error } = await (supabase as any).from("kanban_boards").insert({ workspace_id: workspace.id, name: boardForm.name.trim(), description: boardForm.description.trim() || null }).select("id").single();
      if (error) throw error;
      for (const [position, name] of ["A Fazer", "Em Progresso", "Concluído"].entries()) {
        const { error: listError } = await (supabase as any).from("kanban_lists").insert({ board_id: board.id, name, position });
        if (listError) throw listError;
      }
      setBoardDialog(false); setBoardForm({ name: "", description: "" }); setSelectedBoardId(board.id); invalidate();
      toast({ title: "Quadro criado" });
    } catch (error: any) { toast({ title: "Não foi possível criar o quadro", description: error.message, variant: "destructive" }); }
  }

  async function createList() {
    if (!selectedBoardId || !listName.trim()) return;
    try {
      const position = details.lists.length ? Math.max(...details.lists.map((list) => list.position)) + 1 : 0;
      const { error } = await (supabase as any).from("kanban_lists").insert({ board_id: selectedBoardId, name: listName.trim(), position });
      if (error) throw error;
      setListDialog(false); setListName(""); invalidate();
    } catch (error: any) { toast({ title: "Não foi possível criar a coluna", description: error.message, variant: "destructive" }); }
  }

  async function saveCard() {
    if (!cardDialog || !cardForm.title.trim()) return;
    try {
      if (cardDialog.card) {
        const { error } = await (supabase as any).from("kanban_cards").update({ title: cardForm.title.trim(), description: cardForm.description.trim() || null, due_date: cardForm.due_date || null, priority: cardForm.priority, updated_at: new Date().toISOString() }).eq("id", cardDialog.card.id);
        if (error) throw error;
      } else {
        const position = details.cards.filter((card) => card.list_id === cardDialog.listId).length;
        const { error } = await (supabase as any).from("kanban_cards").insert({ list_id: cardDialog.listId, title: cardForm.title.trim(), description: cardForm.description.trim() || null, due_date: cardForm.due_date || null, priority: cardForm.priority, position });
        if (error) throw error;
      }
      setCardDialog(null); invalidate();
    } catch (error: any) { toast({ title: "Não foi possível salvar o cartão", description: error.message, variant: "destructive" }); }
  }

  async function moveCard(card: KanbanCard, listId: string, targetPosition?: number) {
    const sourceListId = card.list_id;
    const sourceCards = details.cards.filter((item) => item.list_id === sourceListId && item.id !== card.id).sort((a, b) => a.position - b.position);
    const targetCards = sourceListId === listId
      ? sourceCards
      : details.cards.filter((item) => item.list_id === listId && item.id !== card.id).sort((a, b) => a.position - b.position);
    const position = Math.max(0, Math.min(targetPosition ?? targetCards.length, targetCards.length));
    const nextTargetCards = [...targetCards];
    nextTargetCards.splice(position, 0, { ...card, list_id: listId, position });
    try {
      if (sourceListId !== listId) {
        const { error } = await (supabase as any).from("kanban_cards").update({ list_id: listId, position, updated_at: new Date().toISOString() }).eq("id", card.id);
        if (error) throw error;
      }
      const touched = sourceListId === listId ? nextTargetCards : [...sourceCards, ...nextTargetCards];
      for (const item of touched) {
        const nextPosition = (sourceListId === listId ? nextTargetCards : item.list_id === sourceListId ? sourceCards : nextTargetCards).findIndex((candidate) => candidate.id === item.id);
        if (nextPosition < 0 || (item.id === card.id && sourceListId !== listId)) continue;
        const { error } = await (supabase as any).from("kanban_cards").update({ list_id: item.list_id, position: nextPosition, updated_at: new Date().toISOString() }).eq("id", item.id);
        if (error) throw error;
      }
      invalidate();
    } catch (error: any) { toast({ title: "Não foi possível mover o cartão", description: error.message, variant: "destructive" }); }
  }

  async function deleteCard(card: KanbanCard) {
    if (!window.confirm(`Excluir o cartão “${card.title}”?`)) return;
    const { error } = await (supabase as any).from("kanban_cards").delete().eq("id", card.id);
    if (error) toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" }); else invalidate();
  }

  function openCard(listId: string, card?: KanbanCard) {
    setCardDialog({ listId, card });
    setCardForm({ title: card?.title || "", description: card?.description || "", due_date: card?.due_date || "", priority: card?.priority || "none" });
  }

  if (activeBoard) {
    const ViewIcon = viewMode === "kanban" ? List : LayoutGrid;
    return <div className="mx-auto max-w-[1700px]">
    <PageHeading eyebrow="Operação visual" title={activeBoard.name} description={activeBoard.description || "Quadro compartilhado para tarefas, CRM e operação."} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setViewMode((mode) => mode === "kanban" ? "list" : "kanban")}><ViewIcon className="mr-2 h-4 w-4" />{viewMode === "kanban" ? "Modo ClickUp" : "Modo Trello"}</Button><Button variant="outline" onClick={() => setSelectedBoardId(null)}><ArrowLeft className="mr-2 h-4 w-4" />Quadros</Button><Button onClick={() => setListDialog(true)}><Plus className="mr-2 h-4 w-4" />Coluna</Button></div>} />
    {detailsQuery.isLoading ? <div className="gd-panel grid min-h-96 place-items-center text-sm text-muted-foreground">Carregando quadro…</div> : viewMode === "kanban" ? <div className="flex min-h-[560px] items-start gap-3 overflow-x-auto pb-4">{details.lists.map((list) => <KanbanColumn key={list.id} list={list} cards={details.cards.filter((card) => card.list_id === list.id).sort((a, b) => a.position - b.position)} onDrop={(cardId, targetPosition) => { const card = details.cards.find((item) => item.id === cardId); if (card) void moveCard(card, list.id, targetPosition); }} onAdd={() => openCard(list.id)} onEdit={openCard} onDelete={deleteCard} />)}</div> : <div className="gd-panel overflow-hidden"><div className="divide-y divide-border">{details.lists.map((list) => <section key={list.id} className="p-4"><div className="mb-2 flex items-center gap-2"><Columns3 className="h-4 w-4 text-primary" /><h2 className="font-black">{list.name}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{details.cards.filter((card) => card.list_id === list.id).length}</span></div>{details.cards.filter((card) => card.list_id === list.id).sort((a, b) => a.position - b.position).map((card) => <button key={card.id} type="button" onClick={() => openCard(list.id, card)} className="flex w-full items-center gap-3 border-t border-border/60 py-3 text-left text-sm hover:bg-muted/30"><span className="min-w-0 grow truncate">{card.title}</span><PriorityBadge priority={card.priority} /><span className="text-[10px] text-muted-foreground">{card.due_date ? format(new Date(`${card.due_date}T12:00:00`), "dd/MM/yyyy") : ""}</span></button>)}</section>)}</div></div>}
    <CardDialog dialog={cardDialog} form={cardForm} setForm={setCardForm} onClose={() => setCardDialog(null)} onSave={() => void saveCard()} />
    <Dialog open={listDialog} onOpenChange={setListDialog}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Nova coluna</DialogTitle></DialogHeader><Label>Nome</Label><Input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Ex.: Em revisão" /><DialogFooter><Button variant="outline" onClick={() => setListDialog(false)}>Cancelar</Button><Button onClick={() => void createList()}>Criar coluna</Button></DialogFooter></DialogContent></Dialog>
    </div>;
  }

  return <div className="mx-auto max-w-[1500px]"><PageHeading eyebrow="Operação visual" title="Quadros" description="Escolha o modo Trello para fluxo visual ou ClickUp para uma lista operacional." actions={<Button onClick={() => setBoardDialog(true)}><Plus className="mr-2 h-4 w-4" />Novo quadro</Button>} /><div className="gd-panel mb-4 flex items-center gap-2 p-3"><Search className="h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar quadro" className="border-0 bg-transparent shadow-none focus-visible:ring-0" /></div>{boardsQuery.isLoading ? <div className="gd-panel grid min-h-64 place-items-center text-sm text-muted-foreground">Carregando quadros…</div> : visibleBoards.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleBoards.map((board) => <button key={board.id} type="button" onClick={() => setSelectedBoardId(board.id)} className="gd-panel group p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/50"><LayoutGrid className="h-6 w-6 text-primary" /><h2 className="mt-4 font-black">{board.name}</h2><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{board.description || "Sem descrição."}</p><span className="mt-5 inline-flex items-center gap-1 text-[10px] font-black text-primary">Abrir quadro <ArrowLeft className="h-3 w-3 rotate-180 transition-transform group-hover:translate-x-1" /></span></button>)}</div> : <div className="gd-panel grid min-h-64 place-items-center p-8 text-center"><div><LayoutGrid className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-3 font-black">Nenhum quadro criado</h2><p className="mt-1 text-sm text-muted-foreground">Crie um quadro para começar a organizar sua operação.</p><Button className="mt-4" onClick={() => setBoardDialog(true)}><Plus className="mr-2 h-4 w-4" />Criar primeiro quadro</Button></div></div>}
    <Dialog open={boardDialog} onOpenChange={setBoardDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Novo quadro</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Nome</Label><Input value={boardForm.name} onChange={(event) => setBoardForm({ ...boardForm, name: event.target.value })} placeholder="Pipeline comercial" /></div><div><Label>Descrição</Label><Textarea value={boardForm.description} onChange={(event) => setBoardForm({ ...boardForm, description: event.target.value })} placeholder="Como este quadro será usado?" /></div></div><DialogFooter><Button variant="outline" onClick={() => setBoardDialog(false)}>Cancelar</Button><Button onClick={() => void createBoard()}>Criar quadro</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function KanbanColumn({ list, cards, onDrop, onAdd, onEdit, onDelete }: { list: KanbanList; cards: KanbanCard[]; onDrop: (cardId: string, targetPosition?: number) => void; onAdd: () => void; onEdit: (listId: string, card: KanbanCard) => void; onDelete: (card: KanbanCard) => void }) {
  return <section className="gd-panel w-[300px] shrink-0 bg-muted/25 p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/kanban-card"); if (id) onDrop(id, cards.length); }}><header className="mb-3 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Columns3 className="h-4 w-4 shrink-0 text-primary" /><h2 className="truncate text-sm font-black">{list.name}</h2><span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">{cards.length}</span></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAdd} aria-label={`Adicionar em ${list.name}`}><Plus className="h-4 w-4" /></Button></header><div className="min-h-24 space-y-2">{cards.map((card, index) => <article key={card.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/kanban-card", card.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const id = event.dataTransfer.getData("text/kanban-card"); if (id) onDrop(id, index); }} className="group cursor-grab rounded-xl border border-border bg-background p-3 shadow-sm active:cursor-grabbing"><div className="flex items-start gap-2"><button type="button" onClick={() => onEdit(list.id, card)} className="min-w-0 grow text-left"><b className="block break-words text-xs">{card.title}</b>{card.description && <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{card.description}</p>}</button><button type="button" onClick={() => onDelete(card)} className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" aria-label="Excluir cartão"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-muted-foreground"><PriorityBadge priority={card.priority} />{card.due_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(new Date(`${card.due_date}T12:00:00`), "dd/MM")}</span>}</div></article>)}{!cards.length && <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border p-4 text-[10px] text-muted-foreground">Arraste cartões para cá</div>}</div><Button variant="ghost" className="mt-2 w-full justify-start text-xs font-bold text-primary" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar cartão</Button></section>;
}

function PriorityBadge({ priority }: { priority: string }) { const item = PRIORITIES.find((option) => option.value === priority); return item?.value === "none" ? null : <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black", item?.value === "urgent" ? "bg-rose-500/15 text-rose-500" : item?.value === "high" ? "bg-amber-500/15 text-amber-500" : item?.value === "medium" ? "bg-blue-500/15 text-blue-500" : "bg-muted text-muted-foreground")}>{item?.label}</span>; }

function CardDialog({ dialog, form, setForm, onClose, onSave }: { dialog: { listId: string; card?: KanbanCard } | null; form: { title: string; description: string; due_date: string; priority: string }; setForm: (form: { title: string; description: string; due_date: string; priority: string }) => void; onClose: () => void; onSave: () => void }) {
  return <Dialog open={!!dialog} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{dialog?.card ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Título</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></div><div><Label>Descrição</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></div><div><Label>Prioridade</Label><Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={onSave}><Check className="mr-2 h-4 w-4" />Salvar cartão</Button></DialogFooter></DialogContent></Dialog>;
}
