import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

export type PaidTrafficInsightRow = {
  date: string;
  spend?: number | null;
  impressions?: number | null;
  reach?: number | null;
  clicks?: number | null;
  leads?: number | null;
};

export type PaidTrafficDealRow = {
  lead_created_at?: string | null;
};

export type PaidTrafficSaleRow = {
  sale_date: string;
  status: string;
  net_revenue?: number | null;
  quantity?: number | null;
};

export type PaidTrafficMetrics = {
  spend: number;
  formLeads: number;
  conversations: number;
  leads: number;
  impressions: number;
  reach: number;
  clicks: number;
  rd: number;
  sales: number;
  revenue: number;
  cpl: number;
  cpc: number;
  ctr: number;
  cpm: number;
  conversionRate: number;
  cac: number;
  roas: number;
  profit: number;
  coverage: number;
};

export type MonthlyPerformance = {
  label: string;
  from: string;
  to: string;
  daysInPeriod: number;
  daysWithData: number;
  isPartial: boolean;
  metrics: PaidTrafficMetrics;
};

export type WeeklyPerformance = {
  week: string;
  from: string;
  to: string;
  month: "current" | "previous";
  daysWithData: number;
  metrics: PaidTrafficMetrics;
};

export type MetricComparison = {
  id: keyof PaidTrafficMetrics;
  label: string;
  current: number;
  previous: number;
  variationPercent: number | null;
  lowerIsBetter: boolean;
  assessment: "positive" | "negative" | "neutral" | "unknown";
};

export type InsightRecommendation = {
  title: string;
  evidence: string;
  recommendation: string;
  priority: "Alta" | "Média" | "Baixa";
  /** Passos operacionais verificáveis, exibidos no relatório executivo. */
  steps?: string[];
};

export type TwoMonthAnalysis = {
  analysisFrom: string;
  analysisTo: string;
  currentMonth: MonthlyPerformance;
  previousMonth: MonthlyPerformance;
  metricComparisons: MetricComparison[];
  weeklyComparison: WeeklyPerformance[];
  wins: InsightRecommendation[];
  risks: InsightRecommendation[];
  actions: InsightRecommendation[];
};

const comparisonMetrics: Array<{ id: keyof PaidTrafficMetrics; label: string; lowerIsBetter?: boolean }> = [
  { id: "spend", label: "Investimento" },
  { id: "leads", label: "Leads totais" },
  { id: "conversations", label: "Conversas iniciadas" },
  { id: "cpl", label: "CPL", lowerIsBetter: true },
  { id: "impressions", label: "Impressões" },
  { id: "clicks", label: "Cliques" },
  { id: "ctr", label: "CTR" },
  { id: "cpm", label: "CPM", lowerIsBetter: true },
  { id: "rd", label: "Negócios RD" },
  { id: "sales", label: "Vendas" },
  { id: "revenue", label: "Receita" },
  { id: "cac", label: "CAC", lowerIsBetter: true },
  { id: "roas", label: "ROAS" },
  { id: "profit", label: "Resultado" },
];

function number(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentChange(current: number, previous: number) {
  return previous !== 0 ? round(((current - previous) / Math.abs(previous)) * 100, 1) : null;
}

function dateToString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function inRange(date: string, from: string, to: string) {
  return Boolean(date) && date >= from && date <= to;
}

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1);
}

function calculateMetrics(
  insights: PaidTrafficInsightRow[],
  deals: PaidTrafficDealRow[],
  sales: PaidTrafficSaleRow[],
  conversationsByDate: Record<string, number>,
  from: string,
  to: string,
): PaidTrafficMetrics {
  const scopedInsights = insights.filter((row) => inRange(dateOnly(row.date), from, to));
  const scopedDeals = deals.filter((row) => inRange(dateOnly(row.lead_created_at), from, to));
  const scopedSales = sales.filter((row) => inRange(dateOnly(row.sale_date), from, to));
  const spend = scopedInsights.reduce((sum, row) => sum + number(row.spend), 0);
  const formLeads = scopedInsights.reduce((sum, row) => sum + number(row.leads), 0);
  const conversations = Object.entries(conversationsByDate).reduce((sum, [date, value]) => sum + (inRange(date, from, to) ? number(value) : 0), 0);
  const leads = formLeads;
  const impressions = scopedInsights.reduce((sum, row) => sum + number(row.impressions), 0);
  const reach = scopedInsights.reduce((sum, row) => sum + number(row.reach), 0);
  const clicks = scopedInsights.reduce((sum, row) => sum + number(row.clicks), 0);
  const confirmedSales = scopedSales.filter((sale) => sale.status === "confirmed");
  const salesCount = confirmedSales.reduce((sum, sale) => sum + number(sale.quantity || 1), 0);
  const revenue = confirmedSales.reduce((sum, sale) => sum + number(sale.net_revenue), 0);
  return {
    spend: round(spend),
    formLeads: round(formLeads),
    conversations: round(conversations),
    leads: round(leads),
    impressions: round(impressions, 0),
    reach: round(reach, 0),
    clicks: round(clicks, 0),
    rd: scopedDeals.length,
    sales: round(salesCount, 0),
    revenue: round(revenue),
    cpl: leads > 0 ? round(spend / leads) : 0,
    cpc: clicks > 0 ? round(spend / clicks) : 0,
    ctr: impressions > 0 ? round((clicks / impressions) * 100) : 0,
    cpm: impressions > 0 ? round((spend / impressions) * 1000) : 0,
    conversionRate: clicks > 0 ? round((leads / clicks) * 100) : 0,
    cac: salesCount > 0 ? round(spend / salesCount) : 0,
    roas: spend > 0 ? round(revenue / spend) : 0,
    profit: round(revenue - spend),
    coverage: leads > 0 ? round((scopedDeals.length / leads) * 100) : 0,
  };
}

function monthPerformance(
  label: string,
  from: string,
  to: string,
  analysisTo: string,
  insights: PaidTrafficInsightRow[],
  deals: PaidTrafficDealRow[],
  sales: PaidTrafficSaleRow[],
  conversationsByDate: Record<string, number>,
): MonthlyPerformance {
  const dataDates = new Set<string>();
  insights.forEach((row) => { const date = dateOnly(row.date); if (inRange(date, from, to)) dataDates.add(date); });
  Object.keys(conversationsByDate).forEach((date) => { if (inRange(date, from, to)) dataDates.add(date); });
  return {
    label,
    from,
    to,
    daysInPeriod: daysBetween(from, to),
    daysWithData: dataDates.size,
    isPartial: to === analysisTo && to !== dateToString(endOfMonth(new Date(`${to}T12:00:00`))),
    metrics: calculateMetrics(insights, deals, sales, conversationsByDate, from, to),
  };
}

function weeklyPerformance(
  week: Date,
  currentMonthStart: string,
  analysisTo: string,
  insights: PaidTrafficInsightRow[],
  deals: PaidTrafficDealRow[],
  sales: PaidTrafficSaleRow[],
  conversationsByDate: Record<string, number>,
): WeeklyPerformance {
  const from = dateToString(week);
  const weekEnd = dateToString(addDays(week, 6));
  const to = weekEnd < analysisTo ? weekEnd : analysisTo;
  const metrics = calculateMetrics(insights, deals, sales, conversationsByDate, from, to);
  const days = new Set<string>();
  insights.forEach((row) => { const date = dateOnly(row.date); if (inRange(date, from, to)) days.add(date); });
  Object.keys(conversationsByDate).forEach((date) => { if (inRange(date, from, to)) days.add(date); });
  return {
    week: from,
    from,
    to,
    month: from >= currentMonthStart ? "current" : "previous",
    daysWithData: days.size,
    metrics,
  };
}

function recommendation(title: string, evidence: string, text: string, priority: InsightRecommendation["priority"] = "Média", steps?: string[]): InsightRecommendation {
  return { title, evidence, recommendation: text, priority, ...(steps?.length ? { steps } : {}) };
}

function buildRecommendations(current: MonthlyPerformance, previous: MonthlyPerformance, comparisons: MetricComparison[]) {
  const wins: InsightRecommendation[] = [];
  const risks: InsightRecommendation[] = [];
  const actions: InsightRecommendation[] = [];
  const change = (id: keyof PaidTrafficMetrics) => comparisons.find((item) => item.id === id);
  const cpl = change("cpl");
  const leads = change("leads");
  const ctr = change("ctr");
  const roas = change("roas");
  const revenue = change("revenue");
  const spend = change("spend");
  const conversations = change("conversations");

  if (!current.metrics.spend && !current.metrics.leads && !previous.metrics.spend && !previous.metrics.leads) {
    const evidence = "Não há investimento ou leads registrados nos dois meses analisados.";
    risks.push(recommendation("Dados insuficientes", evidence, "Confirme a sincronização da conta Meta e o intervalo de atribuição antes de tomar decisões.", "Alta"));
    actions.push(recommendation("Validar a origem dos dados", evidence, "Atualize a sincronização Meta, confirme a conta selecionada e revise o período; só depois reavalie campanhas.", "Alta", [
      "Atualize a sincronização da conta Meta e aguarde o último horário de sucesso.",
      "Confirme que a conta e o intervalo exibidos são os mesmos do relatório.",
      "Revise permissões, token e janela de atribuição se os dados continuarem vazios.",
      "Só tome decisões de orçamento depois que a amostra aparecer no painel.",
    ]));
    return { wins, risks, actions };
  }

  if (leads?.variationPercent != null && leads.variationPercent >= 5 && cpl?.assessment === "positive") {
    wins.push(recommendation("Mais volume com eficiência", `Leads totais subiram ${leads.variationPercent}% (${current.metrics.leads} contra ${previous.metrics.leads}) enquanto o CPL caiu para ${current.metrics.cpl.toFixed(2)}.`, "Preserve a estrutura vencedora e aumente orçamento apenas em ciclos de 10% a 20%, monitorando CPL por 3 dias.", "Alta"));
  } else if (leads?.variationPercent != null && leads.variationPercent >= 5) {
    wins.push(recommendation("Volume de leads em alta", `Leads totais cresceram ${leads.variationPercent}% (${current.metrics.leads} contra ${previous.metrics.leads}).`, "Identifique quais campanhas sustentaram o crescimento e valide se a qualidade no RD acompanhou o volume.", "Média"));
  }
  if (cpl?.assessment === "positive") wins.push(recommendation("Custo por lead melhorou", `CPL variou ${cpl.variationPercent ?? 0}% e está em ${current.metrics.cpl.toFixed(2)} no mês atual.`, "Concentre testes e orçamento nas campanhas com CPL abaixo da média atual.", "Média"));
  if (ctr?.assessment === "positive") wins.push(recommendation("Anúncios atraindo mais cliques", `CTR variou ${ctr.variationPercent ?? 0}% (${current.metrics.ctr.toFixed(2)}% no mês atual).`, "Documente os criativos ativos e replique os padrões em novos testes sem alterar todos os conjuntos ao mesmo tempo.", "Baixa"));
  if (roas?.assessment === "positive" && current.metrics.revenue > 0) wins.push(recommendation("Retorno atribuído em alta", `ROAS saiu de ${previous.metrics.roas.toFixed(2)}x para ${current.metrics.roas.toFixed(2)}x, com receita de ${current.metrics.revenue.toFixed(2)}.`, "Priorize as campanhas que geraram vendas confirmadas, mantendo uma janela de atribuição consistente.", "Alta"));
  if (conversations?.variationPercent != null && conversations.variationPercent >= 10) wins.push(recommendation("Conversas iniciadas cresceram", `O evento de conversa iniciou ${current.metrics.conversations} conversas, alta de ${conversations.variationPercent}%.`, "Separe conversas de forms/site no acompanhamento comercial e compare a taxa de avanço no RD.", "Média"));

  if (cpl?.assessment === "negative") risks.push(recommendation("CPL piorou", `CPL variou ${cpl.variationPercent ?? 0}% e chegou a ${current.metrics.cpl.toFixed(2)}.`, "Há pressão de custo; compare campanhas e conjuntos antes de ampliar orçamento.", "Alta"));
  if (leads?.assessment === "negative") risks.push(recommendation("Menos leads", `Leads totais caíram ${Math.abs(leads.variationPercent ?? 0)}% (${current.metrics.leads} contra ${previous.metrics.leads}).`, "Verifique entrega, criativos, orçamento e a passagem de leads/conversas para o RD.", "Alta"));
  if (ctr?.assessment === "negative") risks.push(recommendation("CTR em queda", `CTR caiu ${Math.abs(ctr.variationPercent ?? 0)}%, para ${current.metrics.ctr.toFixed(2)}%.`, "Priorize novos ângulos criativos e confirme se o CPM também subiu antes de atribuir fadiga.", "Média"));
  if (revenue?.assessment === "negative" && previous.metrics.revenue > 0) risks.push(recommendation("Receita atribuída caiu", `Receita foi de ${previous.metrics.revenue.toFixed(2)} para ${current.metrics.revenue.toFixed(2)}.`, "Revise o rastreamento de vendas, UTMs e a correspondência entre RD e conta Meta.", "Alta"));
  if (current.daysWithData < 3 || current.metrics.clicks < 20) risks.push(recommendation("Amostra ainda pequena", `O mês atual tem ${current.daysWithData} dia(s) com dados e ${current.metrics.clicks} cliques.`, "Evite pausar ou escalar por enquanto; acumule volume mínimo para uma leitura confiável.", "Alta"));

  if (spend && spend.variationPercent != null && spend.variationPercent > 10 && leads?.assessment === "negative") actions.push(recommendation("Revisar alocação de verba", `Investimento subiu ${spend.variationPercent}% enquanto os leads caíram ${Math.abs(leads.variationPercent ?? 0)}%.`, "Redistribua verba para campanhas com CPL e cobertura RD melhores; mantenha alterações graduais e auditáveis.", "Alta", [
    "Abra a aba Campanhas e ordene por CPL e cobertura RD.",
    "Compare os últimos 7 dias com os 7 dias anteriores para separar oscilação de tendência.",
    "Reduza no máximo 20% da verba dos conjuntos sem conversão comprovada.",
    "Aumente em ciclos de 10% a 20% somente nas campanhas com CPL menor e negócio RD criado.",
    "Acompanhe por 72 horas e registre a alteração no histórico antes de repetir o ajuste.",
  ]));
  if (current.metrics.conversations > 0 && current.metrics.rd === 0) actions.push(recommendation("Fechar o ciclo das conversas", `${current.metrics.conversations} conversas iniciadas foram registradas, mas nenhum negócio RD foi criado no período.`, "Revise webhook/UTM, fila de atendimento e o evento de criação de negócio para não perder atribuição.", "Alta", [
    "Teste uma conversa iniciada e confirme que o evento recebe UTMs e identificador da campanha.",
    "Verifique se o webhook está ativo e se o lead entra na fila comercial correta.",
    "Crie um negócio de teste no RD e confira a associação com a origem Meta.",
    "Corrija duplicidades ou falhas de permissão e faça uma nova sincronização.",
    "Monitore a cobertura RD diariamente até voltar a registrar negócios.",
  ]));
  if (current.metrics.sales === 0 && current.metrics.leads > 0) actions.push(recommendation("Acompanhar qualidade até a venda", `${current.metrics.leads} leads foram gerados, mas não há vendas confirmadas no mês atual.`, "Compare estágios do RD, tempo médio de fechamento e vendedor responsável antes de mexer no orçamento.", "Média", [
    "Filtre os leads do período por estágio e vendedor responsável no CRM.",
    "Identifique onde o maior volume está parado e defina um próximo contato.",
    "Compare tempo médio de fechamento e taxa de avanço por vendedor.",
    "Ajuste script, oferta ou follow-up antes de aumentar investimento.",
    "Reavalie vendas e CAC depois de uma nova janela de 7 dias.",
  ]));
  if (!actions.length) actions.push(recommendation("Manter monitoramento semanal", `O mês atual tem ${current.metrics.leads} leads e ${current.metrics.spend.toFixed(2)} investidos.`, "Compare semanalmente CPL, conversas, negócios RD e vendas; registre cada mudança de orçamento ou criativo.", "Baixa", [
    "Toda segunda-feira, compare CPL, conversas, negócios RD, vendas e ROAS.",
    "Ordene campanhas e criativos pelo resultado antes de alterar qualquer orçamento.",
    "Registre a hipótese e a mudança no histórico da conta.",
    "Aguarde pelo menos 72 horas antes de concluir se o ajuste funcionou.",
  ]));
  return { wins: wins.slice(0, 4), risks: risks.slice(0, 4), actions: actions.slice(0, 5) };
}

export function buildTwoMonthAnalysis({
  analysisFrom,
  analysisTo,
  insights,
  deals,
  sales,
  conversationsByDate,
}: {
  analysisFrom: Date;
  analysisTo: Date;
  insights: PaidTrafficInsightRow[];
  deals: PaidTrafficDealRow[];
  sales: PaidTrafficSaleRow[];
  conversationsByDate?: Record<string, number>;
}): TwoMonthAnalysis {
  const fromDate = startOfMonth(analysisFrom);
  const endDate = analysisTo;
  const currentStart = startOfMonth(endDate);
  const previousStart = startOfMonth(subMonths(endDate, 1));
  const previousEnd = endOfMonth(previousStart);
  const from = dateToString(fromDate);
  const to = dateToString(endDate);
  const currentFrom = dateToString(currentStart);
  const currentTo = to;
  const previousFrom = dateToString(previousStart);
  const previousTo = dateToString(previousEnd);
  const conversations = conversationsByDate || {};
  const currentMonth = monthPerformance("Mês atual", currentFrom, currentTo, to, insights, deals, sales, conversations);
  const previousMonth = monthPerformance("Mês anterior", previousFrom, previousTo, to, insights, deals, sales, conversations);
  const metricComparisons = comparisonMetrics.map(({ id, label, lowerIsBetter = false }) => {
    const current = currentMonth.metrics[id];
    const previous = previousMonth.metrics[id];
    const variationPercent = percentChange(current, previous);
    const meaningful = variationPercent != null && Math.abs(variationPercent) >= 1;
    const improved = meaningful ? (lowerIsBetter ? variationPercent! < 0 : variationPercent! > 0) : false;
    const worsened = meaningful ? (lowerIsBetter ? variationPercent! > 0 : variationPercent! < 0) : false;
    const assessment: MetricComparison["assessment"] = variationPercent == null ? "unknown" : improved ? "positive" : worsened ? "negative" : "neutral";
    return { id, label, current, previous, variationPercent, lowerIsBetter, assessment };
  });
  const firstWeek = startOfWeek(new Date(`${from}T12:00:00`), { weekStartsOn: 1 });
  const lastWeek = startOfWeek(new Date(`${to}T12:00:00`), { weekStartsOn: 1 });
  const weeks: WeeklyPerformance[] = [];
  for (let week = firstWeek; week <= lastWeek; week = addDays(week, 7)) {
    const row = weeklyPerformance(week, currentFrom, to, insights, deals, sales, conversations);
    if (row.metrics.spend || row.metrics.leads || row.metrics.rd || row.metrics.sales || row.metrics.conversations) weeks.push(row);
  }
  const recommendations = buildRecommendations(currentMonth, previousMonth, metricComparisons);
  return { analysisFrom: from, analysisTo: to, currentMonth, previousMonth, metricComparisons, weeklyComparison: weeks, ...recommendations };
}

export function formatAnalysisDate(value: string) {
  return format(new Date(`${value}T12:00:00`), "dd/MM/yyyy");
}
