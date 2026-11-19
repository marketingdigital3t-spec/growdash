import { Link } from "react-router-dom";
import { GitMerge, MousePointerClick, Sparkles, Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";
import { computeLeadsPerSale, type LeadsPerSaleInput } from "@/lib/funnelGrowthRatio";

interface Props {
  /** Mesmos numeros usados nos KPIs: recorte unico de funil, periodo e conta. */
  input: LeadsPerSaleInput;
  className?: string;
}

const fmtInt = (value: number) => value.toLocaleString("pt-BR");

/**
 * Bloco de growth do funil: junta os leads da Meta e do RD Station em um
 * so lugar e responde "quantos leads eu preciso para 1 venda".
 *
 * O numero do meio e o que o usuario pediu: "eu tenho 112 lead e tenho 8
 * vendas, entao a cada 14 leads eu tenho 1 venda".
 */
export function FunnelGrowthBlock({ input, className = "" }: Props) {
  const resultado = computeLeadsPerSale(input);
  const metaLeads = Number.isFinite(input.metaLeads) ? Number(input.metaLeads) : 0;
  const temMeta = input.metaLeadsAvailable === true;
  const cobertura = resultado.attributionCoverage;

  return (
    <div className={`grid gap-4 lg:grid-cols-2 ${className}`}>
      {/* Bloco 1: leads Meta + RD no mesmo lugar */}
      <MetricHelpTooltip
        title="Leads totais (Meta + RD)"
        description="Soma dos leads registrados pela Meta Ads e das negociações criadas no RD Station no mesmo recorte. Um mesmo lead pode existir nas duas fontes."
        showHint
      >
        <Card className="gd-metric-card h-full border-border/60 bg-card/75 backdrop-blur">
          <CardContent className="gd-funnel-kpi-content flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <span className="gd-funnel-kpi-label text-muted-foreground">Leads totais (Meta + RD)</span>
              <GitMerge className="gd-funnel-kpi-icon shrink-0 text-primary" />
            </div>

            <b className="font-display text-2xl font-black tabular-nums text-foreground sm:text-3xl">
              {fmtInt(resultado.totalLeads)}
            </b>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <MousePointerClick className="h-3 w-3 text-primary" /> Meta Ads
                </span>
                <b className="font-display mt-0.5 block text-sm font-bold tabular-nums text-foreground">
                  {temMeta ? fmtInt(metaLeads) : "—"}
                </b>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary-soft" /> RD Station
                </span>
                <b className="font-display mt-0.5 block text-sm font-bold tabular-nums text-foreground">
                  {fmtInt(input.rdLeads)}
                </b>
              </div>
            </div>

            {cobertura !== null && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Rastreamento da Meta aplicado em{" "}
                <b className="tabular-nums text-foreground">{Math.round(cobertura * 100)}%</b>{" "}
                dos negócios do recorte.
              </p>
            )}
          </CardContent>
        </Card>
      </MetricHelpTooltip>

      {/* Bloco 2: quantos leads para 1 venda */}
      <MetricHelpTooltip
        title="Leads por venda"
        description="Quantos leads foram necessários para cada venda realizada no mesmo recorte. É o número que mostra se a operação converte ou só acumula lead."
        showHint
      >
        <Card className="gd-metric-card h-full border-border/60 bg-card/75 backdrop-blur">
          <CardContent className="gd-funnel-kpi-content flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <span className="gd-funnel-kpi-label text-muted-foreground">Leads por venda</span>
              <Target className="gd-funnel-kpi-icon shrink-0 text-primary" />
            </div>

            <b className="font-display text-2xl font-black tabular-nums text-foreground sm:text-3xl">
              {resultado.label}
            </b>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {fmtInt(resultado.totalLeads)} leads → {fmtInt(resultado.sales)}{" "}
              {resultado.sales === 1 ? "venda" : "vendas"} no período
              {resultado.leadsPerSale !== null && (
                <> · {resultado.leadsPerSale.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} leads por venda</>
              )}
            </p>

            {resultado.caveat && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                {resultado.caveat}
              </p>
            )}

            <Link
              to="/analise-funis"
              className="mt-auto inline-flex items-center gap-1.5 self-start text-[11px] font-bold uppercase tracking-wider text-primary transition hover:opacity-80"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Ver composição do funil
            </Link>
          </CardContent>
        </Card>
      </MetricHelpTooltip>
    </div>
  );
}
