import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import {
  useEventClassMembers,
  useRemoveEventClassMember,
  type EventClass,
  type MemberType,
} from "@/hooks/useEventClasses";
import { RDMemberPickerDialog } from "./RDMemberPickerDialog";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventClass: EventClass;
  memberType: MemberType;
}

export function EventClassMembersDialog({ open, onOpenChange, eventClass, memberType }: Props) {
  const { data: members, isLoading } = useEventClassMembers(eventClass.id, memberType);
  const remove = useRemoveEventClassMember();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const max = memberType === "student" ? (eventClass.max_people || eventClass.max_students) : eventClass.max_model_patients;
  const label = memberType === "student" ? "Pessoas" : "Pacientes-modelo";
  const count = members?.length ?? 0;

  const handleRemove = async (id: string) => {
    if (!confirm("Remover este vínculo? O registro no RD não será afetado.")) return;
    try {
      await remove.mutateAsync({ id, eventClassId: eventClass.id, memberType });
      toast({ title: "Vínculo removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{label} — {eventClass.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{count}/{max} vagas preenchidas</p>
          </DialogHeader>

          <div className="flex gap-2">
            <Button onClick={() => setPickerOpen(true)} className="flex-1 sm:flex-none">
              <UserPlus className="h-4 w-4 mr-2" /> Adicionar via RD
            </Button>
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["event_class_members", eventClass.id, memberType] })}>
              <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading && <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>}
            {!isLoading && count === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum{memberType === "student" ? "a pessoa" : " paciente-modelo"} vinculad{memberType === "student" ? "a" : "o"} ainda.
              </div>
            )}
            {(members || []).map((m: any) => {
              const d = m.deal || {};
              const s = m.sale || {};
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.contact_name || `Deal ${m.rd_deal_id.slice(0, 8)}`}</span>
                      {d.rd_stage_name && <Badge variant="secondary" className="text-xs">{d.rd_stage_name}</Badge>}
                      {d.win && <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15">Ganho</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      {s.contact_email && <span>{s.contact_email}</span>}
                      {s.contact_phone && <span>{s.contact_phone}</span>}
                      {(d.lead_city || d.lead_state) && <span>{[d.lead_city, d.lead_state].filter(Boolean).join("/")}</span>}
                      {d.amount_total > 0 && <span>R$ {Number(d.amount_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                      {d.deal_owner_name && <span>Resp: {d.deal_owner_name}</span>}
                      {d.utm_campaign && <span>Camp: {d.utm_campaign}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" asChild title="Ver no RD">
                      <a href={`https://crm.rdstation.com/deals/${m.rd_deal_id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleRemove(m.id)} title="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <RDMemberPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        eventClass={eventClass}
        memberType={memberType}
      />
    </>
  );
}
