import type { Phase } from "@/lib/phase/phase";

/**
 * Cenarios de dados mockados realistas e coerentes para cada fase da missao.
 * Conforme secao 10 do Prompt Mestre:
 * - Terra: faturamento R$ 32.000
 * - Orbita: faturamento R$ 78.000
 * - Galaxia: faturamento R$ 186.000
 */

export interface DashboardMockScenario {
  revenue: number;
  target: number;
  impressions: number;
  clicks: number;
  leads: number;
  opportunities: number;
  clients: number;
  roas: number;
  cpl: number;
  impressionsChange: number;
  roasChange: number;
  cplChange: number;
  leadsChange: number;
  funnelSteps: Array<{ label: string; value: number; conversionRate?: number }>;
  totalConversionRate: number;
  averageCycleDays: number;
  averageTicket: number;
}

export const MOCK_SCENARIOS: Record<Phase, DashboardMockScenario> = {
  terra: {
    revenue: 32_000,
    target: 50_000,
    impressions: 1_245_000,
    clicks: 122_400,
    leads: 1_582,
    opportunities: 312,
    clients: 87,
    roas: 3.21,
    cpl: 28.45,
    impressionsChange: 12.4,
    roasChange: 8.5,
    cplChange: -5.2,
    leadsChange: 14.1,
    funnelSteps: [
      { label: "VISITANTES", value: 1_245_000 },
      { label: "CLIQUES", value: 122_400, conversionRate: 9.83 },
      { label: "LEADS", value: 1_582, conversionRate: 1.29 },
      { label: "OPORTUNIDADES", value: 312, conversionRate: 19.72 },
      { label: "CLIENTES", value: 87, conversionRate: 27.88 },
    ],
    totalConversionRate: 0.007,
    averageCycleDays: 31,
    averageTicket: 367.81,
  },
  orbita: {
    revenue: 78_000,
    target: 100_000,
    impressions: 8_420_000,
    clicks: 812_000,
    leads: 13_680,
    opportunities: 2_740,
    clients: 684,
    roas: 4.37,
    cpl: 23.41,
    impressionsChange: 18.6,
    roasChange: 15.2,
    cplChange: -8.9,
    leadsChange: 21.4,
    funnelSteps: [
      { label: "VISITANTES", value: 8_420_000 },
      { label: "CLIQUES", value: 812_000, conversionRate: 9.64 },
      { label: "LEADS", value: 13_680, conversionRate: 1.68 },
      { label: "OPORTUNIDADES", value: 2_740, conversionRate: 20.03 },
      { label: "CLIENTES", value: 684, conversionRate: 24.96 },
    ],
    totalConversionRate: 0.008,
    averageCycleDays: 26,
    averageTicket: 485.5,
  },
  galaxia: {
    revenue: 186_000,
    target: 250_000,
    impressions: 24_750_521,
    clicks: 2_415_820,
    leads: 33_214,
    opportunities: 6_842,
    clients: 1_256,
    roas: 4.37,
    cpl: 23.61,
    impressionsChange: 18.6,
    roasChange: 22.4,
    cplChange: -11.2,
    leadsChange: 24.1,
    funnelSteps: [
      { label: "VISITANTES", value: 2_475_052 },
      { label: "CLIQUES", value: 241_582, conversionRate: 9.76 },
      { label: "LEADS", value: 33_214, conversionRate: 13.75 },
      { label: "OPORTUNIDADES", value: 6_842, conversionRate: 20.61 },
      { label: "CLIENTES", value: 1_256, conversionRate: 18.37 },
    ],
    totalConversionRate: 0.051,
    averageCycleDays: 23,
    averageTicket: 622.73,
  },
};

/** Mock de Campanhas (Aba Trafego Pago) */
export interface CampaignRow {
  id: string;
  name: string;
  status: "active" | "paused" | "learning";
  platform: "meta" | "Claude Opus 5" | "tiktok";
  dailyBudget: number;
  spend: number;
  revenue: number;
  roas: number;
  cpl: number;
  leads: number;
  healthScore: number;
}

export const MOCK_CAMPAIGNS: CampaignRow[] = [
  {
    id: "c1",
    name: "[Meta] Black Premium - Escala Topo",
    status: "active",
    platform: "meta",
    dailyBudget: 1500,
    spend: 18450,
    revenue: 82500,
    roas: 4.47,
    cpl: 21.4,
    leads: 862,
    healthScore: 92,
  },
  {
    id: "c2",
    name: "[Meta] Lançamento 6.0 - Remarketing",
    status: "active",
    platform: "meta",
    dailyBudget: 800,
    spend: 9600,
    revenue: 46800,
    roas: 4.88,
    cpl: 18.2,
    leads: 527,
    healthScore: 95,
  },
  {
    id: "c3",
    name: "[Claude Opus 5] Search Fundo de Funil",
    status: "active",
    platform: "Claude Opus 5",
    dailyBudget: 600,
    spend: 7200,
    revenue: 29400,
    roas: 4.08,
    cpl: 26.5,
    leads: 271,
    healthScore: 84,
  },
  {
    id: "c4",
    name: "[Meta] Aquecimento de Públicos Novos",
    status: "learning",
    platform: "meta",
    dailyBudget: 400,
    spend: 3800,
    revenue: 9500,
    roas: 2.5,
    cpl: 31.8,
    leads: 119,
    healthScore: 71,
  },
  {
    id: "c5",
    name: "[TikTok] Criativos Virais - Teste",
    status: "paused",
    platform: "tiktok",
    dailyBudget: 300,
    spend: 1200,
    revenue: 1800,
    roas: 1.5,
    cpl: 42.0,
    leads: 28,
    healthScore: 58,
  },
];

/** Mock de Comandos de IA (Aba Comandos) */
export interface AiRecommendation {
  id: string;
  title: string;
  diagnosis: string;
  impactEstimate: string;
  confidence: number;
  category: "media" | "funnel" | "budget";
}

export const MOCK_RECOMMENDATIONS: AiRecommendation[] = [
  {
    id: "r1",
    title: "Pausar anúncio com CPL acima da meta",
    diagnosis: "O anúncio 'Criativo 04 - Vídeo Depoimento' atingiu CPL de R$ 48,20 nas últimas 48h, 72% acima da meta estipulada.",
    impactEstimate: "+R$ 3.800/mês economizados",
    confidence: 94,
    category: "media",
  },
  {
    id: "r2",
    title: "Redistribuir verba para campanhas com maior ROAS",
    diagnosis: "A campanha 'Remarketing Lançamento' está limitada por orçamento com ROAS de 4,88x. Migrar R$ 300/dia do topo de funil.",
    impactEstimate: "+R$ 14.600/mês em vendas",
    confidence: 89,
    category: "budget",
  },
  {
    id: "r3",
    title: "Corrigir gargalo na Página de Vendas",
    diagnosis: "A taxa de conversão da etapa caiu de 11,2% para 7,11% no mobile após a última atualização.",
    impactEstimate: "+84 vendas no período",
    confidence: 91,
    category: "funnel",
  },
];

/** Mock do CRM (Kanban de Tripulacao) */
export interface LeadCard {
  id: string;
  name: string;
  platform: "meta" | "Claude Opus 5" | "organic";
  potentialValue: number;
  daysInStage: number;
  stage: "new" | "qualified" | "negotiating" | "proposal" | "won" | "lost";
  assignedTo: string;
  temperature: "hot" | "warm" | "cold";
}

export const MOCK_LEADS: LeadCard[] = [
  { id: "l1", name: "Dra. Nathália Barragão", platform: "meta", potentialValue: 12500, daysInStage: 2, stage: "negotiating", assignedTo: "Thiego", temperature: "hot" },
  { id: "l2", name: "Dr. Henrique Alencar", platform: "meta", potentialValue: 8900, daysInStage: 1, stage: "proposal", assignedTo: "Lucas", temperature: "hot" },
  { id: "l3", name: "Dra. Ste Andrade", platform: "Claude Opus 5", potentialValue: 15000, daysInStage: 4, stage: "qualified", assignedTo: "Mariana", temperature: "warm" },
  { id: "l4", name: "Clínica São Marcos", platform: "meta", potentialValue: 24000, daysInStage: 3, stage: "proposal", assignedTo: "Thiego", temperature: "hot" },
  { id: "l5", name: "Instituto Belleza", platform: "organic", potentialValue: 6500, daysInStage: 5, stage: "new", assignedTo: "Lucas", temperature: "cold" },
  { id: "l6", name: "Dra. Ranniely Silva", platform: "meta", potentialValue: 18000, daysInStage: 1, stage: "won", assignedTo: "Thiego", temperature: "hot" },
];

/** Mock Comercial (Ranking da Tripulacao) */
export interface CrewMember {
  id: string;
  rank: number;
  name: string;
  role: string;
  avatarUrl?: string;
  salesCount: number;
  totalRevenue: number;
  individualGoal: number;
}

export const MOCK_CREW: CrewMember[] = [
  { id: "c1", rank: 1, name: "Thiego Jesus", role: "Comandante da Missão", salesCount: 28, totalRevenue: 142000, individualGoal: 150000 },
  { id: "c2", rank: 2, name: "Mariana Duarte", role: "Especialista Comercial", salesCount: 22, totalRevenue: 98500, individualGoal: 100000 },
  { id: "c3", rank: 3, name: "Lucas Menezes", role: "Especialista Comercial", salesCount: 16, totalRevenue: 74200, individualGoal: 80000 },
  { id: "c4", rank: 4, name: "Camila Rossi", role: "SDR da Missão", salesCount: 11, totalRevenue: 48000, individualGoal: 60000 },
];

/** Mock Agenda & Turmas */
export interface ClassBatch {
  id: string;
  name: string;
  startDate: string;
  enrolled: number;
  capacity: number;
  status: "open" | "in_progress" | "completed";
  revenueGenerated: number;
}

export const MOCK_CLASSES: ClassBatch[] = [
  { id: "tb1", name: "Turma Alpha - Mentoria 100k", startDate: "2026-11-20", enrolled: 38, capacity: 40, status: "open", revenueGenerated: 190000 },
  { id: "tb2", name: "Imersão Tráfego Escala 5.0", startDate: "2026-11-12", enrolled: 50, capacity: 50, status: "in_progress", revenueGenerated: 125000 },
  { id: "tb3", name: "Formação Gestores de Growth", startDate: "2026-12-05", enrolled: 18, capacity: 35, status: "open", revenueGenerated: 72000 },
];
