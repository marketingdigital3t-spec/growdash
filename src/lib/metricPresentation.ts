export type MetricKind = "count" | "currency" | "percentage" | "ratio" | "duration" | "decimal";

const descriptions: Record<string, string> = {
  "leads totais": "Quantidade absoluta de leads no período e filtros selecionados.",
  "leads qualificados": "Leads que avançaram para uma etapa considerada qualificada no CRM.",
  "conversões / vendas": "Quantidade de negócios marcados como ganhos ou vendas confirmadas.",
  "taxa de conversão": "Percentual de leads que se transformaram em conversão ou venda.",
  "tempo médio até conversão": "Média de dias entre a entrada do lead e a conversão.",
  "ticket médio": "Receita dividida pela quantidade de vendas confirmadas.",
  "receita gerada": "Valor total atribuído às vendas do período.",
  "investimento meta": "Valor consumido pelas campanhas da Meta Ads no período e conta selecionados.",
  "cliques no link": "Quantidade de cliques que levaram o usuário ao destino configurado no anúncio.",
  "leads meta": "Resultados de lead atribuídos pela Meta conforme a janela de atribuição da conta.",
  "leads no rd": "Negociações encontradas no RD Station para a mesma conta e o mesmo período.",
  "cac / roas": "CAC é o investimento dividido pelas vendas; ROAS é a receita atribuída dividida pelo investimento.",
  "cpl / cac": "CPL é o investimento por lead no RD; CAC é o investimento por venda confirmada.",
  "faturamento líquido": "Receita após descontos, taxas e ajustes registrados.",
  "gastos com anúncios": "Valor investido em mídia paga no período selecionado.",
  investimento: "Valor consumido pelas campanhas no período selecionado.",
  leads: "Quantidade absoluta de leads atribuídos aos filtros atuais.",
  cpl: "Custo por lead: investimento dividido pela quantidade de leads.",
  roas: "Retorno sobre mídia: receita atribuída dividida pelo investimento em anúncios.",
  lucro: "Receita líquida menos mídia, impostos e despesas cadastradas.",
  margem: "Percentual do lucro em relação à receita.",
  recebíveis: "Valores registrados que ainda estão pendentes de recebimento.",
  "previsão 30d": "Projeção de 30 dias baseada no ritmo observado no período atual.",
  saúde: "Quantidade de alertas operacionais abertos para a seleção atual.",
  vendas: "Quantidade absoluta de vendas confirmadas no período.",
  impressões: "Número de vezes em que os anúncios foram exibidos.",
  alcance: "Quantidade estimada de pessoas únicas alcançadas.",
  ctr: "Taxa de cliques: cliques divididos pelas impressões.",
  cpm: "Custo médio para cada mil impressões.",
  cliques: "Quantidade de cliques atribuídos aos anúncios.",
  frequência: "Média de vezes em que cada pessoa alcançada viu o anúncio.",
};

export function metricDescription(label: string, fallback?: string) {
  const normalized = label.trim().toLocaleLowerCase("pt-BR");
  return descriptions[normalized] ?? fallback ?? `Métrica “${label}” calculada para a conta, campanha e período selecionados.`;
}

export function formatMetric(value: number, kind: MetricKind, locale = "pt-BR") {
  const safe = Number.isFinite(value) ? value : 0;
  if (kind === "count") return Math.round(safe).toLocaleString(locale, { maximumFractionDigits: 0 });
  if (kind === "currency") return safe.toLocaleString(locale, { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (kind === "percentage") return `${safe.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  if (kind === "ratio") return `${safe.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
  if (kind === "duration") return `${safe.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias`;
  return safe.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
