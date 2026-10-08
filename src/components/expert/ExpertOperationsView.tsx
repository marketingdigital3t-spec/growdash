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
  RotateCcw,
  Trash2,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useExpertOperations } from "@/hooks/useExpertOperations";
import { useArchiveEventClass, useRestoreEventClass } from "@/hooks/useEventClasses";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EventClassFormDialog } from "@/components/event-classes/EventClassFormDialog";
import { EventClassMembersDialog } from "@/components/event-classes/EventClassMembersDialog";
import { ExpertClassDetailsDialog } from "@/components/expert/ExpertClassDetailsDialog";
import { ExpertSheetLinkDialog } from "@/components/expert/ExpertSheetLinkDialog";
import { buildExpertResultMetrics } from "@/lib/expertResultMetrics";

const brl = (cents: number | null | undefined) =>
  cents == null
    ? "Indisponível"
    : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlAmount = (amount: number | null | undefined) =>
  amount == null
    ? "Indisponível"
    : amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string | null | undefined) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const classBucket = (eventClass: any): "open" | "upcoming" | "past" => {
  if (eventClass.archived_at || eventClass.status === "finished" || String(eventClass.date_end || eventClass.date_start) < todayKey()) return "past";
  if (eventClass.status === "open") return "open";
  return "upcoming";
};

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
  expertId?: string;
  sources: any[];
  onRefresh: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [membersType, setMembersType] = useState<"student" | "model_patient">("student");
  const [membersOpen, setMembersOpen] = useState(false);
  const archive = useArchiveEventClass();
  const restore = useRestoreEventClass();
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
  const archived = Boolean(eventClass.archived_at);
  const classExpertId = eventClass.expert_id || expertId || "";
  const handleArchive = async () => {
    if (!window.confirm(`Arquivar a turma "${eventClass.title}"? Ela ficará em Turmas passadas e os dados financeiros serão preservados.`)) return;
    await archive.mutateAsync({ id: eventClass.id, reason: "Arquivada pela Agenda & Turmas." });
    onRefresh();
  };
  const handleRestore = async () => {
    await restore.mutateAsync({ id: eventClass.id });
    onRefresh();
  };
  return (
    <>
      <Card className="flex h-full w-full flex-col overflow-hidden border-border/80 bg-card/95 shadow-lg">
        <CardHeader className="relative min-h-[148px] space-y-1.5 p-3 pb-2">
          <div className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-2">
            <div className="min-w-0">
              <Badge
                className="text-[10px]"
                variant={
                  archived || eventClass.status === "cancelled"
                    ? "destructive"
                    : eventClass.status === "sold_out"
                      ? "secondary"
                      : "default"
                }
              >
                {archived ? "Arquivada" : statusLabel}
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
                  disabled={!classExpertId}
                  onClick={() => setSheetOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  className="h-7 w-7 shrink-0 rounded-full"
                  size="icon"
                  variant="ghost"
                  aria-label={archived ? "Restaurar turma" : "Arquivar turma"}
                  disabled={archive.isPending || restore.isPending}
                  onClick={() => void (archived ? handleRestore() : handleArchive())}
                >
                  {archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
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
        expertId={classExpertId}
        eventClass={eventClass}
        onSaved={onRefresh}
      />
      <ExpertClassDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        eventClass={eventClass}
        sales={sales}
        sources={sources}
        expertId={classExpertId}
      />
    </>
  );
}

export function ExpertOperationsView() {
  const globalFilters = useGlobalFilters();
  const adAccounts = useAdAccounts();
  const experts = useQuery({
    queryKey: ["expert-operations-experts-by-account"],
    queryFn: async () => {
      const { data: expertRows, error } = await (supabase as any)
        .from("experts")
        .select("id,nome,ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      const { data: sourceRows, error: sourceError } = await (supabase as any)
        .from("expert_operation_sources")
        .select("expert_id,ad_account_id,attribution_window,timezone")
        .not("ad_account_id", "is", null);
      if (sourceError) throw sourceError;
      const { data: classRows, error: classError } = await (supabase as any)
        .from("event_classes")
        .select("expert_id,expert_name,ad_account_id")
        .not("ad_account_id", "is", null);
      if (classError) throw classError;
      const sourcesByExpert = new Map<string, any[]>();
      (sourceRows || []).forEach((source: any) => {
        const key = String(source.expert_id);
        sourcesByExpert.set(key, [...(sourcesByExpert.get(key) || []), source]);
      });
      // During rollout, a class with an explicit ad account is a safe fallback
      // when its operation source row has not been created yet. Legacy classes
      // may carry expert_name instead of expert_id; the account still gates it.
      (classRows || []).forEach((row: any) => {
        const normalizedName = String(row.expert_name || "").trim().toLocaleLowerCase();
        const matchedExpert = row.expert_id
          ? (expertRows || []).find((expert: any) => String(expert.id) === String(row.expert_id))
          : (expertRows || []).find((expert: any) => String(expert.nome || "").trim().toLocaleLowerCase() === normalizedName);
        if (!matchedExpert) return;
        const key = String(matchedExpert.id);
        if (sourcesByExpert.has(key)) return;
        sourcesByExpert.set(key, [{
          expert_id: matchedExpert.id,
          ad_account_id: row.ad_account_id,
          attribution_window: "account_default",
          timezone: "America/Sao_Paulo",
        }]);
      });
      return (expertRows || [])
        .filter((row: any) => sourcesByExpert.has(String(row.id)))
        .map((row: any) => ({ ...row, operationSources: sourcesByExpert.get(String(row.id)) || [] }));
    },
  });
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [classTab, setClassTab] = useState<"all" | "open" | "upcoming" | "past">("all");
  const accountScopeIds = useMemo(
    () => globalFilters.adAccountIds.length
      ? globalFilters.adAccountIds
      : (adAccounts.data || []).map((account) => account.id),
    [adAccounts.data, globalFilters.adAccountIds],
  );
  const expertOptions = useMemo(() => (experts.data || []).filter((expert: any) =>
    !accountScopeIds.length || (expert.operationSources || []).some((source: any) => accountScopeIds.includes(String(source.ad_account_id)))), [accountScopeIds, experts.data]);
  // An account can contain several experts. In that case the account remains
  // the scope and all its classes are shown; an expert is resolved only when
  // the account has one unambiguous operation owner.
  const selectedExpert = globalFilters.adAccountIds.length === 1 && expertOptions.length === 1 ? expertOptions[0] : undefined;
  const selectedExpertId = selectedExpert?.id;
  const selectedExpertName = selectedExpert?.nome || "";
  const operationDates = useMemo(() => ({
    startDate: globalFilters.startDate,
    endDate: globalFilters.endDate,
    selectedAccountIds: accountScopeIds,
  }), [accountScopeIds, globalFilters.endDate, globalFilters.startDate]);
  const operations = useExpertOperations(selectedExpertId, accountScopeIds, operationDates);
  const [slide, setSlide] = useState(0);
  const tabClasses = useMemo(() => classTab === "all" ? operations.classes : operations.classes.filter((eventClass: any) => classBucket(eventClass) === classTab), [classTab, operations.classes]);
  const visibleClasses = useMemo(() => tabClasses.slice(slide, slide + 4), [slide, tabClasses]);
  const gross = operations.sales.reduce((sum, row) => sum + Number(row.gross_amount_cents || 0), 0);
  const cash = operations.sales.reduce((sum, row) => sum + Number(row.cash_received_cents || 0), 0);
  const resultMetrics = buildExpertResultMetrics(
    operations.commercialSales,
    operations.traffic.totalLeads,
    operations.traffic.metricAvailability.leads?.available ?? false,
  );
  const commercialRevenue = operations.commercialSalesAvailable ? resultMetrics.revenue : null;
  const commercialSalesCount = operations.commercialSalesAvailable ? resultMetrics.sales : null;
  const conversion = operations.commercialSalesAvailable ? resultMetrics.conversion : null;
  const accountLabel = operations.accountIds.length
    ? operations.accountIds.map((id) => adAccounts.data?.find((account) => account.id === id)?.name || id).join(", ")
    : "Nenhuma conta Meta vinculada";
  const classDateRangeLabel = accountScopeIds.length
    ? (globalFilters.adAccountIds.length ? `Inventário completo · ${accountLabel}` : "Inventário completo · Todas as contas permitidas")
    : "Inventário completo de turmas";
  const dailyRevenue = useMemo(() => {
    const days = new Map<string, number>();
    operations.commercialSales.forEach((sale) => {
      const day = sale.sale_date || "";
      days.set(day, (days.get(day) || 0) + Number(sale.net_revenue || 0));
    });
    return Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [operations.commercialSales]);
  const maxRevenue = Math.max(...dailyRevenue.map(([, value]) => value), 1);
  useEffect(() => setSlide(0), [classTab, globalFilters.adAccountIds, operations.classes.length]);
  return (
    <div className="expert-operations-view space-y-3">
      <div className="expert-operations-toolbar flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[.04] px-3 py-2 lg:flex-row lg:items-center lg:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] text-primary">
            <Trophy className="h-3 w-3" />
            Operação do Expert
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-lg font-black leading-tight">Turmas, tráfego e comercial</h2>
            <p className="text-[11px] text-muted-foreground">
              {operationDates.startDate.toLocaleDateString("pt-BR")} a {operationDates.endDate.toLocaleDateString("pt-BR")} · resultado: Comercial
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <section className="expert-classes-section space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">
              Turmas em operação
            </p>
            <h3 className="text-base font-black">Turmas em operação</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {classDateRangeLabel} · O calendário abaixo controla apenas Meta Ads e RD Station.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {([['all', 'Todas'], ['open', 'Abertas'], ['upcoming', 'Próximas'], ['past', 'Passadas']] as const).map(([value, label]) => <Button key={value} size="sm" variant={classTab === value ? "default" : "outline"} className="h-7 px-2 text-[10px]" onClick={() => setClassTab(value)}>{label} ({value === "all" ? operations.classes.length : operations.classes.filter((item: any) => classBucket(item) === value).length})</Button>)}
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
              disabled={slide + 4 >= tabClasses.length}
              onClick={() =>
                setSlide((value) => Math.min(Math.max(tabClasses.length - 4, 0), value + 1))
              }
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid items-stretch gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-4">
          {operations.classesLoading && operations.classes.length === 0 ? (
            <Card className="w-full border-dashed sm:col-span-2 lg:col-span-4">
              <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Carregando grade de turmas…
              </CardContent>
            </Card>
          ) : operations.classesError ? (
            <Card className="w-full border-dashed sm:col-span-2 lg:col-span-4">
              <CardContent className="flex items-center gap-3 p-8 text-sm text-destructive">
                <CircleAlert className="h-5 w-5" />
                Não foi possível carregar as turmas. Tente atualizar novamente.
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
                Nenhuma turma encontrada nesta aba.
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
                        title={brlAmount(value)}
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
                Leads Meta no período selecionado · vendas confirmadas do RD Station CRM
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <svg
                  className="h-44 w-full"
                  viewBox="0 0 520 220"
                  role="img"
                  aria-label={`Funil de conversão com ${operations.traffic.totalLeads} leads Meta e ${commercialSalesCount ?? "vendas indisponíveis"} vendas confirmadas`}
                >
                  <defs>
                    <linearGradient id="expert-funnel-leads" x1="0" x2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.55" />
                    </linearGradient>
                    <linearGradient id="expert-funnel-sales" x1="0" x2="1">
                      <stop offset="0%" stopColor="#d8b65c" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#a87920" stopOpacity="0.7" />
                    </linearGradient>
                  </defs>
                  <path d="M36 22 H484 L346 112 H174 Z" fill="url(#expert-funnel-leads)" />
                  <path d="M174 122 H346 L312 198 H208 Z" fill="url(#expert-funnel-sales)" />
                  <text x="260" y="66" textAnchor="middle" fill="white" fontSize="16" fontWeight="800">
                    Leads captados
                  </text>
                  <text x="260" y="91" textAnchor="middle" fill="white" fontSize="24" fontWeight="900">
                    {operations.traffic.metricAvailability.leads?.available ? operations.traffic.totalLeads.toLocaleString("pt-BR") : "Indisponível"}
                  </text>
                  <text x="260" y="153" textAnchor="middle" fill="white" fontSize="15" fontWeight="800">
                    Vendas confirmadas
                  </text>
                  <text x="260" y="179" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">
                    {operations.commercialSalesLoading ? "Carregando" : commercialSalesCount == null ? "Indisponível" : commercialSalesCount.toLocaleString("pt-BR")}
                  </text>
                </svg>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Fontes: leads Meta Ads · vendas RD Station CRM</span>
                  <span className="font-bold text-foreground">
                    Conversão: {conversion == null ? "Indisponível" : `${conversion.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Investimento em tráfego",
              operations.traffic.spend == null
                ? "Indisponível"
                : brl(Math.round(operations.traffic.spend * 100)),
            ],
            [
              "Faturamento",
              operations.commercialSalesLoading
                ? "Carregando"
                : commercialRevenue == null ? "Indisponível" : brlAmount(commercialRevenue),
            ],
            [
              "Leads",
              operations.traffic.metricAvailability.leads?.available
                ? operations.traffic.totalLeads
                : "Indisponível",
            ],
            [
              "Vendas",
              operations.commercialSalesLoading
                ? "Carregando"
                : commercialSalesCount == null ? "Indisponível" : commercialSalesCount,
            ],
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
        defaultAccountId={globalFilters.adAccountIds.length === 1 ? globalFilters.adAccountIds[0] : ""}
      />
    </div>
  );
}
