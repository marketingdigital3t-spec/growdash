import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Columns3,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useFunnelStages } from "@/hooks/useRDDeals";
import { classifyLead, type RDDealLite, useRDCRMDeals } from "@/hooks/useRDDealsForPeriod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MetricCard, PageHeading } from "./shared";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");
const PAGE_SIZE = 50;
const BOARD_STEP = 50;

type CRMView = "board" | "list";
type StatusFilter = "all" | "open" | "won" | "lost";

type PipelineStage = {
  id: string;
  name: string;
  order: number;
  won: boolean;
  lost: boolean;
};

export default function CrmPage() {
  const queryClient = useQueryClient();
  const { adAccountId } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const { data: funnels = [], isLoading: loadingFunnels } = useRDFunnels(accountFilter);
  const { data: allDeals = [], isLoading: loadingDeals, isFetching } = useRDCRMDeals(accountFilter);
  const [funnelId, setFunnelId] = useState("all");
  const [view, setView] = useState<CRMView>(() => window.localStorage.getItem("growdash:crm-view") === "list" ? "list" : "board");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [owner, setOwner] = useState("all");
  const [selectedDeal, setSelectedDeal] = useState<RDDealLite | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [stageLimits, setStageLimits] = useState<Record<string, number>>({});

  const selectedFunnelId = funnelId === "all" ? undefined : funnelId;
  const { data: storedStages = [] } = useFunnelStages(selectedFunnelId);

  useEffect(() => {
    if (funnelId !== "all" && !funnels.some((funnel) => funnel.id === funnelId)) setFunnelId("all");
  }, [funnels, funnelId]);

  useEffect(() => {
    if (view === "board" && funnelId === "all" && funnels.length) setFunnelId(funnels[0].id);
  }, [funnels, funnelId, view]);

  useEffect(() => {
    window.localStorage.setItem("growdash:crm-view", view);
  }, [view]);

  useEffect(() => {
    setPage(1);
    setStageLimits({});
  }, [funnelId, owner, query, status]);

  const funnelNames = useMemo(() => new Map(funnels.map((funnel) => [funnel.id, funnel.name])), [funnels]);
  const dealsInPipeline = useMemo(
    () => funnelId === "all" ? allDeals : allDeals.filter((deal) => deal.rd_funnel_id === funnelId),
    [allDeals, funnelId],
  );
  const owners = useMemo(
    () => Array.from(new Set(dealsInPipeline.map((deal) => deal.deal_owner_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [dealsInPipeline],
  );
  const normalizedQuery = normalize(query);
  const deals = useMemo(() => dealsInPipeline.filter((deal) => {
    const bucket = classifyLead(deal);
    if (status === "open" && !["open", "qualified"].includes(bucket)) return false;
    if (status === "won" && bucket !== "won") return false;
    if (status === "lost" && !["lost", "disqualified"].includes(bucket)) return false;
    if (owner !== "all" && deal.deal_owner_name !== owner) return false;
    if (!normalizedQuery) return true;
    return normalize([
      deal.contact_name,
      deal.contact_email,
      deal.rd_stage_name,
      deal.deal_owner_name,
      deal.rd_product_name,
      deal.rd_campaign_name,
      deal.utm_source,
      deal.utm_campaign,
      deal.lead_city,
      deal.lead_state,
    ].filter(Boolean).join(" ")).includes(normalizedQuery);
  }), [dealsInPipeline, normalizedQuery, owner, status]);

  const stats = useMemo(() => {
    const won = deals.filter((deal) => deal.win);
    const lost = deals.filter((deal) => classifyLead(deal) === "lost" || classifyLead(deal) === "disqualified");
    const active = deals.filter((deal) => !deal.win && !lost.includes(deal));
    return {
      active: active.length,
      openRevenue: active.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0),
      won: won.length,
      wonRevenue: won.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0),
      lost: lost.length,
      conversion: deals.length ? (won.length / deals.length) * 100 : 0,
    };
  }, [deals]);

  const stages = useMemo<PipelineStage[]>(() => {
    const map = new Map<string, PipelineStage>();
    for (const stage of storedStages) {
      map.set(stage.rd_stage_id, {
        id: stage.rd_stage_id,
        name: stage.name,
        order: stage.order,
        won: stage.is_won,
        lost: stage.is_lost,
      });
    }
    for (const deal of dealsInPipeline) {
      const id = deal.rd_stage_id || "no-stage";
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: deal.rd_stage_name || "Sem etapa",
          order: deal.rd_stage_order ?? 9_999,
          won: deal.win,
          lost: classifyLead(deal) === "lost" || classifyLead(deal) === "disqualified",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
  }, [dealsInPipeline, storedStages]);

  const stageDeals = useMemo(() => {
    const map = new Map<string, RDDealLite[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of deals) {
      const stageId = deal.rd_stage_id || "no-stage";
      const current = map.get(stageId) || [];
      current.push(deal);
      map.set(stageId, current);
    }
    return map;
  }, [deals, stages]);

  const lastUpdatedAt = useMemo(() => {
    const timestamps = allDeals.map((deal) => deal.updated_at || deal.stage_updated_at).filter(Boolean) as string[];
    return timestamps.sort().at(-1) || null;
  }, [allDeals]);

  const pageCount = Math.max(1, Math.ceil(deals.length / PAGE_SIZE));
  const visibleList = deals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeView(next: CRMView) {
    if (next === "board" && funnelId === "all" && funnels.length) setFunnelId(funnels[0].id);
    setView(next);
  }

  async function syncRD() {
    const selected = funnelId === "all"
      ? funnels.filter((funnel) => funnel.is_active)
      : funnels.filter((funnel) => funnel.id === funnelId && funnel.is_active);
    if (!selected.length) {
      toast.error("Nenhum funil RD ativo para sincronizar.");
      return;
    }
    setSyncing(true);
    try {
      for (const funnel of selected) {
        const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
          body: {
            funnel_id: funnel.id,
            realtime: true,
            analytics_mode: true,
            max_pages: 1,
            max_deals: 200,
            trigger_source: "crm_refresh",
          },
        });
        if (error || data?.error || data?.success === false) throw error || new Error(data?.error || "Falha na sincronização.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rd_crm_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] }),
      ]);
      toast.success("Negociações atualizadas com o RD Station.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o RD Station.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      <PageHeading
        eyebrow="RD Station CRM"
        title="Negociações"
        description="Pipeline operacional sincronizado com os leads e negociações reais do RD Station."
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
              <ViewButton active={view === "board"} onClick={() => changeView("board")} icon={<LayoutGrid />} label="Kanban" />
              <ViewButton active={view === "list"} onClick={() => changeView("list")} icon={<List />} label="Lista" />
            </div>
            <button className="gd-button" onClick={() => void syncRD()} disabled={syncing || loadingFunnels}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Sincronizando" : "Atualizar RD"}
            </button>
          </div>
        )}
      />

      <section className="gd-panel mb-4 p-3 sm:p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1.3fr)_minmax(180px,.8fr)_minmax(170px,.7fr)_auto]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-10" placeholder="Buscar contato, e-mail, campanha, produto ou cidade" />
          </label>
          <select value={funnelId} onChange={(event) => setFunnelId(event.target.value)} className="gd-button h-11 min-w-0">
            {view === "list" && <option value="all">Todos os funis conectados</option>}
            {funnels.map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}
          </select>
          <select value={owner} onChange={(event) => setOwner(event.target.value)} className="gd-button h-11 min-w-0">
            <option value="all">Todos os responsáveis</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
            {([ ["all", "Todos"], ["open", "Abertos"], ["won", "Ganhos"], ["lost", "Perdidos"] ] as [StatusFilter, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setStatus(id)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-black transition", status === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground")}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
          <span>{number.format(deals.length)} negociação(ões) encontrada(s)</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {isFetching || syncing ? "Atualizando em segundo plano…" : lastUpdatedAt ? `Atualizado ${formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true, locale: ptBR })}` : "Aguardando primeira sincronização"}</span>
        </div>
      </section>

      <div className="gd-auto-grid gap-3">
        <MetricCard label="Negociações ativas" value={number.format(stats.active)} change="pipeline" emphasis />
        <MetricCard label="Receita em aberto" value={brl.format(stats.openRevenue)} change="potencial" />
        <MetricCard label="Negócios ganhos" value={number.format(stats.won)} change={brl.format(stats.wonRevenue)} />
        <MetricCard label="Conversão do pipeline" value={`${stats.conversion.toFixed(2)}%`} change={`${stats.lost} perdido(s)`} />
      </div>

      {loadingDeals ? <CRMLoading /> : view === "board" ? (
        <KanbanBoard
          stages={stages}
          stageDeals={stageDeals}
          stageLimits={stageLimits}
          onLoadMore={(stageId) => setStageLimits((current) => ({ ...current, [stageId]: (current[stageId] || BOARD_STEP) + BOARD_STEP }))}
          onOpen={setSelectedDeal}
        />
      ) : (
        <DealsList
          deals={visibleList}
          funnels={funnelNames}
          page={page}
          pageCount={pageCount}
          total={deals.length}
          onPage={setPage}
          onOpen={setSelectedDeal}
        />
      )}

      {!loadingDeals && !deals.length && (
        <section className="gd-panel mt-4 grid min-h-64 place-items-center p-6 text-center">
          <div><UsersRound className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-4 font-black">Nenhuma negociação encontrada</h2><p className="mt-2 text-sm text-muted-foreground">Revise os filtros ou sincronize o funil conectado ao RD Station.</p></div>
        </section>
      )}

      <DealDetails deal={selectedDeal} funnelName={selectedDeal?.rd_funnel_id ? funnelNames.get(selectedDeal.rd_funnel_id) : undefined} onClose={() => setSelectedDeal(null)} />
    </div>
  );
}

function KanbanBoard({ stages, stageDeals, stageLimits, onLoadMore, onOpen }: {
  stages: PipelineStage[];
  stageDeals: Map<string, RDDealLite[]>;
  stageLimits: Record<string, number>;
  onLoadMore: (stageId: string) => void;
  onOpen: (deal: RDDealLite) => void;
}) {
  return (
    <section className="gd-panel mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><Columns3 className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-black">Pipeline de negociações</h2><p className="text-[10px] text-muted-foreground">Etapas na mesma ordem configurada no RD Station</p></div></div>
        <span className="hidden text-[10px] text-muted-foreground sm:block">Clique em um cartão para ver todos os dados</span>
      </div>
      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="flex min-h-[520px] min-w-max items-start gap-3">
          {stages.map((stage) => {
            const deals = stageDeals.get(stage.id) || [];
            const total = deals.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0);
            const limit = stageLimits[stage.id] || BOARD_STEP;
            return (
              <div key={stage.id} className="w-[286px] shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/25">
                <div className="sticky top-0 z-10 border-b border-border bg-background/95 p-3 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="flex items-center gap-2"><StageDot won={stage.won} lost={stage.lost} /><h3 className="truncate text-xs font-black" title={stage.name}>{stage.name}</h3></div><p className="mt-1 pl-4 text-[10px] text-muted-foreground">{number.format(deals.length)} negócio(s) · {brl.format(total)}</p></div>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-black">{deals.length}</span>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-390px)] min-h-[440px] space-y-2 overflow-y-auto p-2">
                  {deals.slice(0, limit).map((deal) => <DealCard key={deal.id} deal={deal} onOpen={onOpen} />)}
                  {!deals.length && <div className="m-2 rounded-xl border border-dashed border-border p-6 text-center text-[10px] text-muted-foreground">Nenhuma negociação nesta etapa</div>}
                  {deals.length > limit && <button type="button" className="gd-button w-full justify-center" onClick={() => onLoadMore(stage.id)}>Mostrar mais {Math.min(BOARD_STEP, deals.length - limit)}</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DealCard({ deal, onOpen }: { deal: RDDealLite; onOpen: (deal: RDDealLite) => void }) {
  const name = deal.contact_name || deal.contact_email || "Contato não informado";
  return (
    <button type="button" onClick={() => onOpen(deal)} className="group w-full rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">{initials(name)}</span>
        <div className="min-w-0 grow"><h4 className="truncate text-xs font-black" title={name}>{name}</h4><p className="mt-0.5 truncate text-[9px] text-muted-foreground">{deal.rd_product_name || deal.rd_campaign_name || deal.utm_source || "Sem produto/origem"}</p></div>
        <DealStatus deal={deal} compact />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
        <span className="text-xs font-black text-foreground">{brl.format(Number(deal.amount_total || 0))}</span>
        <span className="max-w-[125px] truncate text-[9px] text-muted-foreground" title={deal.deal_owner_name || "Sem responsável"}>{deal.deal_owner_name || "Sem responsável"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || "Local não informado"}</span>
        <span className="shrink-0">{relativeDate(deal.stage_updated_at || deal.updated_at || deal.lead_created_at)}</span>
      </div>
    </button>
  );
}

function DealsList({ deals, funnels, page, pageCount, total, onPage, onOpen }: {
  deals: RDDealLite[];
  funnels: Map<string, string>;
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
  onOpen: (deal: RDDealLite) => void;
}) {
  return (
    <section className="gd-panel mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2"><List className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-black">Lista de negociações</h2><p className="text-[10px] text-muted-foreground">{number.format(total)} registro(s), 50 por página</p></div></div>
        <Pagination page={page} pageCount={pageCount} onPage={onPage} />
      </div>

      <div className="divide-y divide-border md:hidden">
        {deals.map((deal) => (
          <button key={deal.id} type="button" className="grid w-full gap-2 p-4 text-left" onClick={() => onOpen(deal)}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm">{deal.contact_name || deal.contact_email || "Contato não informado"}</b><span className="text-[10px] text-muted-foreground">{deal.rd_stage_name || "Sem etapa"}</span></div><DealStatus deal={deal} /></div>
            <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-muted-foreground">{deal.deal_owner_name || "Sem responsável"}</span><b>{brl.format(Number(deal.amount_total || 0))}</b></div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="bg-muted/60 text-[10px] font-black uppercase tracking-wide text-muted-foreground"><tr>{["Negociação", "Etapa", "Funil", "Responsável", "Origem/campanha", "Atualização", "Valor", "Status"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {deals.map((deal) => (
              <tr key={deal.id} onClick={() => onOpen(deal)} className="cursor-pointer transition hover:bg-muted/45">
                <td className="max-w-64 px-4 py-3"><b className="block truncate">{deal.contact_name || "Contato não informado"}</b><span className="block truncate text-[10px] text-muted-foreground">{deal.contact_email || deal.rd_deal_id}</span></td>
                <td className="px-4 py-3"><span className="inline-flex max-w-48 truncate rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">{deal.rd_stage_name || "Sem etapa"}</span></td>
                <td className="max-w-48 truncate px-4 py-3" title={deal.rd_funnel_id ? funnels.get(deal.rd_funnel_id) : undefined}>{deal.rd_funnel_id ? funnels.get(deal.rd_funnel_id) || "Funil RD" : "—"}</td>
                <td className="max-w-44 truncate px-4 py-3">{deal.deal_owner_name || "Não informado"}</td>
                <td className="max-w-56 px-4 py-3"><span className="block truncate">{deal.rd_campaign_name || deal.utm_campaign || deal.utm_source || "Não atribuída"}</span><span className="text-[9px] text-muted-foreground">{deal.rd_product_name || "Sem produto"}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeDate(deal.stage_updated_at || deal.updated_at || deal.lead_created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-black">{brl.format(Number(deal.amount_total || 0))}</td>
                <td className="px-4 py-3"><DealStatus deal={deal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end border-t border-border p-4"><Pagination page={page} pageCount={pageCount} onPage={onPage} /></div>
    </section>
  );
}

function DealDetails({ deal, funnelName, onClose }: { deal: RDDealLite | null; funnelName?: string; onClose: () => void }) {
  if (!deal) return null;
  const fields = Object.entries(deal.custom_fields || {}).filter(([, value]) => value != null && String(value).trim());
  return (
    <Sheet open={!!deal} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-7">
          <SheetTitle className="text-xl font-black">{deal.contact_name || deal.contact_email || "Negociação sem contato"}</SheetTitle>
          <SheetDescription>Negociação sincronizada do RD Station CRM</SheetDescription>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <DetailMetric icon={<CircleDollarSign />} label="Valor" value={brl.format(Number(deal.amount_total || 0))} />
          <DetailMetric icon={<Target />} label="Etapa" value={deal.rd_stage_name || "Sem etapa"} />
          <DetailMetric icon={<UserRound />} label="Responsável" value={deal.deal_owner_name || "Não informado"} />
          <DetailMetric icon={deal.win ? <Trophy /> : <XCircle />} label="Situação" value={statusLabel(deal)} />
        </div>
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
          <DetailRow icon={<Columns3 />} label="Funil" value={funnelName || "Funil RD"} />
          <DetailRow icon={<Mail />} label="E-mail" value={deal.contact_email || "Não informado"} />
          <DetailRow icon={<MapPin />} label="Localização" value={[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || "Não informada"} />
          <DetailRow icon={<UsersRound />} label="Produto" value={deal.rd_product_name || "Não informado"} />
          <DetailRow icon={<Target />} label="Origem" value={deal.utm_source || "Não atribuída"} />
          <DetailRow icon={<Target />} label="Campanha" value={deal.rd_campaign_name || deal.utm_campaign || "Não atribuída"} />
          <DetailRow icon={<CalendarClock />} label="Criado em" value={fullDate(deal.lead_created_at)} />
          <DetailRow icon={<Clock3 />} label="Última movimentação" value={fullDate(deal.stage_updated_at || deal.updated_at)} />
          {deal.lost_reason && <DetailRow icon={<XCircle />} label="Motivo da perda" value={deal.lost_reason} danger />}
        </div>
        {!!fields.length && <div className="mt-5"><h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Campos personalizados do RD</h3><div className="mt-2 divide-y divide-border rounded-2xl border border-border">{fields.map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3 px-4 py-3 text-xs"><span className="break-words text-muted-foreground">{key}</span><b className="break-words text-right">{String(value)}</b></div>)}</div></div>}
        <div className="mt-5 rounded-xl border border-dashed border-border p-3 text-[10px] leading-4 text-muted-foreground">ID RD: {deal.rd_deal_id}. A Growdash exibe o histórico armazenado imediatamente e atualiza alterações do RD em segundo plano.</div>
      </SheetContent>
    </Sheet>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{<span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}{label}</button>;
}

function StageDot({ won, lost }: { won: boolean; lost: boolean }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", won ? "bg-emerald-500" : lost ? "bg-rose-500" : "bg-primary")} />;
}

function DealStatus({ deal, compact = false }: { deal: RDDealLite; compact?: boolean }) {
  const kind = classifyLead(deal);
  const label = kind === "won" ? "Ganho" : kind === "lost" || kind === "disqualified" ? "Perdido" : kind === "qualified" ? "Qualificado" : "Aberto";
  return <span className={cn("inline-flex shrink-0 rounded-full font-black", compact ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 text-[9px]", kind === "won" ? "bg-emerald-500/12 text-emerald-500" : kind === "lost" || kind === "disqualified" ? "bg-rose-500/12 text-rose-500" : "bg-amber-500/12 text-amber-500")}>{label}</span>;
}

function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  return <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-16 text-center text-[10px] font-bold">{page} de {pageCount}</span><Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div>;
}

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-border bg-muted/25 p-3"><span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-muted-foreground"><span className="text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{label}</span><b className="mt-2 block truncate text-sm" title={value}>{value}</b></div>;
}

function DetailRow({ icon, label, value, danger = false }: { icon: ReactNode; label: string; value: string; danger?: boolean }) {
  return <div className="grid grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] items-center gap-3 px-4 py-3 text-xs"><span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground"><span className={cn("shrink-0 [&>svg]:h-4 [&>svg]:w-4", danger ? "text-rose-500" : "text-primary")}>{icon}</span>{label}</span><b className={cn("break-words text-right", danger && "text-rose-500")}>{value}</b></div>;
}

function CRMLoading() {
  return <section className="gd-panel mt-4 p-4"><div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map((item) => <div key={item} className="h-[480px] w-[286px] shrink-0 animate-pulse rounded-2xl bg-muted" />)}</div></section>;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function relativeDate(value?: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

function fullDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function statusLabel(deal: RDDealLite) {
  const kind = classifyLead(deal);
  if (kind === "won") return "Ganho";
  if (kind === "lost" || kind === "disqualified") return "Perdido";
  if (kind === "qualified") return "Qualificado";
  return "Em aberto";
}
