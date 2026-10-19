import type { InsightRow } from "@/hooks/useInsights";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { Sale } from "@/hooks/useSales";

// Public area ids used by the Growdash operating map. The legacy ids remain
// accepted by the summary builder so saved dashboards and older tests keep
// their meaning while the visual hub uses the ten canonical rooms.
export type CoreAreaId =
  | "strategy" | "research" | "traffic" | "creative" | "social" | "sales" | "analytics" | "finance" | "legal" | "inbox"
  | "crm" | "commercial" | "brand" | "automations";

export type CoreAccountInput = {
  id: string;
  name: string;
  target_cpl?: number | null;
};

export type CoreSchedule = {
  id: string;
  ad_account_id: string | null;
  name: string;
  enabled: boolean;
  next_run_at: string | null;
  last_status: string | null;
};

export type CoreAgentConfig = {
  id: string;
  ad_account_id: string | null;
  specialty: string;
  objective: string | null;
  status: string;
  last_run_at: string | null;
};

export type CoreAccountSummary = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  deals: number;
  cpl: number;
  ctr: number;
  revenue: number;
  sales: number;
  wonDeals: number;
  pipeline: number;
  ticket: number;
  roas: number;
  activeCampaigns: number;
  topCampaign: string | null;
  topObjective: string | null;
  topSeller: string | null;
  schedules: number;
  activeSchedules: number;
  strategy: string;
  strategyDetail: string;
  health: "healthy" | "attention" | "critical" | "no-data";
};

export type CoreSummaryInput = {
  accounts: CoreAccountInput[];
  insights?: InsightRow[];
  deals?: RDDealLite[];
  sales?: Sale[];
  schedules?: CoreSchedule[];
  agentConfigs?: CoreAgentConfig[];
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const objectiveLabels: Record<string, string> = {
  OUTCOME_LEADS: "Geração de leads",
  OUTCOME_SALES: "Conversões e vendas",
  OUTCOME_TRAFFIC: "Aquisição de tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_AWARENESS: "Reconhecimento",
  LEAD_GENERATION: "Geração de leads",
  CONVERSIONS: "Conversões e vendas",
  TRAFFIC: "Aquisição de tráfego",
  ENGAGEMENT: "Engajamento",
  BRAND_AWARENESS: "Reconhecimento",
};

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function objectiveLabel(value: string | null | undefined) {
  if (!value) return null;
  return objectiveLabels[value.toUpperCase()] || value.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
}

function healthFor(spend: number, leads: number, cpl: number, targetCpl: number) : CoreAccountSummary["health"] {
  if (spend === 0 && leads === 0) return "no-data";
  if (leads === 0 && spend >= Math.max(50, targetCpl)) return "critical";
  if (leads > 0 && targetCpl > 0 && cpl > targetCpl * 1.4) return "attention";
  return "healthy";
}

function inferStrategy(args: {
  area: CoreAreaId;
  spend: number;
  impressions: number;
  leads: number;
  cpl: number;
  targetCpl: number;
  revenue: number;
  activeCampaigns: number;
  topCampaign: string | null;
  topObjective: string | null;
  wonDeals: number;
  deals: number;
  activeSchedules: number;
  topSeller: string | null;
  agentConfigs: CoreAgentConfig[];
}) {
  const configured = args.agentConfigs.find((config) => config.objective)?.objective;
  const configuredLabel = objectiveLabel(configured);
  if (args.area === "traffic") {
    if (args.spend > 0 && args.leads === 0) return { title: "Recuperação de conversão", detail: `${brl.format(args.spend)} investidos sem lead no período; revisar criativo, evento e página antes de escalar.` };
    if (args.leads > 0 && args.targetCpl > 0 && args.cpl > args.targetCpl * 1.4) return { title: "Otimização de CPL", detail: `CPL de ${brl.format(args.cpl)} acima do alvo de ${brl.format(args.targetCpl)}; priorizar os conjuntos com melhor custo.` };
    return { title: configuredLabel || (args.revenue > 0 ? "Escala orientada a vendas" : "Aquisição e testes"), detail: args.topCampaign ? `Campanha líder: ${args.topCampaign}${args.topObjective ? ` · objetivo ${args.topObjective}` : ""}.` : "Sem campanha com dados suficientes para recomendar escala." };
  }
  if (args.area === "crm" || args.area === "sales") return { title: args.wonDeals > 0 ? "Follow-up de oportunidades quentes" : "Qualificação de pipeline", detail: `${args.wonDeals} negócio(s) ganho(s) em ${args.deals} negócio(s) monitorado(s); priorizar próximos estágios e follow-ups.` };
  if (args.area === "commercial") return { title: args.topSeller ? `Acelerar ${args.topSeller}` : "Playbook de vendas", detail: args.revenue > 0 ? `${brl.format(args.revenue)} em receita confirmada; comparar vendedores e replicar o melhor argumento.` : "Ainda não há venda confirmada para comparar vendedores." };
  if (args.area === "strategy") return { title: "Prioridades do ciclo", detail: args.revenue > args.spend ? "Receita confirmada supera a mídia no período; consolidar a prioridade e encaminhar o próximo ciclo aos gestores." : "Consolidar mídia, pipeline e receita antes de decidir a próxima prioridade." };
  if (args.area === "research") return { title: "Pesquisa orientada a sinais", detail: args.topCampaign ? `Usar ${args.topCampaign} como referência de mensagem e cruzar com demanda e conversão antes de abrir novos testes.` : "Ainda não há campanha com dados suficientes para orientar o benchmark." };
  if (args.area === "creative") return { title: "Criativos para o próximo teste", detail: args.topCampaign ? `A campanha ${args.topCampaign} concentra o maior investimento; extrair hipóteses de mensagem e validar novas variações.` : "Sem exposição suficiente para priorizar uma hipótese criativa." };
  if (args.area === "social") return { title: "Conteúdo conectado à demanda", detail: args.impressions > 0 ? `Usar os sinais de alcance e CTR do período para organizar pautas que reforcem a mensagem com maior exposição.` : "Sem sinais de mídia para recomendar uma pauta conectada à operação." };
  if (args.area === "analytics") return { title: "Leitura executiva", detail: `${args.deals} negócio(s), ${args.leads} lead(s) e ${brl.format(args.revenue)} de receita confirmada no escopo; validar a origem antes de concluir o diagnóstico.` };
  if (args.area === "legal") return { title: "Conformidade operacional", detail: "Revisar permissões, integrações e mensagens antes de qualquer ação externa; a sala prepara e escala a decisão para aprovação." };
  if (args.area === "inbox") return { title: "Triagem e encaminhamento", detail: args.deals > 0 ? `${args.deals} oportunidade(s) no período; priorizar mensagens que tenham próxima etapa registrada no CRM.` : "Sem negócios no período para orientar a triagem." };
  if (args.area === "finance") return { title: args.revenue > args.spend ? "Escala com margem protegida" : "Proteção de caixa", detail: `Receita ${brl.format(args.revenue)} versus mídia ${brl.format(args.spend)}; acompanhar resultado e orçamento diário.` };
  if (args.area === "brand") return { title: "Consistência de mensagem", detail: args.topCampaign ? `A mensagem mais exposta vem de ${args.topCampaign}; testar variações sem perder a promessa central.` : "Sem exposição suficiente para avaliar a consistência da marca." };
  return { title: args.activeSchedules > 0 ? "Playbooks automatizados ativos" : "Ativar rotina operacional", detail: args.activeSchedules > 0 ? `${args.activeSchedules} rotina(s) ativas para este escopo; monitorar a última execução.` : "Nenhuma rotina ativa vinculada a esta conta no período." };
}

export function buildCoreAccountSummaries(area: CoreAreaId, input: CoreSummaryInput): CoreAccountSummary[] {
  const insightsByAccount = new Map<string, InsightRow[]>();
  (input.insights || []).forEach((row) => {
    if (!row.ad_account_id) return;
    const current = insightsByAccount.get(row.ad_account_id) || [];
    current.push(row);
    insightsByAccount.set(row.ad_account_id, current);
  });
  const dealsByAccount = new Map<string, RDDealLite[]>();
  (input.deals || []).forEach((deal) => {
    if (!deal.ad_account_id) return;
    const current = dealsByAccount.get(deal.ad_account_id) || [];
    current.push(deal);
    dealsByAccount.set(deal.ad_account_id, current);
  });
  const salesByAccount = new Map<string, Sale[]>();
  (input.sales || []).forEach((sale) => {
    if (!sale.ad_account_id) return;
    const current = salesByAccount.get(sale.ad_account_id) || [];
    current.push(sale);
    salesByAccount.set(sale.ad_account_id, current);
  });
  const schedulesByAccount = new Map<string, CoreSchedule[]>();
  (input.schedules || []).forEach((schedule) => {
    if (!schedule.ad_account_id) return;
    const current = schedulesByAccount.get(schedule.ad_account_id) || [];
    current.push(schedule);
    schedulesByAccount.set(schedule.ad_account_id, current);
  });
  const configsByAccount = new Map<string, CoreAgentConfig[]>();
  (input.agentConfigs || []).forEach((config) => {
    if (!config.ad_account_id) return;
    const current = configsByAccount.get(config.ad_account_id) || [];
    current.push(config);
    configsByAccount.set(config.ad_account_id, current);
  });

  return input.accounts.map((account) => {
    const insightRows = insightsByAccount.get(account.id) || [];
    const dealRows = dealsByAccount.get(account.id) || [];
    const saleRows = salesByAccount.get(account.id) || [];
    const schedules = schedulesByAccount.get(account.id) || [];
    const configs = configsByAccount.get(account.id) || [];
    const spend = insightRows.reduce((sum, row) => sum + number(row.spend), 0);
    const impressions = insightRows.reduce((sum, row) => sum + number(row.impressions), 0);
    const reach = insightRows.reduce((sum, row) => sum + number(row.reach), 0);
    const clicks = insightRows.reduce((sum, row) => sum + number(row.clicks), 0);
    // `insights.leads` is a legacy aggregate. Use only the disjoint
    // acquisition facts normalized at the useInsights boundary.
    const leads = insightRows.reduce((sum, row) => sum + number(row.form_leads) + number(row.site_leads) + number(row.conversations), 0);
    const cpl = leads > 0 ? spend / leads : 0;
    const ctr = impressions > 0 ? clicks / impressions * 100 : 0;
    const confirmedSales = saleRows.filter((sale) => sale.status === "confirmed");
    const revenue = confirmedSales.reduce((sum, sale) => sum + number(sale.net_revenue), 0);
    const sales = confirmedSales.reduce((sum, sale) => sum + number(sale.quantity), 0);
    const deals = dealRows.length;
    const wonDeals = dealRows.filter((deal) => deal.win).length;
    const pipeline = dealRows.reduce((sum, deal) => sum + number(deal.amount_total), 0);
    const ticket = sales > 0 ? revenue / sales : 0;
    const activeCampaigns = new Set(insightRows.filter((row) => String(row.campaign_status || "").toUpperCase() === "ACTIVE").map((row) => row.campaign_id).filter(Boolean)).size;
    const spendByCampaign = new Map<string, { spend: number; objective: string | null }>();
    insightRows.forEach((row) => {
      const key = row.campaign_name || "Campanha sem nome";
      const current = spendByCampaign.get(key) || { spend: 0, objective: objectiveLabel(row.campaign_objective) };
      current.spend += number(row.spend);
      spendByCampaign.set(key, current);
    });
    const topCampaignEntry = [...spendByCampaign.entries()].sort((a, b) => b[1].spend - a[1].spend)[0];
    const sellerTotals = new Map<string, number>();
    dealRows.filter((deal) => deal.win && deal.deal_owner_name).forEach((deal) => sellerTotals.set(deal.deal_owner_name!, (sellerTotals.get(deal.deal_owner_name!) || 0) + number(deal.amount_total)));
    const topSeller = [...sellerTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const activeSchedules = schedules.filter((schedule) => schedule.enabled).length;
    const targetCpl = number(account.target_cpl) || 0;
    const strategy = inferStrategy({ area, spend, impressions, leads, cpl, targetCpl, revenue, activeCampaigns, topCampaign: topCampaignEntry?.[0] || null, topObjective: topCampaignEntry?.[1].objective || null, wonDeals, deals, activeSchedules, topSeller, agentConfigs: configs });
    return {
      id: account.id,
      name: account.name,
      spend, impressions, reach, clicks, leads, deals, cpl, ctr, revenue, sales, wonDeals, pipeline, ticket,
      roas: spend > 0 ? revenue / spend : 0,
      activeCampaigns,
      topCampaign: topCampaignEntry?.[0] || null,
      topObjective: topCampaignEntry?.[1].objective || null,
      topSeller,
      schedules: schedules.length,
      activeSchedules,
      strategy: strategy.title,
      strategyDetail: strategy.detail,
      health: healthFor(spend, leads, cpl, targetCpl),
    };
  });
}
