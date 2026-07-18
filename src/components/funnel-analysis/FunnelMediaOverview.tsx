import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelMediaMetrics } from "@/lib/funnelMediaMetrics";
import { Activity, BadgeDollarSign, Eye, Gauge, MousePointerClick, Users } from "lucide-react";
import { metricDescription } from "@/lib/metricPresentation";

const fmtInt = (value: number) => Math.round(value).toLocaleString("pt-BR");
const fmtPct = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtBRL = (value: number | null) => value == null
  ? "—"
  : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function FunnelMediaOverview({ metrics }: { metrics: FunnelMediaMetrics }) {
  const cards = [
    { label: "Investimento Meta", value: fmtBRL(metrics.spend), detail: "Meta Ads", icon: BadgeDollarSign },
    { label: "Impressões", value: fmtInt(metrics.impressions), detail: `Alcance ${fmtInt(metrics.reach)}`, icon: Eye },
    { label: "Cliques no link", value: fmtInt(metrics.clicks), detail: `CTR ${fmtPct(metrics.ctr)}`, icon: MousePointerClick },
    { label: "Leads Meta", value: fmtInt(metrics.metaLeads), detail: `CPL ${fmtBRL(metrics.metaCpl)}`, icon: Users },
    { label: "Leads no RD", value: fmtInt(metrics.rdLeads), detail: `CPL real ${fmtBRL(metrics.rdCpl)}`, icon: Activity },
    { label: "CAC / ROAS", value: `${fmtBRL(metrics.cac)} / ${metrics.roas == null ? "—" : `${metrics.roas.toFixed(2)}x`}`, detail: `${metrics.sales} venda(s)`, icon: Gauge },
  ];

  const coverageTone = metrics.rdCoverage == null
    ? "text-muted-foreground"
    : metrics.rdCoverage >= 85 && metrics.rdCoverage <= 115
      ? "text-emerald-400"
      : "text-amber-400";

  return (
    <Card className="gd-panel border-border/50 bg-card/70">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Meta Ads × RD Station</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Mídia e funil reconciliados para a conta, campanha e período selecionados.</p>
          </div>
          <div className={`rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold ${coverageTone}`}>
            Cobertura RD: {metrics.rdCoverage == null ? "sem base Meta" : fmtPct(metrics.rdCoverage)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {cards.map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="gd-metric-card min-w-0 cursor-default rounded-xl border border-border/50 bg-background/70 p-3" title={metricDescription(label)}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
                <Icon className="h-4 w-4 shrink-0 text-[#e6b83f]" />
              </div>
              <p className="mt-2 truncate text-lg font-bold text-foreground" title={value}>{value}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground" title={detail}>{detail}</p>
            </div>
          ))}
        </div>
        {metrics.metaLeads > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Diferença de leads RD − Meta: <strong className={Math.abs(metrics.leadGap) <= Math.max(1, metrics.metaLeads * 0.15) ? "text-emerald-400" : "text-amber-400"}>{metrics.leadGap > 0 ? "+" : ""}{fmtInt(metrics.leadGap)}</strong>. A comparação respeita o mesmo período, mas pode variar conforme atribuição e preenchimento de UTMs.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
