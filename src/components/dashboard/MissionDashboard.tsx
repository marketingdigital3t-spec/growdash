import { Crosshair, Eye, Users, DollarSign } from "lucide-react";
import { FuelBar } from "@/components/layout/FuelBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { OrbitalFunnel } from "@/components/cosmic/OrbitalFunnel";
import { AnomalyRadar } from "@/components/cosmic/AnomalyRadar";
import { useEffectivePhase, usePhaseStore } from "@/lib/phase/phaseStore";
import { formatCurrency, formatInteger, formatMultiple } from "@/lib/format/formatPtBr";

interface MissionDashboardProps {
  /** Faturamento mensal (substitui o valor do store caso fornecido). */
  monthlyRevenue?: number;
  /** Metricas reais ou sobrescritas */
  metrics?: {
    impressions: number;
    roas: number;
    cpl: number;
    leads: number;
    impressionsChange?: number;
    roasChange?: number;
    cplChange?: number;
    leadsChange?: number;
  };
  className?: string;
}

/**
 * Dashboard Principal da Missao (ETAPA 3 do Prompt Mestre).
 *
 * Segue estritamente a secao 9.1:
 * - Barra Combustivel da Missao em largura total
 * - Grade de 4 KPIs (Impressoes, ROAS, CPL com inversao de cor, Leads)
 * - Funil Orbital 3D em aneis concentricos (2/3 da largura)
 * - Radar de Anomalias com feixe girando e lista de alertas (1/3 da largura)
 */
export function MissionDashboard({
  monthlyRevenue: propRevenue,
  metrics,
  className = "",
}: MissionDashboardProps) {
  const phase = useEffectivePhase();
  const storeRevenue = usePhaseStore((state) => state.monthlyRevenue);
  const currentRevenue = propRevenue ?? storeRevenue;

  // Valores coerentes por fase (conforme secao 10 do Prompt Mestre)
  const defaultMetricsByPhase = {
    terra: {
      impressions: 1_245_000,
      roas: 3.21,
      cpl: 28.45,
      leads: 1_582,
      impressionsChange: 12.4,
      roasChange: 8.5,
      cplChange: -5.2,
      leadsChange: 14.1,
    },
    orbita: {
      impressions: 8_420_000,
      roas: 4.37,
      cpl: 23.41,
      leads: 13_680,
      impressionsChange: 18.6,
      roasChange: 15.2,
      cplChange: -8.9,
      leadsChange: 21.4,
    },
    galaxia: {
      impressions: 24_750_521,
      roas: 4.37,
      cpl: 23.61,
      leads: 33_214,
      impressionsChange: 18.6,
      roasChange: 22.4,
      cplChange: -11.2,
      leadsChange: 24.1,
    },
  }[phase];

  const activeMetrics = metrics ?? defaultMetricsByPhase;

  return (
    <div className={`space-y-5 sm:space-y-6 ${className}`}>
      {/* 1. Barra de Combustivel da Missao em largura total */}
      <FuelBar />

      {/* 2. Grade com os 4 KPIs principais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {/* Impressoes */}
        <KpiCard
          label="Impressões"
          value={formatInteger(activeMetrics.impressions)}
          changePercent={activeMetrics.impressionsChange}
          icon={<Eye className="h-5 w-5" />}
          sparklineData={[14, 18, 16, 24, 22, 30, 28, 36, 32, 42, 38, 48]}
        />

        {/* ROAS */}
        <KpiCard
          label="ROAS"
          value={formatMultiple(activeMetrics.roas, 2)}
          changePercent={activeMetrics.roasChange}
          icon={<Crosshair className="h-5 w-5" />}
          sparklineData={[2.4, 2.8, 3.1, 2.9, 3.4, 3.8, 3.5, 4.0, 3.9, 4.37]}
        />

        {/* CPL — queda e positiva (invertChangeColor) */}
        <KpiCard
          label="CPL"
          value={formatCurrency(activeMetrics.cpl)}
          changePercent={activeMetrics.cplChange}
          invertChangeColor
          icon={<DollarSign className="h-5 w-5" />}
          sparklineData={[32, 30, 31, 28, 29, 26, 27, 24, 25, 23.61]}
        />

        {/* Leads */}
        <KpiCard
          label="Leads"
          value={formatInteger(activeMetrics.leads)}
          changePercent={activeMetrics.leadsChange}
          icon={<Users className="h-5 w-5" />}
          sparklineData={[120, 160, 140, 220, 200, 280, 260, 320, 300, 380, 350, 420]}
        />
      </div>

      {/* 3. Grade mestre: Funil Orbital (2/3) + Radar de Anomalias (1/3) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 sm:gap-6">
        {/* Funil Orbital da Missao em 2/3 da largura (8 colunas) */}
        <div className="lg:col-span-8">
          <OrbitalFunnel monthlyRevenue={currentRevenue} />
        </div>

        {/* Radar de Anomalias em 1/3 da largura (4 colunas) */}
        <div className="lg:col-span-4">
          <AnomalyRadar />
        </div>
      </div>
    </div>
  );
}
