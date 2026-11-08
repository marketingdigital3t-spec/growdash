import { BarChart3, Coins, ShoppingCart, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { OrbitalFunnel } from "@/components/cosmic/OrbitalFunnel";
import { AnomalyRadar } from "@/components/cosmic/AnomalyRadar";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import { sanitizePhase } from "@/lib/phase/phase";
import { formatCurrency, formatInteger } from "@/lib/format/formatPtBr";

interface MissionDashboardProps {
  /** Faturamento mensal (substitui o valor do store caso fornecido). */
  monthlyRevenue?: number;
  /** Metricas reais de Investimento, Leads, CPL, Vendas e Faturamento */
  metrics?: {
    spend?: number;
    leads?: number;
    cpl?: number;
    sales?: number;
    revenue?: number;
    roas?: number;
    impressions?: number;
    clicks?: number;
    opportunities?: number;
    spendChange?: number;
    leadsChange?: number;
    cplChange?: number;
    revenueChange?: number;
  };
  className?: string;
}

/**
 * Dashboard Principal da Missao.
 *
 * Renderiza os 4 blocos de KPIs fundamentais solicitados pelo usuario:
 * 1. Investimento (gasto em anuncios Meta)
 * 2. Leads (volume de leads reais do periodo)
 * 3. CPL (custo por lead com inversao de cor)
 * 4. Vendas e Faturamento (receita bruta e total de vendas realizadas)
 *
 * Seguido pelo Funil Orbital 3D (2/3) e Radar de Anomalias (1/3).
 * A barra de Combustivel da Missao fica fixada no topo (sidebar superior).
 */
export function MissionDashboard({
  monthlyRevenue: propRevenue,
  metrics,
  className = "",
}: MissionDashboardProps) {
  const phase = sanitizePhase(useEffectivePhase());
  const storeRevenue = usePhaseStore((state) => state.monthlyRevenue);
  const currentRevenue = propRevenue ?? storeRevenue;

  // Valores base por fase como fallback resiliente
  const defaultMetricsByPhase = {
    terra: {
      spend: 45_000,
      leads: 1_582,
      cpl: 28.45,
      sales: 142,
      revenue: 49_700,
      spendChange: 8.5,
      leadsChange: 14.1,
      cplChange: -5.2,
      revenueChange: 12.4,
    },
    orbita: {
      spend: 180_000,
      leads: 7_680,
      cpl: 23.41,
      sales: 450,
      revenue: 92_500,
      spendChange: 12.4,
      leadsChange: 18.2,
      cplChange: -8.9,
      revenueChange: 19.5,
    },
    galaxia: {
      spend: 580_000,
      leads: 24_560,
      cpl: 23.61,
      sales: 1_256,
      revenue: 186_400,
      spendChange: 15.2,
      leadsChange: 24.1,
      cplChange: -11.2,
      revenueChange: 26.4,
    },
  }[phase];

  const fallback = defaultMetricsByPhase ?? {
    spend: 0,
    leads: 0,
    cpl: 0,
    sales: 0,
    revenue: 0,
    spendChange: 0,
    leadsChange: 0,
    cplChange: 0,
    revenueChange: 0,
  };

  const active = metrics ?? defaultMetricsByPhase ?? fallback;
const safeMetrics = {
    spend: Number.isFinite(active.spend) ? Number(active.spend) : fallback.spend,
    leads: Number.isFinite(active.leads) ? Number(active.leads) : fallback.leads,
    cpl: Number.isFinite(active.cpl) ? Number(active.cpl) : fallback.cpl,
    sales: Number.isFinite(active.sales) ? Number(active.sales) : fallback.sales,
    revenue: Number.isFinite(active.revenue) ? Number(active.revenue) : fallback.revenue,
    spendChange: Number.isFinite(active.spendChange) ? active.spendChange : undefined,
    leadsChange: Number.isFinite(active.leadsChange) ? active.leadsChange : undefined,
    cplChange: Number.isFinite(active.cplChange) ? active.cplChange : undefined,
    revenueChange: Number.isFinite(active.revenueChange) ? active.revenueChange : undefined,
  };

  const visitors = Number.isFinite(metrics?.impressions) ? Number(metrics?.impressions) : 0;
  const clicks = Number.isFinite(metrics?.clicks) ? Number(metrics?.clicks) : 0;
  const leads = safeMetrics.leads;
  const opportunities = Number.isFinite(metrics?.opportunities) ? Number(metrics?.opportunities) : 0;
  const clients = safeMetrics.sales;

  const realFunnelSteps = [
    { label: "VISITANTES", value: visitors },
    { label: "CLIQUES", value: clicks, conversionRate: visitors > 0 ? (clicks / visitors) * 100 : 0 },
    { label: "LEADS", value: leads, conversionRate: clicks > 0 ? (leads / clicks) * 100 : 0 },
    { label: "OPORTUNIDADES", value: opportunities, conversionRate: leads > 0 ? (opportunities / leads) * 100 : 0 },
    { label: "CLIENTES", value: clients, conversionRate: opportunities > 0 ? (clients / opportunities) * 100 : 0 },
  ];

  const totalConversionRate = visitors > 0 ? (clients / visitors) * 100 : 0;

  return (
    <div className={`space-y-5 sm:space-y-6 ${className}`}>
      {/* Grade com os 4 KPIs solicitados: Investimento, Leads, CPL, Vendas e Faturamento */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {/* 1. Investimento */}
        <KpiCard
          label="Investimento"
          value={formatCurrency(safeMetrics.spend)}
          changePercent={safeMetrics.spendChange}
          changeLabel="Meta Ads"
          icon={<Coins className="h-5 w-5" />}
          sparklineData={[14, 18, 16, 24, 22, 30, 28, 36, 32, 42, 38, 48]}
        />

        {/* 2. Leads */}
        <KpiCard
          label="Leads"
          value={formatInteger(safeMetrics.leads)}
          changePercent={safeMetrics.leadsChange}
          changeLabel="total do período"
          icon={<Users className="h-5 w-5" />}
          sparklineData={[120, 160, 140, 220, 200, 280, 260, 320, 300, 380, 350, 420]}
        />

        {/* 3. CPL — queda e positiva (invertChangeColor) */}
        <KpiCard
          label="CPL"
          value={formatCurrency(safeMetrics.cpl)}
          changePercent={safeMetrics.cplChange}
          invertChangeColor
          changeLabel="custo por lead"
          icon={<BarChart3 className="h-5 w-5" />}
          sparklineData={[32, 30, 31, 28, 29, 26, 27, 24, 25, 23.61]}
        />

        {/* 4. Vendas e Faturamento */}
        <KpiCard
          label="Faturamento"
          value={formatCurrency(safeMetrics.revenue)}
          changePercent={safeMetrics.revenueChange}
          changeLabel={`${formatInteger(safeMetrics.sales)} vendas realizadas`}
          icon={<ShoppingCart className="h-5 w-5" />}
          sparklineData={[2.4, 2.8, 3.1, 2.9, 3.4, 3.8, 3.5, 4.0, 3.9, 4.37]}
        />
      </div>

      {/* Grade mestre: Funil Orbital (2/3) + Radar de Anomalias (1/3) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 sm:gap-6">
        {/* Funil Orbital da Missao em 2/3 da largura (8 colunas) */}
        <div className="lg:col-span-8">
          <OrbitalFunnel steps={realFunnelSteps} totalConversionRate={totalConversionRate} monthlyRevenue={Number.isFinite(currentRevenue) ? currentRevenue : safeMetrics.revenue} />
        </div>

        {/* Radar de Anomalias em 1/3 da largura (4 colunas) */}
        <div className="lg:col-span-4">
          <AnomalyRadar />
        </div>
      </div>
    </div>
  );
}
