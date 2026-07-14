import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, MapPin, Users, Stethoscope, MoreVertical, RefreshCw, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EventClassWithCounts, EventClassStatus } from "@/hooks/useEventClasses";
import { useDeleteEventClass } from "@/hooks/useEventClasses";
import { EventClassMembersDialog } from "./EventClassMembersDialog";
import { EventClassFormDialog } from "./EventClassFormDialog";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_LABELS: Record<EventClassStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberta", variant: "default" },
  sold_out: { label: "Esgotada", variant: "secondary" },
  upcoming: { label: "Em breve", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  finished: { label: "Finalizada", variant: "secondary" },
};

export function EventClassCard({ ec }: { ec: EventClassWithCounts }) {
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [patientsOpen, setPatientsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const remove = useDeleteEventClass();
  const qc = useQueryClient();

  const peopleCap = ec.max_people || ec.max_students || 0;
  const studentPct = peopleCap > 0 ? (ec.studentCount / peopleCap) * 100 : 0;
  const patientPct = ec.max_model_patients > 0 ? (ec.modelPatientCount / ec.max_model_patients) * 100 : 0;
  const status = STATUS_LABELS[ec.status];

  const formatDate = (d: string) => format(parseISO(d), "dd 'de' MMM", { locale: ptBR });
  const dateLabel = ec.date_end ? `${formatDate(ec.date_start)} - ${formatDate(ec.date_end)}` : formatDate(ec.date_start);

  const alerts: string[] = [];
  if (studentPct >= 100) alerts.push("Vagas de pessoas esgotadas");
  else if (studentPct < 30 && ec.status !== "finished" && ec.status !== "cancelled") alerts.push("Baixa ocupação de pessoas");
  if (ec.has_model_patients && patientPct < 50 && ec.max_model_patients > 0) alerts.push("Pacientes-modelo abaixo da capacidade");

  const handleDelete = async () => {
    if (!confirm(`Remover a turma "${ec.title}"?`)) return;
    try {
      await remove.mutateAsync(ec.id);
      toast({ title: "Turma removida" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card className="overflow-hidden hover:border-primary/40 transition-colors">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={status.variant}>{status.label}</Badge>
                {ec.rd_funnel_name && <Badge variant="outline" className="text-xs">{ec.rd_funnel_name}</Badge>}
                {ec.has_model_patients && ec.rd_model_patient_funnel_name && ec.rd_model_patient_funnel_name !== ec.rd_funnel_name && (
                  <Badge variant="outline" className="text-xs">PM: {ec.rd_model_patient_funnel_name}</Badge>
                )}
              </div>
              <h3 className="font-semibold text-base leading-tight">{ec.title}</h3>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {dateLabel}</span>
                {ec.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ec.location}</span>}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => qc.invalidateQueries({ queryKey: ["event_classes"] })}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Sincronizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Pessoas</span>
                <span className="font-medium">{ec.studentCount}/{peopleCap}</span>
              </div>
              <Progress value={Math.min(studentPct, 100)} className="h-1.5" />
            </div>
            {ec.has_model_patients && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Stethoscope className="h-3 w-3" /> Pacientes-modelo</span>
                  <span className="font-medium">{ec.modelPatientCount}/{ec.max_model_patients}</span>
                </div>
                <Progress value={Math.min(patientPct, 100)} className="h-1.5" />
              </div>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="space-y-1">
              {alerts.map((a, i) => (
                <div key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {a}</div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setStudentsOpen(true)}>
              Ver pessoas
            </Button>
            {ec.has_model_patients && (
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setPatientsOpen(true)}>
                Ver pacientes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <EventClassMembersDialog open={studentsOpen} onOpenChange={setStudentsOpen} eventClass={ec} memberType="student" />
      <EventClassMembersDialog open={patientsOpen} onOpenChange={setPatientsOpen} eventClass={ec} memberType="model_patient" />
      <EventClassFormDialog open={editOpen} onOpenChange={setEditOpen} eventClass={ec} />
    </>
  );
}
