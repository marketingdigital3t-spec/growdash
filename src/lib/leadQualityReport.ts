export type LeadCategory = "paciente_modelo" | "aluna" | "sem_classificacao";

export type LeadQualityDeal = {
  stage_bucket?: string | null;
  rd_stage_name?: string | null;
  rd_product_name?: string | null;
  win?: boolean | null;
  custom_fields?: Record<string, string> | null;
  lead_created_at?: string | null;
  stage_updated_at?: string | null;
  closed_at?: string | null;
};

export type LeadQualitySale = {
  status?: string | null;
  quantity?: number | null;
  net_revenue?: number | null;
  sale_date?: string | null;
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

export type DailyLeadReport = {
  date: string;
  spend: number;
  metaLeads: number;
  rdLeads: number;
  qualified: number;
  opportunities: number;
  sales: number;
  revenue: number;
  cpl: number;
  costPerOpportunity: number;
  costPerSale: number;
  metaToRdRate: number;
  rdToOpportunityRate: number;
  opportunityToSaleRate: number;
  status: "ok" | "partial" | "empty";
  coverageNote: string;
  recommendation: string;
  nextAction: string;
};

const empty = () => ({ leads: 0, qualified: 0, opportunities: 0, sales: 0 });

function normalize(value: string | null | undefined) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function classifyLeadCategory(deal: LeadQualityDeal): LeadCategory {
  const values = [deal.rd_product_name, deal.rd_stage_name, ...Object.values(deal.custom_fields ?? {})]
    .filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/paciente\s*modelo|paciente-modelo|\bpm\b/.test(values)) return "paciente_modelo";
  if (/aluna|aluno|formacao|especializacao|turma/.test(values)) return "aluna";
  return "sem_classificacao";
}

function stage(deal: LeadQualityDeal) {
  const bucket = normalize(deal.stage_bucket);
  const value = `${bucket} ${normalize(deal.rd_stage_name)}`;
  const won = deal.win === true || bucket === "won" || /venda realizada|venda concluida|fechado ganho|ganho|won|cliente|\bclient\b/.test(value);
  const opportunity = bucket === "opportunity" || /oportunidade|opportunity|aguardando pagamento|em conversa|stand by/.test(value);
  return { won, opportunity, qualified: won || opportunity || /qualific|mql|sql/.test(value) };
}

export function isLeadQualityOpportunity(deal: LeadQualityDeal) {
  return stage(deal).opportunity;
}

export function isLeadQualityWon(deal: LeadQualityDeal) {
  return stage(deal).won;
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

function day(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function confirmedSales(sales: LeadQualitySale[], date: string) {
  return sales.filter((sale) => day(sale.sale_date) === date && normalize(sale.status) === "confirmed");
}

/**
 * Calcula o relatório do dia apenas com fatos já persistidos pelo Growdash.
 * A função não faz chamadas externas e mantém as lacunas de atribuição visíveis.
 */
export function buildDailyLeadReport({
  date,
  spend,
  metaLeads,
  deals,
  sales,
}: {
  date: string;
  spend: number;
  metaLeads: number;
  deals: LeadQualityDeal[];
  sales: LeadQualitySale[];
}): DailyLeadReport {
  const rdLeads = deals.filter((deal) => day(deal.lead_created_at) === date);
  const opportunityDeals = deals.filter((deal) => isLeadQualityOpportunity(deal) && (day(deal.stage_updated_at) === date || (!deal.stage_updated_at && day(deal.lead_created_at) === date)));
  const qualifiedDeals = deals.filter((deal) => {
    const state = stage(deal);
    return state.qualified && (day(deal.stage_updated_at) === date || (!deal.stage_updated_at && day(deal.lead_created_at) === date));
  });
  const daySales = confirmedSales(sales, date);
  const saleCount = daySales.reduce((sum, sale) => sum + Math.max(1, Number(sale.quantity || 1)), 0);
  const revenue = daySales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
  const hasMeta = metaLeads > 0 || spend > 0;
  const hasRD = deals.length > 0;
  const hasSalesSource = sales.length > 0;
  const status: DailyLeadReport["status"] = !hasMeta && !hasRD && !hasSalesSource ? "empty" : hasMeta && hasRD && hasSalesSource ? "ok" : "partial";
  const coverageNote = status === "ok"
    ? "Meta, RD e vendas possuem dados persistidos para este dia."
    : status === "empty"
      ? "Nenhum dado persistido para este dia; confirme a sincronização e o intervalo selecionado."
      : `Cobertura parcial: ${!hasMeta ? "Meta" : ""}${!hasMeta && !hasRD ? ", " : ""}${!hasRD ? "RD" : ""}${(!hasMeta || !hasRD) && !hasSalesSource ? " e " : ""}${!hasSalesSource ? "vendas" : ""} não apresentou dados persistidos no escopo.`;
  let recommendation = "Mantenha a estrutura e acompanhe a evolução até acumular amostra suficiente.";
  let nextAction = "Revisar novamente na próxima sincronização diária.";
  if (status === "empty") {
    recommendation = "Não tome decisão de mídia com o dia vazio; primeiro valide a sincronização e a data do relatório.";
    nextAction = "Atualizar a sincronização Meta/RD e confirmar o último horário de sucesso.";
  } else if (metaLeads > 0 && rdLeads === 0) {
    recommendation = "Há leads Meta sem entrada correspondente no RD. O gargalo provável está no formulário, webhook, UTM ou fila de integração.";
    nextAction = "Testar um lead e conferir o payload completo até a criação do negócio no RD.";
  } else if (opportunityDeals.length > 0 && saleCount === 0) {
    recommendation = "O tráfego chegou à zona de oportunidade, mas ainda não gerou venda. Priorize atendimento e follow-up antes de alterar orçamento.";
    nextAction = "Revisar as oportunidades abertas, responsável e próximo contato no RD hoje.";
  } else if (saleCount > 0) {
    recommendation = "O funil produziu venda confirmada. Preserve a origem atribuída e compare este anúncio/campanha com a média da conta antes de escalar.";
    nextAction = "Validar a atribuição Meta → RD → venda e registrar o criativo responsável.";
  } else if (metaLeads > 0 && opportunityDeals.length === 0) {
    recommendation = "O volume de leads ainda não avançou para oportunidade. Analise qualificação, velocidade de resposta e aderência da oferta.";
    nextAction = "Revisar todos os leads do dia e medir o tempo até o primeiro contato.";
  }
  return {
    date,
    spend,
    metaLeads,
    rdLeads: rdLeads.length,
    qualified: qualifiedDeals.length,
    opportunities: opportunityDeals.length,
    sales: saleCount,
    revenue,
    cpl: metaLeads ? spend / metaLeads : 0,
    costPerOpportunity: opportunityDeals.length ? spend / opportunityDeals.length : 0,
    costPerSale: saleCount ? spend / saleCount : 0,
    metaToRdRate: metaLeads ? rdLeads.length / metaLeads * 100 : 0,
    rdToOpportunityRate: rdLeads.length ? opportunityDeals.length / rdLeads.length * 100 : 0,
    opportunityToSaleRate: opportunityDeals.length ? saleCount / opportunityDeals.length * 100 : 0,
    status,
    coverageNote,
    recommendation,
    nextAction,
  };
}
