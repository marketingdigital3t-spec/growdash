export type LeadCategory = "paciente_modelo" | "aluna" | "sem_classificacao";

export type LeadQualityDeal = {
  stage_bucket?: string | null;
  rd_stage_name?: string | null;
  rd_product_name?: string | null;
  win?: boolean | null;
  custom_fields?: Record<string, string> | null;
};

export type LeadQualitySummary = {
  leads: number;
  qualified: number;
  opportunities: number;
  sales: number;
  qualificationRate: number;
  leadToSaleRate: number;
  costPerQualified: number;
  costPerOpportunity: number;
  byCategory: Record<LeadCategory, { leads: number; qualified: number; opportunities: number; sales: number }>;
};

const empty = () => ({ leads: 0, qualified: 0, opportunities: 0, sales: 0 });

export function classifyLeadCategory(deal: LeadQualityDeal): LeadCategory {
  const values = [deal.rd_product_name, deal.rd_stage_name, ...Object.values(deal.custom_fields ?? {})]
    .filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/paciente\s*modelo|paciente-modelo|\bpm\b/.test(values)) return "paciente_modelo";
  if (/aluna|aluno|formacao|especializacao|turma/.test(values)) return "aluna";
  return "sem_classificacao";
}

function stage(deal: LeadQualityDeal) {
  const value = `${deal.stage_bucket ?? ""} ${deal.rd_stage_name ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const won = deal.win === true || /venda realizada|ganho|won/.test(value);
  const opportunity = /oportunidade|opportunity|aguardando pagamento|em conversa|stand by/.test(value);
  return { won, opportunity, qualified: won || opportunity || /qualific|mql|sql/.test(value) };
}

export function buildLeadQualitySummary(deals: LeadQualityDeal[], spend: number): LeadQualitySummary {
  const byCategory: LeadQualitySummary["byCategory"] = { paciente_modelo: empty(), aluna: empty(), sem_classificacao: empty() };
  let qualified = 0, opportunities = 0, sales = 0;
  for (const deal of deals) {
    const current = byCategory[classifyLeadCategory(deal)];
    const state = stage(deal);
    current.leads += 1;
    if (state.qualified) { qualified += 1; current.qualified += 1; }
    if (state.opportunity) { opportunities += 1; current.opportunities += 1; }
    if (state.won) { sales += 1; current.sales += 1; }
  }
  return {
    leads: deals.length,
    qualified,
    opportunities,
    sales,
    qualificationRate: deals.length ? qualified / deals.length * 100 : 0,
    leadToSaleRate: deals.length ? sales / deals.length * 100 : 0,
    costPerQualified: qualified ? spend / qualified : 0,
    costPerOpportunity: opportunities ? spend / opportunities : 0,
    byCategory,
  };
}
