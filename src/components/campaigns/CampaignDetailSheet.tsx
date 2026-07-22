import { useMemo, useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Lightbulb, History, Target, Pencil, PauseCircle, PlayCircle, Layers3, Minus, Maximize2, Minimize2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCampaignTarget, useSetCampaignTarget, useCampaignChanges } from "@/hooks/useCampaignTargets";
import { useCampaignBreakdowns, type BreakdownSegment } from "@/hooks/useCampaignBreakdowns";
import { useCampaignActionTotals } from "@/hooks/useCampaignActionTotals";
import { useCustomMetrics, friendlyActionLabel, computeCustomMetric } from "@/hooks/useCustomMetrics";
// (lead-action overrides moved to Settings → Métricas personalizadas)
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Adset {
  id: string;
  name: string;
  ads?: Ad[];
}
interface Ad {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  insights?: Array<{
    spend: number; leads: number; clicks: number; impressions: number;
    ctr: number; cpl: number; frequency: number; date: string;
  }>;
}
interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  spend: number; leads: number; clicks: number; impressions: number;
  salesCount: number; revenue: number; profit: number; roi: number;
  cpa: number; cpl: number; ctr: number;
  adsets?: Adset[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: CampaignDetail | null;
  onEdit?: (campaign: CampaignDetail) => void;
  onViewAds?: (campaign: CampaignDetail) => void;
}

function fmt(n: number, prefix = "") {
  return `${prefix}${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtInt(n: number) {
  return (n || 0).toLocaleString("pt-BR");
}

type Insight = { spend: number; leads: number; clicks: number; impressions: number; ctr: number; cpl: number; frequency: number; date: string };

function aggregate(insights: Insight[]) {
  let spend = 0, leads = 0, clicks = 0, impressions = 0, freqSum = 0, freqCount = 0;
  for (const i of insights) {
    spend += i.spend ?? 0;
    leads += i.leads ?? 0;
    clicks += i.clicks ?? 0;
    impressions += i.impressions ?? 0;
    if (i.frequency) { freqSum += i.frequency; freqCount += 1; }
  }
  const cpl = leads > 0 ? spend / leads : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const conv = clicks > 0 ? (leads / clicks) * 100 : 0;
  const freq = freqCount > 0 ? freqSum / freqCount : 0;
  return { spend, leads, clicks, impressions, cpl, ctr, conv, freq };
}

export function CampaignDetailSheet({ open, onOpenChange, campaign, onEdit, onViewAds }: Props) {
  const { toast } = useToast();
  const { data: targetData } = useCampaignTarget(campaign?.id);
  const setTarget = useSetCampaignTarget();
  const { data: changes = [] } = useCampaignChanges(campaign?.id);
  const { data: breakdowns } = useCampaignBreakdowns(campaign?.id);
  const { data: actionTotals = [] } = useCampaignActionTotals(campaign?.id);
  const { data: customMetrics = [] } = useCustomMetrics();
  const [targetInput, setTargetInput] = useState("");
  const [panelSize, setPanelSize] = useState<"compact" | "normal" | "maximized">("normal");

  useEffect(() => {
    setTargetInput(targetData?.target_cpl != null ? String(targetData.target_cpl) : "");
  }, [targetData?.target_cpl, campaign?.id]);

  useEffect(() => {
    if (open) setPanelSize("normal");
  }, [open, campaign?.id]);

  const allInsights: Insight[] = useMemo(() => {
    if (!campaign) return [];
    return (campaign.adsets || []).flatMap(s => (s.ads || []).flatMap(a => a.insights || []));
  }, [campaign]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; leads: number; cpl: number }>();
    for (const i of allInsights) {
      const ex = map.get(i.date) || { date: i.date, spend: 0, leads: 0, cpl: 0 };
      ex.spend += i.spend ?? 0;
      ex.leads += i.leads ?? 0;
      map.set(i.date, ex);
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, cpl: d.leads > 0 ? d.spend / d.leads : 0 }));
  }, [allInsights]);

  const insights = useMemo(() => {
    if (!campaign || dailyData.length === 0) return [];
    const out: { type: "good" | "bad" | "warn"; text: string }[] = [];

    // Best/worst day
    const withLeads = dailyData.filter(d => d.leads > 0);
    if (withLeads.length > 0) {
      const best = withLeads.reduce((a, b) => (b.leads > a.leads ? b : a));
      const worst = withLeads.reduce((a, b) => (b.cpl > a.cpl ? b : a));
      out.push({ type: "good", text: `Melhor dia: ${format(parseISO(best.date), "dd/MM")} com ${best.leads} leads (CPL ${fmt(best.cpl, "R$ ")})` });
      if (worst.date !== best.date) {
        out.push({ type: "bad", text: `Pior dia: ${format(parseISO(worst.date), "dd/MM")} — CPL ${fmt(worst.cpl, "R$ ")} com apenas ${worst.leads} leads` });
      }
    }

    // CPL trend last 7 days vs previous 7
    if (dailyData.length >= 4) {
      const recent = dailyData.slice(-7);
      const prev = dailyData.slice(-14, -7);
      const r = aggregate(recent as any);
      const p = aggregate(prev as any);
      if (p.cpl > 0 && r.cpl > 0) {
        const variation = ((r.cpl - p.cpl) / p.cpl) * 100;
        if (Math.abs(variation) >= 5) {
          out.push({
            type: variation < 0 ? "good" : "bad",
            text: `CPL ${variation < 0 ? "caiu" : "subiu"} ${Math.abs(variation).toFixed(1)}% nos últimos 7 dias`,
          });
        } else {
          out.push({ type: "warn", text: `CPL estável (variação ${variation.toFixed(1)}%) nos últimos 7 dias` });
        }
      }
    }

    // Volatility
    if (withLeads.length >= 3) {
      const cpls = withLeads.map(d => d.cpl);
      const avg = cpls.reduce((a, b) => a + b, 0) / cpls.length;
      const max = Math.max(...cpls);
      const min = Math.min(...cpls);
      if (avg > 0 && (max - min) / avg > 0.6) {
        out.push({ type: "warn", text: `CPL oscilando bastante (variação > 60% entre dias)` });
      }
    }

    // Saturation
    const agg = aggregate(allInsights);
    if (agg.freq > 3) {
      out.push({ type: "bad", text: `Frequência alta (${agg.freq.toFixed(2)}) — possível saturação do público` });
    }
    if (agg.conv > 10) {
      out.push({ type: "good", text: `Conversão clique→lead acima da média (${agg.conv.toFixed(1)}%)` });
    } else if (agg.conv > 0 && agg.conv < 3) {
      out.push({ type: "bad", text: `Conversão clique→lead baixa (${agg.conv.toFixed(1)}%) — revisar landing/oferta` });
    }

    return out;
  }, [campaign, dailyData, allInsights]);

  // Tree diagnosis: rank adsets and ads by CPL
  const tree = useMemo(() => {
    if (!campaign) return [];
    const rows = (campaign.adsets || []).map(adset => {
      const adsetInsights = (adset.ads || []).flatMap(a => a.insights || []);
      const a = aggregate(adsetInsights as any);
      const ads = (adset.ads || []).map(ad => {
        const adAgg = aggregate((ad.insights || []) as any);
        return { ...ad, ...adAgg };
      }).sort((x, y) => (y.spend - x.spend));
      return { id: adset.id, name: adset.name, ...a, ads };
    });
    // sort: ones with leads first by lowest CPL, then by highest spend
    return rows.sort((x, y) => {
      if (x.leads === 0 && y.leads === 0) return y.spend - x.spend;
      if (x.leads === 0) return 1;
      if (y.leads === 0) return -1;
      return x.cpl - y.cpl;
    });
  }, [campaign]);

  const worstAdset = tree.length > 1 ? tree[tree.length - 1] : null;
  const bestAdset = tree.length > 0 ? tree[0] : null;

  if (!campaign) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn(
        "w-full overflow-y-auto transition-[max-width,width] duration-200",
        panelSize === "compact" ? "sm:max-w-[360px]" : panelSize === "maximized" ? "sm:max-w-[calc(100vw-5rem)]" : "sm:max-w-2xl",
      )}>
        <SheetHeader className="pr-24">
          <SheetTitle className="truncate text-xl" title={campaign.name}>{campaign.name}</SheetTitle>
          <SheetDescription>Análise de desempenho da campanha</SheetDescription>
        </SheetHeader>

        <div className="absolute right-10 top-3 flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelSize("compact")} title="Minimizar painel"><Minus className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelSize(panelSize === "maximized" ? "normal" : "maximized")} title={panelSize === "maximized" ? "Restaurar painel" : "Maximizar painel"}>{panelSize === "maximized" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>

        {panelSize === "compact" ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            Painel minimizado. Use o botão de maximizar para reabrir toda a análise.
          </div>
        ) : <>

        <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <Button variant="outline" size="sm" onClick={() => onEdit?.(campaign)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
          <Button variant="outline" size="sm" onClick={() => onEdit?.(campaign)}>{campaign.status === "ACTIVE" ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}{campaign.status === "ACTIVE" ? "Pausar" : "Ativar"}</Button>
          <Button variant="outline" size="sm" onClick={() => onViewAds?.(campaign)}><Layers3 className="mr-2 h-4 w-4" />Ver anúncios</Button>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "Gastos", value: fmt(campaign.spend, "R$ ") },
            { label: "Leads", value: fmtInt(campaign.leads) },
            { label: "CPL", value: fmt(campaign.cpl, "R$ ") },
            { label: "CTR", value: `${campaign.ctr.toFixed(2)}%` },
            { label: "Vendas", value: fmtInt(campaign.salesCount) },
            { label: "Lucro", value: fmt(campaign.profit, "R$ ") },
          ].map(k => (
            <div key={k.label} className="rounded-lg border bg-card p-2">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{k.label}</p>
              <p className="text-sm font-semibold tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Daily mini chart */}
        {dailyData.length > 1 && (
          <Card className="mt-4">
            <CardContent className="p-3">
              <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Evolução diária — CPL e Leads</p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => format(parseISO(v), "dd/MM")} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} width={45} tickFormatter={(v) => `R$${Number(v).toFixed(0)}`} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      labelFormatter={(v) => format(parseISO(String(v)), "dd/MM/yyyy")}
                      formatter={(value: any, name: string) => {
                        if (name === "CPL") return [`R$ ${Number(value).toFixed(2)}`, "CPL"];
                        if (name === "Leads") return [Math.round(Number(value)), "Leads"];
                        return [value, name];
                      }}
                    />
                    <Line yAxisId="l" type="monotone" dataKey="cpl" stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={false} name="CPL" />
                    <Line yAxisId="r" type="monotone" dataKey="leads" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} name="Leads" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insights / alerts */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Insights automáticos
          </p>
          {insights.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados suficientes para gerar insights.</p>
          ) : insights.map((it, i) => (
            <div
              key={i}
              className={`rounded-md border p-2.5 text-sm flex items-start gap-2 ${
                it.type === "good" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" :
                it.type === "bad" ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400" :
                "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
              }`}
            >
              {it.type === "good" ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> :
               it.type === "bad" ? <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0" /> :
               <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              <span>{it.text}</span>
            </div>
          ))}
        </div>

        {/* Diagnostic tree */}
        {tree.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Diagnóstico — Conjuntos & Anúncios</p>
            {worstAdset && bestAdset && worstAdset.id !== bestAdset.id && worstAdset.cpl > bestAdset.cpl * 1.5 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                Conjunto <strong>{worstAdset.name}</strong> está puxando o desempenho para baixo (CPL {fmt(worstAdset.cpl, "R$ ")} vs melhor {fmt(bestAdset.cpl, "R$ ")}).
              </div>
            )}
            <div className="space-y-2">
              {tree.map((adset) => {
                const isWorst = worstAdset?.id === adset.id && tree.length > 1;
                const isBest = bestAdset?.id === adset.id && tree.length > 1;
                return (
                  <div key={adset.id} className={`rounded-lg border ${isWorst ? "border-red-500/40 bg-red-500/5" : isBest ? "border-emerald-500/40 bg-emerald-500/5" : "bg-card"}`}>
                    <div className="flex items-center justify-between p-3 border-b">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{adset.name}</span>
                        {isBest && <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-[10px]">Melhor</Badge>}
                        {isWorst && <Badge variant="outline" className="border-red-500/30 text-red-600 text-[10px]">Pior</Badge>}
                      </div>
                      <div className="flex gap-3 text-xs tabular-nums flex-shrink-0">
                        <span>CPL <strong>{fmt(adset.cpl, "R$ ")}</strong></span>
                        <span>Leads <strong>{fmtInt(adset.leads)}</strong></span>
                        <span className="hidden sm:inline">Gasto <strong>{fmt(adset.spend, "R$ ")}</strong></span>
                      </div>
                    </div>
                    {adset.ads.length > 0 && (
                      <div className="divide-y">
                        {adset.ads.map((ad) => {
                          const saturated = ad.freq > 3 && ad.ctr < 1;
                          return (
                            <div key={ad.id} className="flex items-center gap-3 px-3 py-2">
                              {ad.thumbnail_url ? (
                                <img src={ad.thumbnail_url} alt="" className="h-9 w-9 rounded object-cover border flex-shrink-0" loading="lazy" />
                              ) : (
                                <div className="h-9 w-9 rounded bg-muted border flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">
                                  {ad.name}
                                  {saturated && <span className="ml-1 text-red-500" title="Possível saturação">🚨</span>}
                                </p>
                                <p className="text-[10px] text-muted-foreground tabular-nums">
                                  CPL {fmt(ad.cpl, "R$ ")} · CTR {ad.ctr.toFixed(2)}% · Freq {ad.freq.toFixed(2)} · {fmtInt(ad.leads)} leads
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Métricas personalizadas + eventos brutos detectados */}
        <CustomMetricsBlock
          campaignId={campaign?.id || null}
          totals={{
            spend: campaign?.spend || 0,
            impressions: campaign?.impressions || 0,
            clicks: campaign?.clicks || 0,
            actions: Object.fromEntries(actionTotals.map((a) => [a.action_type, a.total])),
          }}
          metrics={customMetrics}
          actionTotals={actionTotals}
        />

        {/* Breakdowns: idade, gênero, plataforma, posicionamento */}
        <BreakdownsSection breakdowns={breakdowns} />

        {/* Target CPL editor */}
        <div className="mt-5 rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> CPL alvo desta campanha
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Ex: 30.00"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                const v = targetInput.trim() === "" ? null : parseFloat(targetInput);
                setTarget.mutate(
                  { campaignId: campaign.id, targetCpl: v },
                  { onSuccess: () => toast({ title: "CPL alvo salvo" }) }
                );
              }}
              disabled={setTarget.isPending}
            >Salvar</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Os alertas críticos passam a usar este CPL como referência. Deixe vazio para usar o CPL alvo da BM.
          </p>
        </div>

        {/* Change history (auto from Meta Ads) */}
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico de alterações
            <span className="ml-1 text-[10px] font-normal normal-case text-muted-foreground">(sincronizado automaticamente do Meta Ads)</span>
          </p>

          {changes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-1">Nenhuma alteração detectada ainda. As mudanças feitas no Meta Ads (status, orçamento, criativo) aparecerão aqui após o próximo sync.</p>
          ) : (
            <div className="space-y-2">
              {changes.map((ch: any) => {
                // Compute KPI delta: 7 days before vs 7 days after
                const changedTs = new Date(ch.changed_at).getTime();
                const before: Insight[] = [];
                const after: Insight[] = [];
                for (const i of allInsights) {
                  const t = parseISO(i.date).getTime();
                  const diff = (t - changedTs) / 86400000;
                  if (diff < 0 && diff >= -7) before.push(i);
                  else if (diff >= 0 && diff <= 7) after.push(i);
                }
                const ag = (xs: Insight[]) => {
                  const s = xs.reduce((a, b) => a + (b.spend ?? 0), 0);
                  const l = xs.reduce((a, b) => a + (b.leads ?? 0), 0);
                  return { spend: s, leads: l, cpl: l > 0 ? s / l : 0 };
                };
                const b = ag(before), a = ag(after);
                const delta = (x: number, y: number) => (x === 0 ? null : ((y - x) / x) * 100);
                const cplDelta = delta(b.cpl, a.cpl);
                const leadsDelta = delta(b.leads, a.leads);

                return (
                  <div key={ch.id} className="rounded-md border bg-card p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Badge variant="outline" className="text-[10px] capitalize">{ch.entity_type || "campaign"}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{ch.change_type}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {format(parseISO(ch.changed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    {ch.field && (
                      <p className="text-xs"><strong>{ch.field}:</strong> <span className="text-muted-foreground">{ch.old_value ?? "—"}</span> → <span className="font-medium">{ch.new_value ?? "—"}</span></p>
                    )}
                    {ch.note && <p className="text-xs">{ch.note}</p>}
                    {(before.length > 0 || after.length > 0) && (
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="rounded bg-muted/40 p-1.5">
                          <p className="text-muted-foreground">CPL antes/depois</p>
                          <p className="tabular-nums">R$ {b.cpl.toFixed(2)} → R$ {a.cpl.toFixed(2)}
                            {cplDelta != null && (
                              <span className={`ml-1 ${cplDelta < 0 ? "text-emerald-600" : "text-red-600"}`}>
                                ({cplDelta > 0 ? "+" : ""}{cplDelta.toFixed(0)}%)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="rounded bg-muted/40 p-1.5">
                          <p className="text-muted-foreground">Leads</p>
                          <p className="tabular-nums">{b.leads} → {a.leads}
                            {leadsDelta != null && (
                              <span className={`ml-1 ${leadsDelta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                ({leadsDelta > 0 ? "+" : ""}{leadsDelta.toFixed(0)}%)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="rounded bg-muted/40 p-1.5">
                          <p className="text-muted-foreground">Gasto</p>
                          <p className="tabular-nums">R$ {b.spend.toFixed(0)} → R$ {a.spend.toFixed(0)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Breakdowns ----------

const GENDER_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Feminino",
  unknown: "Desconhecido",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  threads: "Threads",
};

const POSITION_LABELS: Record<string, string> = {
  feed: "Feed",
  story: "Stories",
  reels: "Reels",
  instream_video: "Vídeo in-stream",
  right_hand_column: "Coluna direita",
  marketplace: "Marketplace",
  search: "Busca",
  facebook_reels: "Reels (FB)",
  instagram_reels: "Reels (IG)",
  instagram_stories: "Stories (IG)",
  facebook_stories: "Stories (FB)",
  explore: "Explorar",
  explore_home: "Explorar (home)",
  biz_disco_feed: "Feed Descoberta",
};

function labelFor(type: "age" | "gender" | "publisher_platform" | "platform_position", key: string) {
  if (type === "gender") return GENDER_LABELS[key.toLowerCase()] || key;
  if (type === "publisher_platform") return PLATFORM_LABELS[key.toLowerCase()] || key;
  if (type === "platform_position") return POSITION_LABELS[key.toLowerCase()] || key.replace(/_/g, " ");
  return key;
}

function rankSegments(segs: BreakdownSegment[]) {
  const withLeads = segs.filter((s) => s.leads > 0).sort((a, b) => a.cpl - b.cpl);
  const noLeads = segs.filter((s) => s.leads === 0).sort((a, b) => b.spend - a.spend);
  return [...withLeads, ...noLeads];
}

function BreakdownTable({
  title,
  type,
  segments,
}: {
  title: string;
  type: "age" | "gender" | "publisher_platform" | "platform_position";
  segments: BreakdownSegment[];
}) {
  const ranked = rankSegments(segments);
  const withLeads = ranked.filter((s) => s.leads > 0);
  const best = withLeads[0];
  const worst = withLeads.length > 1 ? withLeads[withLeads.length - 1] : null;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ranked : ranked.slice(0, 1);
  const hiddenCount = ranked.length - visible.length;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{title}</p>
      {ranked.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">Sem dados suficientes para este período.</p>
      ) : (
        <>
          {best && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-700 dark:text-emerald-400">
              Melhor: <strong>{labelFor(type, best.key)}</strong> · CPL R$ {best.cpl.toFixed(2)} · {best.leads} leads
            </div>
          )}
          <div className="rounded-lg border bg-card divide-y">
            {visible.map((s) => {
              const isBest = best?.key === s.key && withLeads.length > 1;
              const isWorst = worst?.key === s.key;
              return (
                <div
                  key={s.key}
                  className={`flex items-center justify-between gap-2 p-2 ${
                    isBest ? "bg-emerald-500/5" : isWorst ? "bg-red-500/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium truncate">{labelFor(type, s.key)}</span>
                    {isBest && <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-[10px]">Melhor</Badge>}
                    {isWorst && <Badge variant="outline" className="border-red-500/30 text-red-600 text-[10px]">Pior</Badge>}
                    {s.leads === 0 && <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px]">Sem leads</Badge>}
                  </div>
                  <div className="flex gap-3 text-[11px] tabular-nums flex-shrink-0 text-muted-foreground">
                    <span>CPL <strong className="text-foreground">{s.leads > 0 ? `R$ ${s.cpl.toFixed(2)}` : "—"}</strong></span>
                    <span>Leads <strong className="text-foreground">{s.leads}</strong></span>
                    <span className="hidden sm:inline">CTR <strong className="text-foreground">{s.ctr.toFixed(2)}%</strong></span>
                    <span className="hidden md:inline">Gasto <strong className="text-foreground">R$ {s.spend.toFixed(0)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
          {ranked.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-3 w-3" /> Ocultar demais
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" /> Ver custo dos demais ({hiddenCount})
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function BreakdownsSection({ breakdowns }: { breakdowns?: { age: BreakdownSegment[]; gender: BreakdownSegment[]; publisher_platform: BreakdownSegment[]; platform_position: BreakdownSegment[] } }) {
  if (!breakdowns) return null;

  const totalRows =
    breakdowns.age.length + breakdowns.gender.length + breakdowns.publisher_platform.length + breakdowns.platform_position.length;

  if (totalRows === 0) {
    return (
      <div className="mt-5 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Sem breakdowns sincronizados ainda. Execute uma nova sincronização para popular idade, gênero, plataforma e posicionamento.
      </div>
    );
  }

  const bestOf = (segs: BreakdownSegment[]) => rankSegments(segs)[0];
  const worstOf = (segs: BreakdownSegment[]) => {
    const r = rankSegments(segs);
    return r.length > 1 ? r[r.length - 1] : null;
  };

  const bestAge = bestOf(breakdowns.age);
  const worstAge = worstOf(breakdowns.age);
  const bestGender = bestOf(breakdowns.gender);
  const worstGender = worstOf(breakdowns.gender);
  const bestPlatform = bestOf(breakdowns.publisher_platform);
  const worstPlatform = worstOf(breakdowns.publisher_platform);
  const bestPosition = bestOf(breakdowns.platform_position);
  const worstPosition = worstOf(breakdowns.platform_position);

  const recommendation = [
    bestAge && `faixa ${bestAge.key}`,
    bestGender && (GENDER_LABELS[bestGender.key.toLowerCase()] || bestGender.key).toLowerCase(),
    bestPlatform && (PLATFORM_LABELS[bestPlatform.key.toLowerCase()] || bestPlatform.key),
    bestPosition && (POSITION_LABELS[bestPosition.key.toLowerCase()] || bestPosition.key),
  ].filter(Boolean).join(" · ");

  return (
    <div className="mt-5 space-y-5">
      <BreakdownTable title="Idade" type="age" segments={breakdowns.age} />
      <BreakdownTable title="Gênero" type="gender" segments={breakdowns.gender} />
      <BreakdownTable title="Plataforma" type="publisher_platform" segments={breakdowns.publisher_platform} />
      <BreakdownTable title="Posicionamento" type="platform_position" segments={breakdowns.platform_position} />

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" /> Análise consolidada
        </p>
        <ul className="text-xs space-y-1">
          {bestAge && (
            <li>
              <strong>Idade:</strong> melhor <span className="text-emerald-600">{bestAge.key}</span> (CPL R$ {bestAge.cpl.toFixed(2)})
              {worstAge && <> · pior <span className="text-red-600">{worstAge.key}</span> (CPL R$ {worstAge.cpl.toFixed(2)})</>}
            </li>
          )}
          {bestGender && (
            <li>
              <strong>Gênero:</strong> melhor <span className="text-emerald-600">{labelFor("gender", bestGender.key)}</span> (CPL R$ {bestGender.cpl.toFixed(2)})
              {worstGender && <> · pior <span className="text-red-600">{labelFor("gender", worstGender.key)}</span> (CPL R$ {worstGender.cpl.toFixed(2)})</>}
            </li>
          )}
          {bestPlatform && (
            <li>
              <strong>Plataforma:</strong> melhor <span className="text-emerald-600">{labelFor("publisher_platform", bestPlatform.key)}</span> (CPL R$ {bestPlatform.cpl.toFixed(2)})
              {worstPlatform && <> · pior <span className="text-red-600">{labelFor("publisher_platform", worstPlatform.key)}</span> (CPL R$ {worstPlatform.cpl.toFixed(2)})</>}
            </li>
          )}
          {bestPosition && (
            <li>
              <strong>Posicionamento:</strong> melhor <span className="text-emerald-600">{labelFor("platform_position", bestPosition.key)}</span> (CPL R$ {bestPosition.cpl.toFixed(2)})
              {worstPosition && <> · pior <span className="text-red-600">{labelFor("platform_position", worstPosition.key)}</span> (CPL R$ {worstPosition.cpl.toFixed(2)})</>}
            </li>
          )}
        </ul>
        {recommendation && (
          <p className="text-xs pt-1 border-t border-primary/20">
            <strong>Recomendação:</strong> concentrar orçamento em {recommendation}.
          </p>
        )}
      </div>
    </div>
  );
}

function CustomMetricsBlock({
  campaignId,
  totals,
  metrics,
  actionTotals,
}: {
  campaignId: string | null;
  totals: { spend: number; impressions: number; clicks: number; actions: Record<string, number> };
  metrics: ReturnType<typeof useCustomMetrics>["data"];
  actionTotals: { action_type: string; total: number }[];
}) {
  const [showRaw, setShowRaw] = useState(false);
  const list = metrics || [];
  const { data: accountId } = useQuery({
    queryKey: ["campaign-account-id", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .select("ad_account_id")
        .eq("id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data?.ad_account_id ?? null;
    },
  });

  const currentLpActions: string[] = [];

  const formatVal = (v: number, format: string) => {
    if (format === "currency") return `R$ ${v.toFixed(2)}`;
    if (format === "percent") return `${v.toFixed(2)}%`;
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };
  return (
    <div className="space-y-3 mt-5">
      {list.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
            Suas métricas personalizadas
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {list.map((m) => {
              const v = computeCustomMetric(m, totals);
              return (
                <div key={m.id} className="rounded-lg border bg-card p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{m.name}</p>
                  <p className="text-base font-semibold tabular-nums mt-0.5">{formatVal(v, m.format)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {actionTotals.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showRaw ? "▾" : "▸"} Eventos detectados pelo Meta ({actionTotals.length})
          </button>
          {showRaw && (
            <div className="mt-2 rounded-lg border bg-card divide-y">
              {actionTotals.map((a) => {
                const isLead = currentLpActions.includes(a.action_type);
                const canMark =
                  !!accountId && a.action_type.startsWith("offsite_conversion.custom.");
                return (
                  <div key={a.action_type} className="flex items-center justify-between gap-2 p-2 text-xs">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="truncate text-foreground">{friendlyActionLabel(a.action_type)}</span>
                      {isLead && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600 flex-shrink-0">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> Concluiu Forms
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-muted-foreground tabular-nums">
                        <strong className="text-foreground">{a.total.toFixed(0)}</strong>
                        <span className="text-[10px] ml-1 opacity-60">{a.action_type}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
