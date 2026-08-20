import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Loader2, AlertCircle } from "lucide-react";
import {
  useRDDealSearch,
  useAddEventClassMember,
  useEventClassMembers,
  type EventClass,
  type EventClassSource,
  type MemberType,
} from "@/hooks/useEventClasses";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventClass: EventClass;
  memberType: MemberType;
}

export function RDMemberPickerDialog({ open, onOpenChange, eventClass, memberType }: Props) {
  const [query, setQuery] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const isModel = memberType === "model_patient";
  const availableSources = useMemo(() => {
    const saved = ((eventClass as any).sources || []) as EventClassSource[];
    if (saved.length > 0) return saved.filter((source) => source.member_type === memberType);
    const legacy = isModel
      ? eventClass.rd_model_patient_funnel_id && [{ rd_funnel_id: eventClass.rd_model_patient_funnel_id, allowed_stage_ids: eventClass.allowed_model_patient_stage_ids, member_type: "model_patient" as const }]
      : eventClass.rd_funnel_id && [{ rd_funnel_id: eventClass.rd_funnel_id, allowed_stage_ids: eventClass.allowed_student_stage_ids, member_type: "student" as const }];
    return (legacy || []) as EventClassSource[];
  }, [eventClass, isModel, memberType]);
  useEffect(() => { setSourceKey(availableSources[0]?.id || availableSources[0]?.rd_funnel_id || ""); }, [availableSources]);
  const selectedSource = availableSources.find((source) => (source.id || source.rd_funnel_id) === sourceKey) || availableSources[0];
  const allowed = selectedSource?.allowed_stage_ids || [];
  const pickerFunnelId = selectedSource?.rd_funnel_id || null;

  const { data: studentMembers } = useEventClassMembers(eventClass.id, "student");
  const { data: modelMembers } = useEventClassMembers(eventClass.id, "model_patient");
  const existingIds = [
    ...(studentMembers || []).map((m) => m.rd_deal_id),
    ...(modelMembers || []).map((m) => m.rd_deal_id),
  ];

  const { data: results, isLoading } = useRDDealSearch({
    funnelId: pickerFunnelId,
    allowedStageIds: allowed,
    excludeDealIds: existingIds,
    query,
    enabled: open,
  });

  const addMember = useAddEventClassMember();

  const handleAdd = async (deal: any) => {
    try {
      await addMember.mutateAsync({
        eventClassId: eventClass.id,
        rdDealId: deal.rd_deal_id,
        memberType,
        dealName: deal.contact_name || deal.rd_deal_id,
      });
      toast({ title: `${isModel ? "Paciente-modelo" : "Pessoa"} adicionada` });
    } catch (e: any) {
      toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" });
    }
  };

  const title = isModel ? "Adicionar paciente-modelo via RD" : "Adicionar pessoa via RD";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Fonte RD vinculada · {allowed.length} etapa{allowed.length !== 1 ? "s" : ""} permitida{allowed.length !== 1 ? "s" : ""}
          </p>
        </DialogHeader>

        {availableSources.length > 1 && <div>
          <Select value={sourceKey} onValueChange={setSourceKey}>
            <SelectTrigger aria-label="Selecionar fonte RD"><SelectValue placeholder="Selecionar conta e funil" /></SelectTrigger>
            <SelectContent>{availableSources.map((source, index) => <SelectItem key={source.id || `${source.rd_funnel_id}-${index}`} value={source.id || source.rd_funnel_id}>{source.funnel_name || `Funil ${index + 1}`}</SelectItem>)}</SelectContent>
          </Select>
        </div>}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, email, telefone, etapa ou negócio..."
            className="pl-9"
          />
        </div>

        {allowed.length === 0 && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Nenhuma etapa foi configurada como apta. Edite a turma para selecionar etapas do funil.
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!isLoading && results && results.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum registro encontrado no funil vinculado.
            </div>
          )}
          {(results || []).map((r) => (
            <div key={r.rd_deal_id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent/40 transition-colors">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{r.contact_name || `Deal ${r.rd_deal_id.slice(0, 8)}`}</span>
                  {r.rd_stage_name && <Badge variant="secondary" className="text-xs">{r.rd_stage_name}</Badge>}
                  {r.win && <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15">Ganho</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {r.contact_email && <span>{r.contact_email}</span>}
                  {r.contact_phone && <span>{r.contact_phone}</span>}
                  {(r.lead_city || r.lead_state) && <span>{[r.lead_city, r.lead_state].filter(Boolean).join("/")}</span>}
                  {r.amount_total && r.amount_total > 0 && <span>R$ {r.amount_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                  {r.deal_owner_name && <span>Resp: {r.deal_owner_name}</span>}
                  {r.utm_campaign && <span>Camp: {r.utm_campaign}</span>}
                  {r.closed_at && <span>Fech: {format(parseISO(r.closed_at), "dd/MM/yyyy")}</span>}
                </div>
              </div>
              <Button size="sm" onClick={() => handleAdd(r)} disabled={addMember.isPending}>
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
