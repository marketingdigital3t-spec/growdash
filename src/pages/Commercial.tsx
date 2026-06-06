import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Award, BriefcaseBusiness, Camera, CheckCircle2, Clock3, Crown, Loader2, Medal, Search, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCRMDeals } from "@/hooks/useCRMDeals";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { normalizeSelectedAdAccount, useSelectedAdAccountFilter } from "@/hooks/useSelectedAdAccountFilter";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const fmtMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (value: number) => `${value.toFixed(1)}%`;
const SELLER_AVATARS_KEY = "trackvio:commercial-seller-avatars";

const dealSaleDate = (deal: { closed_at: string | null; stage_updated_at: string | null; lead_created_at: string | null }) =>
  deal.closed_at || deal.stage_updated_at || deal.lead_created_at;

const isDateInRange = (value: string | null | undefined, startDate: Date, endDate: Date) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= startDate.getTime() && time <= endDate.getTime();
};

interface SellerRank {
  owner: string;
  leads: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  revenue: number;
  avgTicket: number;
  conversionRate: number;
  avgDaysToClose: number;
  score: number;
}

export default function Commercial() {
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const selectedAccount = useSelectedAdAccountFilter();
  const activeAccountId = normalizeSelectedAdAccount(selectedAccount);
  const { data: funnels = [] } = useRDFunnels(activeAccountId, { refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const [search, setSearch] = useState("");
  const [funnelId, setFunnelId] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "revenue" | "wonDeals" | "conversionRate">("score");
  const [sellerAvatars, setSellerAvatars] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(SELLER_AVATARS_KEY) || "{}");
    } catch {
      return {};
    }
  });

  const { data: deals = [], isLoading: loadingDeals, isError: dealsError } = useCRMDeals({
    startDate,
    endDate,
    adAccountId: activeAccountId,
    funnelId,
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  useEffect(() => {
    if (funnelId === "all") return;
    if (!funnels.some((funnel) => funnel.id === funnelId)) setFunnelId("all");
  }, [funnels, funnelId]);

  const rows = useMemo(() => {
    const acc = new Map<string, SellerRank & { closeDaysTotal: number; closeDaysCount: number }>();

    const ensure = (owner: string) => {
      if (!acc.has(owner)) {
        acc.set(owner, {
          owner,
          leads: 0,
          openDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          revenue: 0,
          avgTicket: 0,
          conversionRate: 0,
          avgDaysToClose: 0,
          score: 0,
          closeDaysTotal: 0,
          closeDaysCount: 0,
        });
      }
      return acc.get(owner)!;
    };

    for (const deal of deals) {
      const row = ensure(deal.deal_owner_name || "Sem responsável");
      const leadStartedInRange = isDateInRange(deal.lead_created_at, startDate, endDate);
      const saleHappenedInRange = deal.win && isDateInRange(dealSaleDate(deal), startDate, endDate);
      const lostHappenedInRange = !!deal.lost_reason && isDateInRange(deal.stage_updated_at || deal.closed_at, startDate, endDate);

      if (leadStartedInRange) row.leads += 1;
      if (saleHappenedInRange) row.wonDeals += 1;
      else if (lostHappenedInRange) row.lostDeals += 1;
      else if (leadStartedInRange && !deal.win && !deal.lost_reason) row.openDeals += 1;

      if (saleHappenedInRange) {
        row.revenue += Number(deal.amount_total || 0);
        if (deal.lead_created_at && deal.closed_at) {
          const created = new Date(deal.lead_created_at).getTime();
          const closed = new Date(deal.closed_at).getTime();
          if (Number.isFinite(created) && Number.isFinite(closed) && closed >= created) {
            row.closeDaysTotal += (closed - created) / 86_400_000;
            row.closeDaysCount += 1;
          }
        }
      }
    }

    return Array.from(acc.values())
      .map((row) => {
        const conversionRate = row.leads > 0 ? (row.wonDeals / row.leads) * 100 : 0;
        const avgTicket = row.wonDeals > 0 ? row.revenue / row.wonDeals : 0;
        const avgDaysToClose = row.closeDaysCount > 0 ? row.closeDaysTotal / row.closeDaysCount : 0;
        const speedScore = avgDaysToClose > 0 ? Math.max(0, 25 - avgDaysToClose) : 10;
        const score = row.revenue / 1000 + conversionRate * 1.5 + row.wonDeals * 8 + speedScore;
        return { ...row, conversionRate, avgTicket, avgDaysToClose, score };
      })
      .filter((row) => row.owner.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [deals, endDate, search, sortBy, startDate]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          leads: sum.leads + row.leads,
          openDeals: sum.openDeals + row.openDeals,
          wonDeals: sum.wonDeals + row.wonDeals,
          revenue: sum.revenue + row.revenue,
        }),
        { leads: 0, openDeals: 0, wonDeals: 0, revenue: 0 },
      ),
    [rows],
  );

  const isLoading = loadingDeals;
  const isError = dealsError;
  const podium = rows.slice(0, 3);
  const attention = rows.slice(3).filter((row) => row.conversionRate < 20 || row.wonDeals === 0).slice(0, 4);

  const saveSellerAvatar = (owner: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSellerAvatars((current) => {
        const next = { ...current, [owner]: String(reader.result || "") };
        localStorage.setItem(SELLER_AVATARS_KEY, JSON.stringify(next));
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-amber-400/30 bg-amber-400/10 text-amber-200">
              <Award className="mr-1.5 h-3.5 w-3.5" />
              Performance comercial por vendedor
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Ranking do time comercial com vendas concluídas no RD Station e valor pago de cada negociação.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 xl:max-w-5xl xl:items-end">
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
            <Card className="w-full border-primary/20 bg-card/60 p-3 shadow-[0_0_34px_hsl(var(--primary)/0.08)] xl:max-w-5xl">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar vendedor..."
                    className="h-10 border-primary/20 bg-background/60 pl-9"
                  />
                </div>
                <Select value={funnelId} onValueChange={setFunnelId}>
                  <SelectTrigger className="h-10 w-full border-primary/20 bg-background/60 md:w-[260px]">
                    <SelectValue placeholder="Funil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os funis RD</SelectItem>
                    {funnels
                      .filter((funnel) => funnel.rd_funnel_id)
                      .map((funnel) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          {funnel.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                  <SelectTrigger className="h-10 w-full border-primary/20 bg-background/60 md:w-[220px]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Score comercial</SelectItem>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="wonDeals">Vendas</SelectItem>
                    <SelectItem value="conversionRate">Conversão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Users} label="Leads atribuídos" value={totals.leads.toLocaleString("pt-BR")} />
          <MetricCard icon={Clock3} label="Negócios abertos" value={totals.openDeals.toLocaleString("pt-BR")} />
          <MetricCard icon={CheckCircle2} label="Vendas ganhas" value={totals.wonDeals.toLocaleString("pt-BR")} />
          <MetricCard icon={TrendingUp} label="Receita do time" value={fmtMoney(totals.revenue)} />
        </div>
      </MotionItem>

      <MotionItem>
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="relative overflow-hidden border-primary/20 bg-card/70 p-5 shadow-2xl shadow-primary/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.24),transparent_42%)]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Ranking comercial</p>
                  <h2 className="mt-1 text-xl font-semibold">Líderes de vendas</h2>
                </div>
                <Crown className="h-6 w-6 text-primary" />
              </div>
              {rows.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-primary/25 bg-background/35 p-6 text-center text-sm text-muted-foreground">
                  Nenhum dado comercial encontrado para o período selecionado.
                </div>
              ) : (
                <div className="grid items-end gap-3 md:grid-cols-3">
                  {[podium[1], podium[0], podium[2]].filter(Boolean).map((seller, visualIndex) => {
                    const realRank = rows.findIndex((row) => row.owner === seller.owner) + 1;
                    return (
                      <SellerPodiumCard
                        key={seller.owner}
                        seller={seller}
                        rank={realRank}
                        featured={realRank === 1}
                        avatar={sellerAvatars[seller.owner]}
                        onAvatarChange={saveSellerAvatar}
                        className={visualIndex === 1 ? "md:min-h-80" : "md:min-h-64"}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="border-primary/20 bg-card/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Classificação geral</p>
                <Badge variant="outline" className="border-primary/30 text-primary">{rows.length} vendedores</Badge>
              </div>
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/35 p-5 text-sm text-muted-foreground">
                  A classificação será preenchida quando houver negociações do RD Station para este filtro.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {rows.slice(0, 4).map((seller, index) => (
                    <SellerRankingRow
                      key={seller.owner}
                      seller={seller}
                      rank={index + 1}
                      avatar={sellerAvatars[seller.owner]}
                      onAvatarChange={saveSellerAvatar}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card className="border-rose-400/20 bg-rose-400/5 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">Zona de atenção</p>
              {attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum vendedor em zona crítica no período.</p>
              ) : (
                <div className="space-y-3">
                  {attention.map((seller) => (
                    <SellerRankingRow
                      key={seller.owner}
                      seller={seller}
                      rank={rows.findIndex((row) => row.owner === seller.owner) + 1}
                      avatar={sellerAvatars[seller.owner]}
                      onAvatarChange={saveSellerAvatar}
                      danger
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <Card className="overflow-hidden border-border/50 bg-card/60">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Calculando ranking comercial...
            </div>
          ) : isError ? (
            <div className="p-8 text-sm text-red-300">Falha ao carregar dados comerciais.</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Abertos</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">Tempo até venda</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-28 text-center text-sm text-muted-foreground">
                      Nenhum vendedor com negociações reais no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row.owner}>
                      <TableCell>
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold",
                            index === 0
                              ? "border-amber-300/60 bg-amber-300/15 text-amber-200"
                              : "border-border bg-muted/30 text-muted-foreground",
                          )}
                        >
                          {index === 0 ? <Medal className="h-4 w-4" /> : index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SellerAvatar owner={row.owner} src={sellerAvatars[row.owner]} onAvatarChange={saveSellerAvatar} size="sm" />
                          <div>
                            <div className="font-semibold">{row.owner}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.lostDeals} perdidos no período
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.openDeals}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-300">{row.wonDeals}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtMoney(row.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(row.avgTicket)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(row.conversionRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.avgDaysToClose > 0 ? `${row.avgDaysToClose.toFixed(1)} dias` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{row.score.toFixed(0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </MotionItem>

      <MotionItem>
        <Card className="border-border/50 bg-card/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
              <BriefcaseBusiness className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Como o ranking é calculado</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O score combina receita, conversão, quantidade de vendas e velocidade de fechamento. Leads e negociações vêm do RD
                Station; a receita usa o valor pago das negociações ganhas/concluídas no RD.
              </p>
            </div>
          </div>
        </Card>
      </MotionItem>
    </MotionPage>
  );
}

function SellerAvatar({
  owner,
  src,
  onAvatarChange,
  size = "md",
}: {
  owner: string;
  src?: string;
  onAvatarChange: (owner: string, event: ChangeEvent<HTMLInputElement>) => void;
  size?: "sm" | "md" | "lg";
}) {
  const initials = owner
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  const sizeClass = size === "lg" ? "h-28 w-28 text-2xl" : size === "md" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  return (
    <label className={cn("group relative block shrink-0 cursor-pointer rounded-full", sizeClass)} title="Trocar foto do vendedor">
      {src ? (
        <img src={src} alt={owner} className="h-full w-full rounded-full object-cover ring-2 ring-primary/35" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ring-2 ring-primary/25">
          {initials}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <Camera className="h-4 w-4 text-white" />
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={(event) => onAvatarChange(owner, event)} />
    </label>
  );
}

function SellerPodiumCard({
  seller,
  rank,
  featured,
  avatar,
  onAvatarChange,
  className,
}: {
  seller: SellerRank;
  rank: number;
  featured?: boolean;
  avatar?: string;
  onAvatarChange: (owner: string, event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border bg-background/55 p-4 text-center", featured ? "border-primary/70 shadow-[0_0_36px_hsl(var(--primary)/0.22)]" : "border-border", className)}>
      <Badge className={cn("mb-4", featured ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{rank}º lugar</Badge>
      <SellerAvatar owner={seller.owner} src={avatar} onAvatarChange={onAvatarChange} size={featured ? "lg" : "md"} />
      <h3 className="mt-4 font-semibold">{seller.owner}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{seller.wonDeals} vendas • {fmtMoney(seller.revenue)}</p>
      <p className={cn("mt-3 text-3xl font-bold", featured ? "text-primary" : "text-foreground")}>{fmtPct(seller.conversionRate)}</p>
      <div className="mt-3 h-2 w-full rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(seller.conversionRate, 100)}%` }} />
      </div>
    </div>
  );
}

function SellerRankingRow({
  seller,
  rank,
  avatar,
  onAvatarChange,
  danger,
}: {
  seller: SellerRank;
  rank: number;
  avatar?: string;
  onAvatarChange: (owner: string, event: ChangeEvent<HTMLInputElement>) => void;
  danger?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-background/45 p-3", danger ? "border-rose-400/25" : "border-border")}>
      <span className={cn("w-6 text-center text-sm font-bold", rank === 1 ? "text-primary" : "text-muted-foreground")}>{rank}</span>
      <SellerAvatar owner={seller.owner} src={avatar} onAvatarChange={onAvatarChange} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{seller.owner}</p>
        <p className="truncate text-xs text-muted-foreground">Meta comercial • vendido {fmtMoney(seller.revenue)}</p>
        <div className="mt-2 h-1.5 rounded-full bg-muted">
          <div className={cn("h-full rounded-full", danger ? "bg-rose-400" : "bg-primary")} style={{ width: `${Math.min(seller.conversionRate, 100)}%` }} />
        </div>
      </div>
      <span className={cn("text-sm font-bold tabular-nums", danger ? "text-rose-300" : "text-primary")}>{fmtPct(seller.conversionRate)}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card className="border-border/50 bg-card/60 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
