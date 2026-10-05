import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Edit,
  Link2,
  Plus,
  RefreshCw,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useExpertOperations } from "@/hooks/useExpertOperations";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventClassFormDialog } from "@/components/event-classes/EventClassFormDialog";
import { EventClassMembersDialog } from "@/components/event-classes/EventClassMembersDialog";
import { ExpertClassDetailsDialog } from "@/components/expert/ExpertClassDetailsDialog";
import { ExpertSheetLinkDialog } from "@/components/expert/ExpertSheetLinkDialog";

const brl = (cents: number | null | undefined) =>
  cents == null
    ? "Indisponível"
    : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string | null | undefined) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

function ParticipantRows({
  rows,
  type,
  onSelect,
}: {
  rows: any[];
  type: "student" | "model_patient";
  onSelect: () => void;
}) {
  const scoped = rows.filter((row) => row.participant_type === type).slice(0, 10);
  return (
    <div className="space-y-1">
      {Array.from({ length: 10 }, (_, index) => {
        const row = scoped[index];
        return (
          <button
            type="button"
            key={`${type}-${index}`}
            onClick={onSelect}
            className="grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-1 rounded-md border border-border/60 bg-background/30 px-1.5 py-1.5 text-left text-[11px] transition-colors hover:border-primary/60 hover:bg-primary/[.06]"
          >
            <span className="text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 break-words leading-tight">
              <span className={row ? "font-semibold" : "text-muted-foreground"}>
                {row?.name || "Vaga disponível"}
              </span>
              {row?.seller_name && (
                <span className="ml-1 text-[9px] text-muted-foreground">· {row.seller_name}</span>
              )}
            </span>
            <span
              className={
                row ? "whitespace-nowrap font-semibold text-primary" : "text-muted-foreground"
              }
            >
              {row ? brl(row.cash_received_cents) : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ClassCard({
  eventClass,
  sales,
  expertId,
  sources,
  onRefresh,
}: {
  eventClass: any;
  sales: any[];
  expertId: string;
  sources: any[];
  onRefresh: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [membersType, setMembersType] = useState<"student" | "model_patient">("student");
  const [membersOpen, setMembersOpen] = useState(false);
  const openMembers = (type: "student" | "model_patient") => {
    setMembersType(type);
    setMembersOpen(true);
  };
  const classSales = sales.filter((row) =>
    row.event_class_id
      ? row.event_class_id === eventClass.id
      : row.class_match_status !== "ambiguous" &&
        row.class_name &&
        row.class_name.toLocaleLowerCase() === String(eventClass.title).toLocaleLowerCase(),
  );
  const manualParticipants = Array.isArray(eventClass.participants)
    ? eventClass.participants.map((row: any) => ({
        ...row,
        cash_received_cents: row.investment_cents,
        gross_amount_cents: row.investment_cents,
      }))
    : [];
  const mergeParticipants = (type: "student" | "model_patient") => {
    const imported = classSales.filter((row) => row.participant_type === type);
    const names = new Set(
      imported.map((row) =>
        String(row.name || "")
          .trim()
          .toLocaleLowerCase(),
      ),
    );
    return [
      ...imported,
      ...manualParticipants.filter(
        (row: any) =>
          row.participant_type === type &&
          !names.has(
            String(row.name || "")
              .trim()
              .toLocaleLowerCase(),
          ),
      ),
    ];
  };
  const students = mergeParticipants("student");
  const patients = mergeParticipants("model_patient");
  const capacity = Number(eventClass.max_students || eventClass.max_people || 10);
  const occupancy = capacity ? Math.min((students.length / capacity) * 100, 100) : 0;
  const studentRevenue = students.reduce(
    (sum, row) => sum + Number(row.gross_amount_cents || 0),
    0,
  );
  const patientRevenue = patients.reduce(
    (sum, row) => sum + Number(row.gross_amount_cents || 0),
    0,
  );
  const target = Math.max(10, capacity);
  const occupancyAlert =
    students.length >= target
      ? {
          text: "✓ Turma completa · parabéns!",
          className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
        }
      : students.length >= 8
        ? {
            text: `⚠ ${students.length}/${target} pagas · quase lá`,
            className: "border-amber-500/50 bg-amber-500/10 text-amber-300",
          }
        : {
            text: `⚠ ${students.length}/${target} pagas · preencher turma`,
            className: "border-red-500/50 bg-red-500/10 text-red-300",
          };
  const statusLabel =
    eventClass.status === "sold_out"
      ? "Esgotada"
      : eventClass.status === "finished"
        ? "Finalizada"
        : eventClass.status === "cancelled"
          ? "Cancelada"
          : eventClass.status === "upcoming"
            ? "Em breve"
            : "Aberta";
  return (
    <>
      <Card className="flex h-full w-full flex-col overflow-hidden border-border/80 bg-card/95 shadow-lg">
        <CardHeader className="relative min-h-[148px] space-y-1.5 p-3 pb-2">
          <div className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-2">
            <div className="min-w-0">
              <Badge
                className="text-[10px]"
                variant={
                  eventClass.status === "cancelled"
                    ? "destructive"
                    : eventClass.status === "sold_out"
                      ? "secondary"
                      : "default"
                }
              >
                {statusLabel}
              </Badge>
              <CardTitle className="mt-1.5 whitespace-normal break-words text-sm leading-tight">
                {eventClass.title}
              </CardTitle>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {dateLabel(eventClass.date_start)}
                {eventClass.date_end ? ` – ${dateLabel(eventClass.date_end)}` : ""}
                {eventClass.location ? ` · ${eventClass.location}` : ""}
              </p>
            </div>
            <div className="flex min-w-0 flex-col items-end gap-1">
              <div className="flex items-center gap-0.5">
                <Button
                  className="h-7 w-7 shrink-0 rounded-full"
                  size="icon"
                  variant="ghost"
                  aria-label="Editar turma"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  className="h-7 w-7 shrink-0 rounded-full"
                  size="icon"
                  variant="ghost"
                  aria-label="Vincular planilhas"
                  onClick={() => setSheetOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="w-full text-right text-[10px] leading-none text-muted-foreground">
                <span>{students.length}/{target}</span>
                <Progress value={occupancy} className="ml-auto mt-1 h-1.5 w-16" />
              </div>
            </div>
          </div>
          <div
            className={`rounded-md border px-1.5 py-1 text-center text-[10px] font-black leading-tight ${occupancyAlert.className}`}
          >
            {occupancyAlert.text}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border/60 bg-background/35 p-2">
              <div className="text-[8px] uppercase leading-tight tracking-wider text-muted-foreground">
                Fat. alunas
              </div>
              <div className="mt-0.5 text-xs font-bold text-emerald-400">{brl(studentRevenue)}</div>
            </div>
            <div className="rounded-md border border-border/60 bg-background/35 p-2">
              <div className="text-[8px] uppercase leading-tight tracking-wider text-muted-foreground">
                Fat. pacientes
              </div>
              <div className="mt-0.5 text-xs font-bold text-emerald-400">{brl(patientRevenue)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-2 p-3 pt-1.5">
          <div className="grid grid-cols-2 gap-1 text-[8px] font-black uppercase leading-tight tracking-wider text-muted-foreground">
            <span className="flex items-center justify-between gap-1">
              <span>Alunas</span>
              <b className="shrink-0 text-foreground">{students.length}/{target}</b>
            </span>
            <span className="flex items-center justify-between gap-1">
              <span className="truncate">Paciente-modelo</span>
              <b className="shrink-0 text-foreground">{patients.length}/10</b>
            </span>
          </div>
          <div className="grid flex-1 gap-1.5 lg:grid-cols-2">
            <section>
              <ParticipantRows
                rows={students}
                type="student"
                onSelect={() => openMembers("student")}
              />
            </section>
            <section>
              <ParticipantRows
                rows={patients}
                type="model_patient"
                onSelect={() => openMembers("model_patient")}
              />
            </section>
          </div>
          <div className="mt-auto grid gap-1 pt-2">
            <Button
              className="h-7 w-full text-[11px]"
              size="sm"
              variant="outline"
              onClick={() => openMembers("student")}
            >
              ◉ Aluna ({students.length})
            </Button>
            <Button
              className="h-7 w-full text-[11px]"
              size="sm"
              variant="outline"
              onClick={() => openMembers("model_patient")}
            >
              ◉ Paciente Modelo ({patients.length})
            </Button>
            <Button
              className="h-7 w-full text-[11px]"
              size="sm"
              onClick={() => setDetailsOpen(true)}
            >
              ◉ Ver Detalhes
            </Button>
          </div>
        </CardContent>
      </Card>
      <EventClassFormDialog open={editOpen} onOpenChange={setEditOpen} eventClass={eventClass} />
      <EventClassMembersDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        eventClass={eventClass}
        memberType={membersType}
      />
      <ExpertSheetLinkDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        expertId={expertId}
        eventClass={eventClass}
        onSaved={onRefresh}
      />
      <ExpertClassDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        eventClass={eventClass}
        sales={sales}
        sources={sources}
        expertId={expertId}
      />
    </>
  );
}

export function ExpertOperationsView() {
  const { startDate, endDate } = useGlobalFilters();
  const adAccounts = useAdAccounts();
  const experts = useQuery({
    queryKey: ["expert-operations-experts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("experts")
        .select("id,nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });
  const [expertId, setExpertId] = useState("");
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const selectedExpertId = expertId || experts.data?.[0]?.id;
  const selectedExpertName =
    (experts.data || []).find((expert: any) => expert.id === selectedExpertId)?.nome || "";
  const operations = useExpertOperations(selectedExpertId);
  const expertOptions = useMemo(() => {
    if (experts.data?.length) return experts.data;
    const seen = new Set<string>();
    return operations.classes.reduce((items: Array<{ id: string; nome: string }>, item: any) => {
      const id = String(item.expert_id || "").trim();
      const nome = String(item.expert_name || "").trim();
      if (!id || seen.has(id)) return items;
      seen.add(id);
      items.push({ id, nome: nome || "Expert" });
      return items;
    }, []);
  }, [experts.data, operations.classes]);
  useEffect(() => {
    if (!expertId && expertOptions[0]?.id) setExpertId(expertOptions[0].id);
  }, [expertId, expertOptions]);
  const [slide, setSlide] = useState(0);
  const visibleClasses = useMemo(
    () => operations.classes.slice(slide, slide + 4),
    [operations.classes, slide],
  );
  const gross = operations.sales.reduce((sum, row) => sum + Number(row.gross_amount_cents || 0), 0);
  const cash = operations.sales.reduce((sum, row) => sum + Number(row.cash_received_cents || 0), 0);
  const conversion = operations.traffic.totalLeads
    ? (operations.sales.length / operations.traffic.totalLeads) * 100
    : null;
  const accountLabel = operations.accountIds.length
    ? operations.accountIds.map((id) => adAccounts.data?.find((account) => account.id === id)?.name || id).join(", ")
    : "Nenhuma conta Meta vinculada";
  const periodLabel = `${startDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${endDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  const dailyRevenue = useMemo(() => {
    const days = new Map<string, number>();
    operations.sales.forEach((sale) => {
      const day = sale.sale_date || "";
      days.set(day, (days.get(day) || 0) + Number(sale.gross_amount_cents || 0));
    });
    return Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [operations.sales]);
  const maxRevenue = Math.max(...dailyRevenue.map(([, value]) => value), 1);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[.04] px-3 py-2.5 lg:flex-row lg:items-center lg:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] text-primary">
            <Trophy className="h-3 w-3" />
            Operação do Expert
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-lg font-black leading-tight">Turmas, tráfego e comercial</h2>
            <p className="text-[11px] text-muted-foreground">
              {startDate.toLocaleDateString("pt-BR")} a {endDate.toLocaleDateString("pt-BR")} · vendas: Google Sheets
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedExpertId || ""} onValueChange={setExpertId}>
            <SelectTrigger className="h-9 w-full lg:w-56">
              <SelectValue placeholder="Selecione o expert" />
            </SelectTrigger>
            <SelectContent>
              {expertOptions.map((expert: any) => (
                <SelectItem key={expert.id} value={expert.id}>
                  {expert.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${operations.sync.status === "fresh" ? "bg-emerald-500" : operations.sync.status === "syncing" ? "bg-amber-500" : "bg-red-500"}`}
            />
            {operations.sync.status === "fresh" ? "Atualizado" : operations.sync.status === "syncing" ? "Sincronizando" : "Dados pendentes"}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-9" onClick={() => setCreateClassOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nova turma
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => operations.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">
              Turmas em operação
            </p>
            <h3 className="text-base font-black">Turmas em operação</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Arraste para o lado para ver todas as turmas.
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              className="h-7 w-7"
              size="icon"
              variant="outline"
              aria-label="Turmas anteriores"
              disabled={slide === 0}
              onClick={() => setSlide((value) => Math.max(0, value - 1))}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="h-7 w-7"
              size="icon"
              variant="outline"
              aria-label="Próximas turmas"
              disabled={slide + 4 >= operations.classes.length}
              onClick={() =>
                setSlide((value) => Math.min(Math.max(operations.classes.length - 4, 0), value + 1))
              }
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid items-stretch gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-4">
          {operations.isLoading && operations.classes.length === 0 ? (
            <Card className="w-full border-dashed sm:col-span-2 lg:col-span-4">
              <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Carregando grade de turmas…
              </CardContent>
            </Card>
          ) : visibleClasses.length ? (
            visibleClasses.map((eventClass: any) => (
              <div
                className="min-w-0 h-full"
                key={eventClass.id}
              >
                <ClassCard
                  eventClass={eventClass}
                  sales={operations.sales}
                  expertId={selectedExpertId || ""}
                  sources={operations.sources}
                  onRefresh={() => void operations.refetch()}
                />
              </div>
            ))
          ) : (
            <Card className="w-full border-dashed">
              <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
                <CircleAlert className="h-5 w-5" />
                Nenhuma turma encontrada para este expert.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">
            Resultado da operação
          </p>
          <h3 className="text-lg font-black">Tráfego & resultado</h3>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-[1.1fr_2fr]">
              <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">
                    Investimento em tráfego
                  </p>
                  <Badge variant="secondary">Meta Ads</Badge>
                </div>
                <div className="mt-4 text-3xl font-black">
                  {operations.traffic.spend == null
                    ? "Indisponível"
                    : brl(Math.round(operations.traffic.spend * 100))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {operations.traffic.spend == null
                    ? "Conta Meta não conectada neste ambiente"
                    : "Investimento atribuído pela Meta Ads no período selecionado."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Limite recomendado (10%)
                  </div>
                  <div className="mt-2 font-bold">
                    {operations.traffic.spend == null
                      ? "Indisponível"
                      : brl(Math.round(operations.traffic.spend * 0.1 * 100))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Diferença
                  </div>
                  <div className="mt-2 font-bold">
                    {operations.traffic.spend == null
                      ? "Indisponível"
                      : brl(
                          Math.round(
                            (operations.traffic.spend - operations.traffic.spend * 0.1) * 100,
                          ),
                        )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Período
                  </div>
                  <div className="mt-2 font-bold">{periodLabel}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Conta / atualização
                  </div>
                  <div className="mt-2 font-bold">
                    {accountLabel === "Nenhuma conta Meta vinculada"
                      ? "Indisponível"
                      : accountLabel}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {operations.traffic.syncedAt
                      ? new Date(operations.traffic.syncedAt).toLocaleString("pt-BR")
                      : "Aguardando sincronização"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Investimento x faturamento</CardTitle>
              <p className="text-xs text-muted-foreground">Últimos 14 dias · {accountLabel}</p>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-end gap-1.5 border-b border-border px-1">
                {dailyRevenue.length ? (
                  dailyRevenue.map(([day, value]) => (
                    <div
                      key={day}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    >
                      <div
                        className="w-full rounded-t bg-foreground/80"
                        style={{ height: `${Math.max(8, (value / maxRevenue) * 90)}%` }}
                        title={brl(value)}
                      />
                      <span className="text-[9px] text-muted-foreground">{day.slice(8, 10)}</span>
                    </div>
                  ))
                ) : (
                  <div className="m-auto text-sm text-muted-foreground">
                    Aguardando dados de vendas
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>● Faturamento</span>
                <span className="text-emerald-500">● Investimento Meta</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funil de conversão</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leads qualificados por etapa · RD Station
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ["Leads captados", operations.traffic.totalLeads, "bg-emerald-400"],
                ["Vendas confirmadas", operations.sales.length || null, "bg-foreground"],
              ].map(([label, value, color]) => (
                <div key={String(label)}>
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted-foreground">
                      {value == null ? "Indisponível" : value}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{
                        width:
                          value == null
                            ? "0%"
                            : `${Math.min(100, (Number(value) / Math.max(Number(operations.traffic.totalLeads) || 1, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Investimento em anúncio",
              operations.traffic.spend == null
                ? "Indisponível"
                : brl(Math.round(operations.traffic.spend * 100)),
            ],
            ["Leads Meta", operations.traffic.totalLeads ?? "Indisponível"],
            [
              "CPL",
              operations.traffic.cpl == null
                ? "Indisponível"
                : brl(Math.round(operations.traffic.cpl * 100)),
            ],
            ["Vendas", operations.sales.length],
            ["Conversão", conversion == null ? "Indisponível" : `${conversion.toFixed(1)}%`],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className="mt-2 text-xl font-black">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">
            Performance comercial
          </p>
          <h3 className="text-lg font-black">Ranking de vendedores</h3>
        </div>
        <Card>
          <CardContent className="p-0">
            {operations.sellers.length ? (
              operations.sellers.map((seller, index) => (
                <div
                  key={seller.name}
                  className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[40px_minmax(0,1fr)_120px_120px] md:items-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-black text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-bold">{seller.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Progress value={seller.progress} className="h-1.5 max-w-44" />
                      {seller.goal
                        ? `${seller.progress.toFixed(0)}% da meta`
                        : "Meta não configurada"}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-bold">{brl(seller.grossRevenue)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Bruto
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-bold text-emerald-500">{brl(seller.cashReceived)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Caixa real
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aguardando vendas importadas das planilhas.
              </div>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <CircleDollarSign className="h-4 w-4 text-primary" />
              <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Faturamento bruto
              </div>
              <div className="mt-1 text-lg font-black">{brl(gross)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <WalletCards className="h-4 w-4 text-emerald-500" />
              <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Caixa real
              </div>
              <div className="mt-1 text-lg font-black text-emerald-500">{brl(cash)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Margem disponível
              </div>
              <div className="mt-1 text-lg font-black">Indisponível</div>
            </CardContent>
          </Card>
        </div>
      </section>
      {operations.sync.errors.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          Dados parciais: {operations.sync.errors.join(" · ")}
        </div>
      )}
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
        As contas Meta e planilhas são vinculadas por expert dentro de cada turma. O token Google
        permanece somente no backend.
      </div>
      <EventClassFormDialog
        open={createClassOpen}
        onOpenChange={(open) => {
          setCreateClassOpen(open);
          if (!open) operations.refetch();
        }}
        defaultExpertName={selectedExpertName}
      />
    </div>
  );
}
