export type AdAccount = {
  id: string;
  name: string;
  platform: "Meta Ads" | "Google Ads";
  brand: string;
  dailyBudget: number;
  spentToday: number;
  remainingBalance: number;
  campaigns: number;
  status: "Ativa" | "Atenção";
};

export type Campaign = {
  id: string;
  accountId: string;
  name: string;
  platform: "Meta" | "Google";
  objective: string;
  status: "Ativa" | "Pausada" | "Aprendizado";
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
  roas: number;
};

export const adAccounts: AdAccount[] = [
  {
    id: "vida-leve",
    name: "CA · VIDALEVE · PRINCIPAL",
    platform: "Meta Ads",
    brand: "Vida Leve",
    dailyBudget: 5200,
    spentToday: 4317.84,
    remainingBalance: 28740,
    campaigns: 12,
    status: "Ativa",
  },
  {
    id: "growdash-scale",
    name: "BM · GROWDASH · SCALE",
    platform: "Meta Ads",
    brand: "Growdash",
    dailyBudget: 2800,
    spentToday: 1946.12,
    remainingBalance: 16480,
    campaigns: 8,
    status: "Ativa",
  },
  {
    id: "vida-leve-search",
    name: "VIDALEVE · SEARCH & YOUTUBE",
    platform: "Google Ads",
    brand: "Vida Leve",
    dailyBudget: 1600,
    spentToday: 1288.9,
    remainingBalance: 9120,
    campaigns: 5,
    status: "Atenção",
  },
];

export const campaigns: Campaign[] = [
  { id: "c1", accountId: "vida-leve", name: "[VL] [ONGOING] [TRÁFEGO PERFIL]", platform: "Meta", objective: "Tráfego", status: "Ativa", budget: 500, spend: 85.43, impressions: 9680, clicks: 151, leads: 34, cpl: 2.51, ctr: 1.56, roas: 7.8 },
  { id: "c2", accountId: "vida-leve", name: "[VL] [CONVERSÃO] [CAPTAÇÃO 07]", platform: "Meta", objective: "Leads", status: "Ativa", budget: 1400, spend: 1187.2, impressions: 74290, clicks: 1842, leads: 286, cpl: 4.15, ctr: 2.48, roas: 6.4 },
  { id: "c3", accountId: "vida-leve", name: "[VL] [REMARKETING] [30D]", platform: "Meta", objective: "Vendas", status: "Aprendizado", budget: 800, spend: 624.11, impressions: 28940, clicks: 706, leads: 98, cpl: 6.37, ctr: 2.44, roas: 5.2 },
  { id: "c4", accountId: "growdash-scale", name: "[GD] [DEMO] [GESTORES]", platform: "Meta", objective: "Leads", status: "Ativa", budget: 950, spend: 748.9, impressions: 38840, clicks: 932, leads: 124, cpl: 6.04, ctr: 2.4, roas: 4.9 },
  { id: "c5", accountId: "growdash-scale", name: "[GD] [FUNDO] [TRIAL]", platform: "Meta", objective: "Vendas", status: "Pausada", budget: 650, spend: 289.5, impressions: 15120, clicks: 307, leads: 41, cpl: 7.06, ctr: 2.03, roas: 3.8 },
  { id: "c6", accountId: "vida-leve-search", name: "Pesquisa · Curso Vida Leve", platform: "Google", objective: "Conversões", status: "Ativa", budget: 900, spend: 744.3, impressions: 12460, clicks: 1098, leads: 174, cpl: 4.28, ctr: 8.81, roas: 8.1 },
];

export const rdStages = [
  { label: "Novos leads", deals: 486, revenue: 0, color: "#d8b647" },
  { label: "Contato iniciado", deals: 218, revenue: 148000, color: "#c49624" },
  { label: "Oportunidade", deals: 96, revenue: 276000, color: "#9d7418" },
  { label: "Proposta enviada", deals: 41, revenue: 192500, color: "#725211" },
  { label: "Venda", deals: 28, revenue: 126400, color: "#3f7c52" },
];

export const attributionRows = [
  { account: "CA · VIDALEVE · PRINCIPAL", platform: "Meta Ads", spend: 43892, leads: 892, deals: 31, revenue: 184300, roas: 4.2 },
  { account: "BM · GROWDASH · SCALE", platform: "Meta Ads", spend: 18640, leads: 318, deals: 14, revenue: 92700, roas: 4.97 },
  { account: "VIDALEVE · SEARCH & YOUTUBE", platform: "Google Ads", spend: 12780, leads: 246, deals: 11, revenue: 74800, roas: 5.85 },
];

export const integrations = [
  { id: "meta", name: "Meta Ads", description: "Contas de anúncio, campanhas, conjuntos, anúncios, insights e saldo.", status: "Conectado", synced: "há 4 min", accounts: "2 contas" },
  { id: "rd", name: "RD Station CRM", description: "Funis, etapas, negociações, vendas, receita e origem dos leads.", status: "Conectado", synced: "há 7 min", accounts: "3 funis" },
  { id: "google-ads", name: "Google Ads", description: "Campanhas de pesquisa, display, vídeo, conversões e orçamento.", status: "Atenção", synced: "há 2h", accounts: "1 conta" },
  { id: "drive", name: "Google Drive", description: "Arquivos, relatórios exportados e materiais compartilhados por marca.", status: "Disponível", synced: "não conectado", accounts: "—" },
];

export const brands = [
  { name: "Vida Leve", domain: "vidaleve.com.br", accounts: 2, funnels: 2, revenue: "R$ 259 mil", status: "Ativa" },
  { name: "Growdash", domain: "growdash.com.br", accounts: 1, funnels: 1, revenue: "R$ 92 mil", status: "Ativa" },
  { name: "Projeto Aurora", domain: "aurora.digital", accounts: 0, funnels: 0, revenue: "R$ 0", status: "Configuração" },
];

export const users = [
  { name: "Thiego Jesus", email: "thiego@growdash.com.br", role: "Proprietário", access: "Todas as marcas", lastSeen: "Agora" },
  { name: "Marina Costa", email: "marina@growdash.com.br", role: "Gestora de tráfego", access: "Vida Leve", lastSeen: "há 18 min" },
  { name: "Rafael Lima", email: "rafael@growdash.com.br", role: "Comercial", access: "Vida Leve", lastSeen: "há 1h" },
];

export const agents = [
  { name: "Analista de Mídia", purpose: "Monitora CPL, CTR, frequência e orçamento das campanhas.", status: "Ativo", executions: 284 },
  { name: "Guardião do Funil", purpose: "Cruza Meta/Google com etapas e vendas do RD Station.", status: "Ativo", executions: 146 },
  { name: "Resumo Executivo", purpose: "Prepara o diagnóstico diário de receita, mídia e operação.", status: "Ativo", executions: 92 },
];
