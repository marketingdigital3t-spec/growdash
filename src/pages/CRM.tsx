import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { BriefcaseBusiness, CheckCircle2, Clock3, Loader2, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCRMDeals, type CRMDeal, type CRMDealStatus } from "@/hooks/useCRMDeals";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { normalizeSelectedAdAccount, useSelectedAdAccountFilter } from "@/hooks/useSelectedAdAccountFilter";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtMoney = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
};

const statusMeta = (deal: CRMDeal) => {
  if (deal.win) return { label: "Ganho", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  if (deal.lost_reason) return { label: "Perdido", className: "border-red-500/30 bg-red-500/10 text-red-300" };
  return { label: "Aberto", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" };
};

const dealSaleDate = (deal: CRMDeal) => deal.closed_at || deal.stage_updated_at || deal.lead_created_at;

const isDateInRange = (value: string | null | undefined, startDate: Date, endDate: Date) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= startDate.getTime() && time <= endDate.getTime();
};

export default function CRM() {
  const qc = useQueryClient();
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const selectedAccount = useSelectedAdAccountFilter();
  const activeAccountId = normalizeSelectedAdAccount(selectedAccount);
  const { data: funnels = [] } = useRDFunnels(activeAccountId, { refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const [search, setSearch] = useState("");
  const [funnelId, setFunnelId] = useState("all");
  const [owner, setOwner] = useState("all");
  const [stage, setStage] = useState("all");
  const [status, setStatus] = useState<CRMDealStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: deals = [], isLoading, isError, error, refetch } = useCRMDeals({
    startDate,
    endDate,
    adAccountId: activeAccountId,
    search,
    funnelId,
    owner,
    stage,
    status,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  const owners = useMemo(() => Array.from(new Set(deals.map((d) => d.deal_owner_name).filter(Boolean) as string[])).sort(), [deals]);
  const stages = useMemo(() => Array.from(new Set(deals.map((d) => d.rd_stage_name).filter(Boolean) as string[])).sort(), [deals]);

  useEffect(() => {
    if (funnelId === "all") return;
    if (!funnels.some((funnel) => funnel.id === funnelId)) setFunnelId("all");
  }, [funnels, funnelId]);

  const metrics = useMemo(() => {
    const leadDeals = deals.filter((deal) => isDateInRange(deal.lead_created_at, startDate, endDate));
    const won = deals.filter((deal) => deal.win && isDateInRange(dealSaleDate(deal), startDate, endDate));
    const lost = deals.filter((deal) => !!deal.lost_reason && isDateInRange(deal.stage_updated_at || deal.closed_at, startDate, endDate));
    const open = leadDeals.filter((deal) => !deal.win && !deal.lost_reason);
    const revenue = won.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0);
    return {
      total: leadDeals.length,
      open: open.length,
      won: won.length,
      lost: lost.length,
      revenue,
      conversion: leadDeals.length > 0 ? (won.length / leadDeals.length) * 100 : 0,
    };
  }, [deals, endDate, startDate]);

  async function syncRD() {
    try {
      const { data, error: syncError } = funnelId !== "all"
        ? await supabase.functions.invoke("rd-sync-deals", { body: { funnel_id: funnelId } })
        : await supabase.functions.invoke("controlled-realtime-sync", {
            body: {
              adAccountId: activeAccountId,
              includeMeta: false,
              includeBalance: false,
              includeRD: true,
              force: true,
            },
          });
      if (syncError) throw syncError;
      const processed = data?.deals ?? data?.results?.reduce?.((sum: number, item: any) => sum + Number(item?.deals || item?.data?.deals || 0), 0);
      toast.success(`Sincronização RD solicitada${Number.isFinite(processed) ? `: ${processed} negócios processados.` : "."}`);
      await Promise.all([
        refetch(),
        qc.invalidateQueries({ queryKey: ["sales"] }),
        qc.invalidateQueries({ queryKey: ["rd_deals"] }),
        qc.invalidateQueries({ queryKey: ["crm_deals"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível chamar a sincronização do RD.");
    }
  }

  async function requestRDUpdate(deal: CRMDeal, nextStageName: string) {
    setUpdatingId(deal.id);
    try {
      const { error: fnError } = await supabase.functions.invoke("rd-update-deal", {
        body: {
          rd_deal_id: deal.rd_deal_id,
          rd_funnel_id: deal.rd_funnel_id,
          patch: { stage_name: nextStageName },
        },
      });
      if (fnError) throw fnError;
      toast.success("Alteração enviada ao RD Station.");
      await qc.invalidateQueries({ queryKey: ["crm_deals"] });
    } catch (e: any) {
      toast.warning(
        e?.message
          ? `Edição segura ainda depende da Edge Function: ${e.message}`
          : "Edge Function de edição RD ainda não está disponível.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-violet-400/30 bg-violet-400/10 text-violet-200">
              <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" />
              CRM conectado ao RD Station
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Operação de negociações, leads e vendas sincronizadas com o RD Station. Alterações no RD devem passar por Edge Function segura.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center lg:w-auto">
            <MetaDateRangePicker
              preset={preset}
              onPresetChange={setPreset}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              startDate={startDate}
              endDate={endDate}
              autoApplyPresets
              compact
            />
            <Button variant="outline" className="h-10 shrink-0 whitespace-nowrap px-3 text-sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar tela
            </Button>
            <Button className="h-10 shrink-0 whitespace-nowrap px-4 text-sm" onClick={syncRD}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Sincronizar RD
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Users} label="Negociações iniciadas" value={metrics.total.toLocaleString("pt-BR")} />
          <MetricCard icon={Clock3} label="Em aberto" value={metrics.open.toLocaleString("pt-BR")} />
          <MetricCard icon={CheckCircle2} label="Vendas ganhas" value={metrics.won.toLocaleString("pt-BR")} />
          <MetricCard icon={BriefcaseBusiness} label="Receita RD" value={fmtMoney(metrics.revenue)} />
          <MetricCard icon={SlidersHorizontal} label="Conversão" value={`${metrics.conversion.toFixed(1)}%`} />
        </div>
      </MotionItem>

      <MotionItem>
        <Card className="border-border/50 bg-card/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, email, vendedor, etapa, campanha..."
                className="pl-9"
              />
            </div>
            <FilterSelect value={funnelId} onChange={setFunnelId} label="Funil">
              <SelectItem value="all">Todos os funis</SelectItem>
              {funnels
                .filter((funnel) => funnel.rd_funnel_id)
                .map((funnel) => (
                  <SelectItem key={funnel.id} value={funnel.id}>
                    {funnel.name}
                  </SelectItem>
                ))}
            </FilterSelect>
            <FilterSelect value={owner} onChange={setOwner} label="Vendedor">
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {owners.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </FilterSelect>
            <FilterSelect value={stage} onChange={setStage} label="Etapa">
              <SelectItem value="all">Todas as etapas</SelectItem>
              {stages.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </FilterSelect>
            <FilterSelect value={status} onChange={(value) => setStatus(value as CRMDealStatus)} label="Status">
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="won">Ganhos</SelectItem>
              <SelectItem value="lost">Perdidos</SelectItem>
            </FilterSelect>
          </div>
        </Card>
      </MotionItem>

      <MotionItem>
        <Card className="overflow-hidden border-border/50 bg-card/60">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Carregando CRM...
            </div>
          ) : isError ? (
            <div className="p-8 text-sm text-red-300">
              Falha ao carregar CRM: {(error as Error)?.message || "erro desconhecido"}
            </div>
          ) : deals.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma negociação encontrada para os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => {
                  const meta = statusMeta(deal);
                  return (
                    <TableRow key={deal.id}>
                      <TableCell>
                        <div className="font-medium">{deal.contact_name || "Lead sem nome"}</div>
                        <div className="text-xs text-muted-foreground">RD {deal.rd_deal_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate text-sm">{deal.contact_email || "Email pendente"}</div>
                        <div className="text-xs text-muted-foreground">Telefone no RD/venda vinculada</div>
                      </TableCell>
                      <TableCell>{[deal.lead_city, deal.lead_state].filter(Boolean).join(" / ") || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={deal.rd_stage_name || "__empty"}
                          disabled={updatingId === deal.id || stages.length === 0}
                          onValueChange={(value) => requestRDUpdate(deal, value)}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {deal.rd_stage_name && <SelectItem value={deal.rd_stage_name}>{deal.rd_stage_name}</SelectItem>}
                            {!deal.rd_stage_name && <SelectItem value="__empty" disabled>Sem etapa</SelectItem>}
                            {stages
                              .filter((name) => name !== deal.rd_stage_name)
                              .map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{deal.deal_owner_name || "Sem responsável"}</TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate">{deal.utm_source || "Não informado"}</div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground">{deal.utm_campaign || "Sem campanha"}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(deal.amount_total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("whitespace-nowrap", meta.className)}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(deal.stage_updated_at || deal.updated_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </MotionItem>
    </MotionPage>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card className="border-border/50 bg-card/60 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-400/10 text-violet-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[190px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
