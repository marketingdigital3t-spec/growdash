import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useCreateEventClassParticipant, useDeleteEventClassParticipant, useEventClassParticipants, useUpdateEventClassParticipant, type EventClass, type EventClassParticipant, type MemberType } from "@/hooks/useEventClasses";
import { toast } from "@/hooks/use-toast";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; eventClass: EventClass; memberType: MemberType; }
const empty = { name: "", investment: "0", notes: "" };
function cents(value: string) { const normalized = value.replace(/\./g, "").replace(",", "."); const amount = Number(normalized); return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0; }
function money(value: number) { return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function EventClassMembersDialog({ open, onOpenChange, eventClass, memberType }: Props) {
  const { data: participants = [], isLoading } = useEventClassParticipants(eventClass.id, memberType);
  const create = useCreateEventClassParticipant(); const update = useUpdateEventClassParticipant(); const remove = useDeleteEventClassParticipant();
  const [form, setForm] = useState(empty); const [editing, setEditing] = useState<EventClassParticipant | null>(null);
  const label = memberType === "student" ? "Alunas" : "Pacientes-modelo";
  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Informe o nome.", variant: "destructive" }); return; }
    try { if (editing) await update.mutateAsync({ id: editing.id, event_class_id: eventClass.id, name: form.name, investment_cents: cents(form.investment), notes: form.notes }); else await create.mutateAsync({ event_class_id: eventClass.id, participant_type: memberType, name: form.name, investment_cents: cents(form.investment), notes: form.notes }); setForm(empty); setEditing(null); toast({ title: editing ? "Cadastro atualizado" : "Cadastro adicionado" }); } catch (error: any) { toast({ title: "Não foi possível salvar", description: error?.message?.includes("unique") ? "Esse nome já está cadastrado nesta turma." : error?.message, variant: "destructive" }); }
  };
  const edit = (participant: EventClassParticipant) => { setEditing(participant); setForm({ name: participant.name, investment: (participant.investment_cents / 100).toFixed(2).replace(".", ","), notes: participant.notes || "" }); };
  const del = async (participant: EventClassParticipant) => { if (!confirm(`Remover ${participant.name}?`)) return; try { await remove.mutateAsync({ id: participant.id, eventClassId: eventClass.id }); } catch (error: any) { toast({ title: "Não foi possível remover", description: error?.message, variant: "destructive" }); } };
  const pending = create.isPending || update.isPending;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{label} — {eventClass.title}</DialogTitle><p className="text-sm text-muted-foreground">{participants.length} cadastro(s) manual(is). Nenhum dado é importado do RD ou Meta.</p></DialogHeader>
    <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/[.03] p-3"><div className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4" />{editing ? "Editar cadastro" : `Adicionar ${memberType === "student" ? "aluna" : "paciente-modelo"}`}</div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><Label>Investimento (R$)</Label><Input inputMode="decimal" value={form.investment} onChange={(e) => setForm({ ...form, investment: e.target.value })} placeholder="0,00" /></div><div className="sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div></div><div className="flex gap-2"><Button onClick={() => void save()} disabled={pending}>{pending ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar"}</Button>{editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar edição</Button>}</div></div>
    <div className="max-h-[45vh] space-y-2 overflow-y-auto">{isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>}{!isLoading && participants.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cadastro manual ainda.</p>}{participants.map((participant) => <div key={participant.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"><div><p className="font-medium">{participant.name}</p><p className="text-xs text-muted-foreground">{money(participant.investment_cents)}{participant.notes ? ` · ${participant.notes}` : ""}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => edit(participant)} aria-label="Editar participante"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => void del(participant)} aria-label="Remover participante"><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog>;
}
