// Catalog of dashboard widget types. Used by the renderer, manual editor and AI builder.

export type WidgetMetric =
  | "spend"
  | "leads"
  | "cpl"
  | "ctr"
  | "cpm"
  | "clicks"
  | "impressions"
  | "frequency"
  | "conversion_rate"
  | "revenue_net"
  | "revenue_gross"
  | "roas"
  | "roi"
  | "profit"
  | "sales_count";

export type WidgetGroupBy = "date" | "campaign" | "ad" | "state" | "formation" | "product" | "payment";

export interface WidgetConfig {
  metric?: WidgetMetric;
  metrics?: WidgetMetric[];
  groupBy?: WidgetGroupBy;
  orientation?: "vertical" | "horizontal";
  variant?: "pie" | "donut";
  limit?: number;
  direction?: "top" | "worst";
  source?: "campaigns" | "ads" | "sales";
  comparePeriod?: boolean;
  text?: string;
  hidePrimary?: boolean;
  individualized?: boolean;
}

export type WidgetType =
  | "kpi"
  | "kpi_grid"
  | "line_chart"
  | "bar_chart"
  | "pie_chart"
  | "table"
  | "funnel"
  | "brazil_map"
  | "alerts"
  | "campaign_changes"
  | "budget_bm"
  | "campaigns_detail"
  | "compare_period"
  | "top_ranking"
  | "rd_sales_list"
  | "attribution"
  | "ask_ai"
  | "best_period_of_day"
  | "best_weekday"
  | "geo_origin"
  | "rd_custom_field_pie"
  | "default_block";


export interface WidgetDef {
  type: WidgetType;
  title: string;
  category: "KPI" | "Gráfico" | "Tabela" | "Análise" | "Sistema";
  description: string;
  defaultLayout: { w: number; h: number; minW: number; minH: number };
  defaultConfig: WidgetConfig;
  // System widgets cannot be removed/configured by user
  system?: boolean;
}

export const METRIC_LABELS: Record<WidgetMetric, string> = {
  spend: "Investimento",
  leads: "Leads",
  cpl: "CPL",
  ctr: "CTR",
  cpm: "CPM",
  clicks: "Cliques",
  impressions: "Impressões",
  frequency: "Frequência",
  conversion_rate: "Conversão",
  revenue_net: "Faturamento Líquido",
  revenue_gross: "Faturamento Bruto",
  roas: "ROAS",
  roi: "ROI",
  profit: "Lucro",
  sales_count: "Nº Vendas",
};

export const WIDGET_CATALOG: WidgetDef[] = [
  {
    type: "kpi",
    title: "KPI",
    category: "KPI",
    description: "Card de métrica única",
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    defaultConfig: { metric: "leads", comparePeriod: false },
  },
  {
    type: "kpi_grid",
    title: "Grade de KPIs",
    category: "KPI",
    description: "Vários KPIs lado a lado",
    defaultLayout: { w: 12, h: 2, minW: 4, minH: 2 },
    defaultConfig: { metrics: ["spend", "leads", "cpl", "ctr"] },
  },
  {
    type: "line_chart",
    title: "Gráfico de Linha",
    category: "Gráfico",
    description: "Evolução temporal",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultConfig: { metric: "cpl", groupBy: "date" },
  },
  {
    type: "bar_chart",
    title: "Gráfico de Barras",
    category: "Gráfico",
    description: "Comparativo de barras",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultConfig: { metric: "spend", groupBy: "date", orientation: "vertical" },
  },
  {
    type: "pie_chart",
    title: "Pizza / Donut",
    category: "Gráfico",
    description: "Distribuição por categoria",
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    defaultConfig: { metric: "leads", groupBy: "campaign", variant: "donut" },
  },
  {
    type: "top_ranking",
    title: "Top / Pior Ranking",
    category: "Análise",
    description: "Top N por métrica",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultConfig: { metric: "leads", groupBy: "ad", direction: "top", limit: 5 },
  },
  {
    type: "compare_period",
    title: "Comparativo de Período",
    category: "Análise",
    description: "Métrica vs período anterior",
    defaultLayout: { w: 4, h: 2, minW: 3, minH: 2 },
    defaultConfig: { metric: "cpl" },
  },
  {
    type: "table",
    title: "Tabela",
    category: "Tabela",
    description: "Lista detalhada",
    defaultLayout: { w: 12, h: 5, minW: 4, minH: 3 },
    defaultConfig: { source: "campaigns" },
  },
  {
    type: "funnel",
    title: "Funil",
    category: "Análise",
    description: "Impressões → Clicks → Leads → Vendas",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultConfig: {},
  },
  {
    type: "brazil_map",
    title: "Mapa do Brasil",
    category: "Análise",
    description: "Leads por estado",
    defaultLayout: { w: 6, h: 5, minW: 4, minH: 4 },
    defaultConfig: {},
  },
  {
    type: "alerts",
    title: "Alertas",
    category: "Análise",
    description: "Alertas e diagnósticos",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultConfig: {},
  },
  {
    type: "campaign_changes",
    title: "Mudanças de Campanha",
    category: "Análise",
    description: "Histórico de alterações",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    defaultConfig: {},
  },
  {
    type: "best_period_of_day",
    title: "Melhor Período do Dia (Manhã/Tarde/Noite)",
    category: "Gráfico",
    description: "Donut + linha por hora com base nas conversões reais do Meta",
    defaultLayout: { w: 12, h: 5, minW: 6, minH: 4 },
    defaultConfig: {},
  },
  {
    type: "best_weekday",
    title: "Dias da Semana que Mais Convertem",
    category: "Gráfico",
    description: "Barras agregadas Seg→Dom no período selecionado",
    defaultLayout: { w: 12, h: 4, minW: 4, minH: 3 },
    defaultConfig: {},
  },
  {
    type: "geo_origin",
    title: "Origem geográfica (mapa)",
    category: "Análise",
    description: "Mapa do Brasil + tabela com leads/CPL/CPA por estado, alternando entre Leads e Vendas",
    defaultLayout: { w: 12, h: 10, minW: 8, minH: 8 },
    defaultConfig: {},
  },
  {
    type: "rd_sales_list",
    title: "Vendas RD",
    category: "Tabela",
    description: "Lista de vendas vindas do RD Station CRM no período",
    defaultLayout: { w: 12, h: 6, minW: 6, minH: 4 },
    defaultConfig: {},
  },
  {
    type: "attribution",
    title: "Atribuição por campanha (multi-touch)",
    category: "Análise",
    description: "Crédito de vendas por campanha nos modelos First / Last / Linear, usando histórico de UTMs dos deals do RD",
    defaultLayout: { w: 12, h: 6, minW: 6, minH: 4 },
    defaultConfig: {},
  },
  {
    type: "rd_custom_field_pie",
    title: "Campo personalizado do RD (pizza)",
    category: "Gráfico",
    description: "Distribuição de leads/vendas por campo personalizado configurado no RD (ex.: Faturamento)",
    defaultLayout: { w: 8, h: 5, minW: 4, minH: 4 },
    defaultConfig: {},
  },

  // System widgets — sempre presentes
  {
    type: "budget_bm",
    title: "Análise de Orçamento (Conta)",
    category: "Sistema",
    description: "Sempre presente — mostra todas as contas ou só a selecionada",
    defaultLayout: { w: 12, h: 5, minW: 6, minH: 3 },
    defaultConfig: {},
    system: true,
  },
  {
    type: "ask_ai",
    title: "Pergunte à IA",
    category: "Sistema",
    description: "Sempre presente",
    defaultLayout: { w: 12, h: 4, minW: 6, minH: 3 },
    defaultConfig: {},
    system: true,
  },
  {
    type: "campaigns_detail",
    title: "Resultados Campanhas e Criativos",
    category: "Sistema",
    description: "Sempre presente — campanhas/criativos com vendas atribuídas via UTMs",
    defaultLayout: { w: 12, h: 6, minW: 6, minH: 4 },
    defaultConfig: {},
    system: true,
  },
  {
    type: "default_block",
    title: "Visualização Padrão",
    category: "Sistema",
    description: "Bloco com todo o conteúdo da dashboard padrão",
    defaultLayout: { w: 12, h: 30, minW: 12, minH: 10 },
    defaultConfig: {},
    system: true,
  },
];

export function getWidgetDef(type: WidgetType) {
  return WIDGET_CATALOG.find((w) => w.type === type);
}

// Default "Padrão" view: a single full-width block that renders the legacy dashboard.
// AskAI + budget_bm + campaigns_detail are always appended by the renderer.
export const DEFAULT_VIEW = {
  name: "Padrão",
  layout: [
    { i: "primary-revenue", x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "primary-spend", x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "primary-roas", x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "primary-profit", x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "default", x: 0, y: 2, w: 12, h: 30, minW: 6, minH: 10 },
  ],
  widgets: [
    { id: "primary-revenue", type: "kpi" as WidgetType, title: "Faturamento Líquido", config: { metric: "revenue_net" } },
    { id: "primary-spend", type: "kpi" as WidgetType, title: "Gastos com Anúncios", config: { metric: "spend" } },
    { id: "primary-roas", type: "kpi" as WidgetType, title: "ROAS", config: { metric: "roas" } },
    { id: "primary-profit", type: "kpi" as WidgetType, title: "Lucro Líquido", config: { metric: "profit" } },
    { id: "default", type: "default_block" as WidgetType, title: "Padrão", config: { hidePrimary: true, individualized: true } },
  ],
};
