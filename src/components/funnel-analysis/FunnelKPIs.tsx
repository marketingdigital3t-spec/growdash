import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Users, Trophy, Percent, Clock, DollarSign, TrendingUp, Target } from "lucide-react";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { metricDescription } from "@/lib/metricPresentation";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";

interface Props {
  a: FunnelAnalytics;
  rdLeads: number;
  rdLeadsLoading?: boolean;
  rdLeadsError?: boolean;
  trafficSpend: number;
  metaLeads: number;
  metaLeadsAvailable?: boolean;
  metaLeadsLoading?: boolean;
  trafficLoading?: boolean;
  trafficUnavailable?: boolean;
  trafficReason?: string | null;
  cpl?: number | null;
  rdCpl?: number | null;
  metaCplLoading?: boolean;
  cac?: number | null;
  roas?: number | null;
  salesConversionRate?: number | null;
  previousAvgDaysToConvert?: number | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

type KpiTone = "neutral" | "positive" | "negative";

const toneClasses: Record<KpiTone, { text: string; border: string; icon: string }> = {
  neutral: { text: "text-foreground", border: "border-l-border", icon: "text-muted-foreground" },
  positive: { text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500", icon: "text-emerald-600 dark:text-emerald-400" },
  negative: { text: "text-red-600 dark:text-red-400", border: "border-l-red-500", icon: "text-red-600 dark:text-red-400" },
};

export function FunnelKPIs({ a, rdLeads, rdLeadsLoading = false, rdLeadsError = false, trafficSpend, metaLeads, metaLeadsAvailable = false, metaLeadsLoading = false, trafficLoading = false, trafficUnavailable = false, trafficReason, cpl, rdCpl, metaCplLoading = false, cac, roas, salesConversionRate, previousAvgDaysToConvert }: Props) {
  // A tiny/empty comparison base produces misleading values such as
  // 2.213.930%. Only show a change when the previous period has a meaningful
  // measured average; otherwise keep the card honest and comparable.
  const timeChange = previousAvgDaysToConvert != null && previousAvgDaysToConvert >= 1
    ? ((a.avgDaysToConvert - previousAvgDaysToConvert) / previousAvgDaysToConvert) * 100
    : null;
  const rdLeadValue = rdLeadsError ? null : rdLeadsLoading ? null : rdLeads;
  const conversionTone: KpiTone = a.conversions > 0 ? "positive" : trafficSpend > 0 || rdLeads > 0 ? "negative" : "neutral";
  const salesRateTone: KpiTone = salesConversionRate == null ? (metaLeads > 0 ? "negative" : "neutral") : salesConversionRate > 0 ? "positive" : "negative";
  const timeTone: KpiTone = timeChange == null ? "neutral" : timeChange <= 0 ? "positive" : "negative";
  const revenueTone: KpiTone = a.revenue > 0 ? "positive" : trafficSpend > 0 ? "negative" : "neutral";
  const cacTone: KpiTone = cac == null ? "neutral" : a.avgTicket > 0 && cac > a.avgTicket ? "negative" : "positive";
  const roasTone: KpiTone = roas == null ? "neutral" : roas >= 1 ? "positive" : "negative";
  const cards = [
    { label: "Investimento em anúncio", value: trafficSpend, icon: DollarSign, tone: "neutral" as KpiTone, format: "brl" as const, unavailable: trafficLoading || trafficUnavailable, detail: trafficReason || "Investimento atribuído pela Meta Ads no período selecionado." },
    { label: "Leads Meta", value: metaLeads, icon: Users, tone: "neutral" as KpiTone, format: "int" as const, unavailable: metaLeadsLoading || !metaLeadsAvailable, detail: "Formulários + leads de site + conversas iniciadas · Meta Ads" },
    { label: "Lead", value: rdLeadValue, icon: Users, tone: "neutral" as KpiTone, format: "int" as const, detail: rdLeadsError ? "Falha ao carregar negociações RD Station" : "Negociações criadas no RD Station · período e filtros selecionados" },
    { label: "Conversões / Vendas", value: a.conversions, icon: Trophy, tone: conversionTone, format: "int" as const },
    { label: "Conversão Meta → venda", value: salesConversionRate, icon: Percent, tone: salesRateTone, format: "pct" as const, decimals: 2, unavailable: !metaLeadsAvailable },
    { label: "Tempo médio até conversão", value: a.avgDaysToConvert, icon: Clock, tone: timeTone, format: "days" as const, detail: timeChange == null ? "Sem período anterior" : `${Math.abs(timeChange).toFixed(0)}% ${timeChange <= 0 ? "menor" : "maior"} que período anterior` },
    { label: "Ticket médio", value: a.avgTicket, icon: Target, tone: a.avgTicket > 0 ? "positive" as KpiTone : "neutral" as KpiTone, format: "brl" as const },
    { label: "Receita gerada", value: a.revenue, icon: DollarSign, tone: revenueTone, format: "brl" as const },
    {
      label: "CPL Meta",
      value: 0,
      icon: TrendingUp,
      tone: "neutral" as KpiTone,
      format: "custom" as const,
      custom: metaCplLoading ? "Sincronizando…" : cpl == null ? "—" : fmtBRL(cpl),
      detail: "Investimento Meta ÷ leads Meta.",
    },
    {
      label: "Mídia/lead RD",
      value: 0,
      icon: DollarSign,
      tone: "neutral" as KpiTone,
      format: "custom" as const,
      custom: rdCpl == null ? "—" : fmtBRL(rdCpl),
      detail: "Investimento Meta ÷ negócios criados no RD.",
    },
    {
      label: "CAC",
      value: 0,
      icon: Target,
      tone: cacTone,
      format: "custom" as const,
      custom: cac == null ? "—" : fmtBRL(cac),
      detail: "Investimento Meta ÷ vendas confirmadas.",
    },
    {
      label: "ROAS",
      value: 0,
      icon: TrendingUp,
      tone: roasTone,
      format: "custom" as const,
      custom: roas == null ? "—" : `${roas.toFixed(2)}x`,
      detail: "Receita atribuída ÷ investimento em anúncios.",
    },
  ];

  return (
    <div className="gd-kpi-grid gd-funnel-kpi-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const tone = toneClasses[c.tone];
        return (
          <MetricHelpTooltip key={c.label} title={c.label} description={metricDescription(c.label)} className="gd-funnel-kpi-tooltip" showHint>
            <Card data-kpi-tone={c.tone} className={`gd-metric-card gd-funnel-kpi cursor-default bg-card/75 border-border/60 border-l-2 backdrop-blur ${tone.border}`}>
              <CardContent className="gd-funnel-kpi-content flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="gd-funnel-kpi-label text-muted-foreground">{c.label}</span>
                  <Icon className={`gd-funnel-kpi-icon shrink-0 ${tone.icon}`} />
                </div>
                <div className={`gd-funnel-kpi-value ${tone.text}`}>
                  {c.format === "int" && c.label === "Leads Meta" && (("unavailable" in c && c.unavailable) ? (metaLeadsLoading ? "Sincronizando…" : "Indisponível") : <AnimatedNumber value={Math.round(c.value ?? 0)} decimals={0} />)}
                  {c.format === "int" && c.label === "Lead" && (rdLeadsLoading ? "Carregando…" : rdLeadsError ? "Indisponível" : <AnimatedNumber value={Math.round(c.value ?? 0)} decimals={0} />)}
                  {c.format === "int" && c.label === "Conversões / Vendas" && <AnimatedNumber value={Math.round(c.value ?? 0)} decimals={0} />}
                  {c.format === "pct" && ("unavailable" in c && c.unavailable ? "Indisponível" : <><AnimatedNumber value={c.value ?? 0} decimals={c.decimals ?? 1} />%</>)}
                  {c.format === "days" && <><AnimatedNumber value={c.value} decimals={1} /> <span className="text-sm text-muted-foreground">dias</span></>}
                  {c.format === "brl" && (("unavailable" in c && c.unavailable) ? "Aguardando sincronização" : fmtBRL(c.value))}
                  {c.format === "custom" && <span>{c.custom}</span>}
                </div>
                {c.detail && <p className="gd-funnel-kpi-detail text-muted-foreground">{c.detail}</p>}
              </CardContent>
            </Card>
          </MetricHelpTooltip>
        );
      })}
    </div>
  );
}
