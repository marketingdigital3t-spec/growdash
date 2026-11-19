/**
 * Derivacao das anomalias do Radar a partir das metricas reais da missao.
 *
 * O radar exibia anomalias fixas (campanhas e valores inventados) que nao
 * tinham relacao com o funil e a operacao do usuario. Aqui cada alerta e
 * calculado a partir dos numeros que o dashboard ja carrega, e o radar
 * mostra apenas o que o dado sustenta.
 */

export type MissionAnomalySeverity = "alta" | "media" | "ok";

export interface MissionAnomaly {
  id: string;
  title: string;
  context: string;
  metric: string;
  severity: MissionAnomalySeverity;
  /** Posicao relativa no radar: x(-1..1), y(-1..1). */
  blip?: { x: number; y: number };
}

export interface MissionAnomalyInput {
  spend?: number;
  leads?: number;
  cpl?: number;
  sales?: number;
  revenue?: number;
  impressions?: number;
  clicks?: number;
  opportunities?: number;
  spendChange?: number;
  leadsChange?: number;
  cplChange?: number;
}

const BRl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * CPL de referencia: o custo por lead que a operacao considera aceitavel.
 * Baseado no custo historico da conta (R$ 40) - acima disso o alerta e
 * relevante; a margem de 25% evita que cada variacao seja tratada como
 * anomalia.
 */
const CPL_REFERENCE = 40;
const CPL_ALERT_RATIO = 1.25;

/**
 * Gera as anomalias a partir das metricas reais.
 *
 * Regras:
 * - CPL acima de 125% da referencia: severidade alta
 * - Queda de leads ou CPL subindo no periodo: severidade media
 * - Sem nenhum desvio relevante: "Tudo sob controle" com o funil real
 *
 * Retorna no maximo 3 alertas para o radar nao perder o foco, e nunca
 * inventa campanha, etapa ou valor que nao venha da metrica.
 */
export function deriveMissionAnomalies(input: MissionAnomalyInput): MissionAnomaly[] {
  const spend = isFiniteNumber(input.spend) ? input.spend : 0;
  const leads = isFiniteNumber(input.leads) ? input.leads : 0;
  const cpl = isFiniteNumber(input.cpl) ? input.cpl : 0;
  const sales = isFiniteNumber(input.sales) ? input.sales : 0;
  const revenue = isFiniteNumber(input.revenue) ? input.revenue : 0;
  const impressions = isFiniteNumber(input.impressions) ? input.impressions : 0;
  const opportunities = isFiniteNumber(input.opportunities) ? input.opportunities : 0;
  const spendChange = isFiniteNumber(input.spendChange) ? input.spendChange : undefined;
  const leadsChange = isFiniteNumber(input.leadsChange) ? input.leadsChange : undefined;
  const cplChange = isFiniteNumber(input.cplChange) ? input.cplChange : undefined;

  const anomalies: MissionAnomaly[] = [];

  // 1) CPL acima do aceitavel
  if (cpl > 0 && cpl > CPL_REFERENCE * CPL_ALERT_RATIO) {
    anomalies.push({
      id: "cpl",
      title: "CPL acima do esperado",
      context: `Referencia: ${BRl.format(CPL_REFERENCE)} por lead`,
      metric: `CPL atual: ${BRl.format(cpl)}`,
      severity: "alta",
      blip: { x: 0.45, y: -0.38 },
    });
  }

  // 2) Queda de leads no periodo
  if (leadsChange !== undefined && leadsChange < -10) {
    anomalies.push({
      id: "leads",
      title: "Queda de leads",
      context: `${leads.toLocaleString("pt-BR")} leads no periodo`,
      metric: `Variacao: ${leadsChange.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      severity: "media",
      blip: { x: -0.52, y: 0.22 },
    });
  }

  // 3) CPL subindo no periodo
  if (cplChange !== undefined && cplChange > 10) {
    anomalies.push({
      id: "cpl-trend",
      title: "CPL em alta",
      context: `CPL atual: ${BRl.format(cpl)}`,
      metric: `Variacao: ${cplChange.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      severity: "media",
      blip: { x: 0.28, y: 0.58 },
    });
  }

  // 4) Gasto alto sem leads na mesma medida
  if (spend > 0 && leads === 0) {
    anomalies.push({
      id: "spend-sem-leads",
      title: "Gasto sem leads",
      context: `Investimento: ${BRl.format(spend)}`,
      metric: "Nenhum lead registrado no periodo",
      severity: "alta",
      blip: { x: 0.1, y: -0.6 },
    });
  }

  // 5) Impressoes com CTR muito baixo
  const clicks = isFiniteNumber(input.clicks) ? input.clicks : 0;
  if (impressions > 0 && clicks / impressions < 0.002) {
    anomalies.push({
      id: "ctr-baixo",
      title: "CTR abaixo do esperado",
      context: `${impressions.toLocaleString("pt-BR")} impressoes`,
      metric: `CTR atual: ${((clicks / impressions) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
      severity: "media",
      blip: { x: -0.2, y: 0.5 },
    });
  }

  if (anomalies.length) return anomalies.slice(0, 3);

  // Sem desvio relevante: mostra o estado real do funil, nao um numero fixo.
  const resumo = [
    leads > 0 ? `${leads.toLocaleString("pt-BR")} leads` : "sem leads no periodo",
    sales > 0 ? `${sales.toLocaleString("pt-BR")} vendas` : "sem vendas",
    revenue > 0 ? BRl.format(revenue) : "sem faturamento",
  ].join(" · ");

  return [
    {
      id: "ok",
      title: "Tudo sob controle",
      context: resumo,
      metric: opportunities > 0 ? `${opportunities.toLocaleString("pt-BR")} oportunidades` : "Nenhuma anomalia critica",
      severity: "ok",
    },
  ];
}
