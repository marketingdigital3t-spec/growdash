export type AgentMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  rdLeads: number;
  wonDeals: number;
  revenue: number;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function buildAgentAnswer(question: string, metrics: AgentMetrics, accountName: string, periodLabel: string) {
  const normalized = question.toLocaleLowerCase("pt-BR");
  const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
  const cpl = metrics.leads > 0 ? metrics.spend / metrics.leads : 0;
  const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : 0;
  const header = `${accountName} · ${periodLabel}`;

  if (/lead|neg[oó]cio|rd station|crm/.test(normalized)) {
    return `${header}: a Meta registrou ${integer.format(metrics.leads)} lead(s) e o RD Station registrou ${integer.format(metrics.rdLeads)} negócio(s). ${metrics.wonDeals > 0 ? `${metrics.wonDeals} foram ganhos, com ${brl.format(metrics.revenue)} em receita.` : "Ainda não há vendas ganhas atribuídas no período."} ${metrics.leads > 0 ? `O CPL ficou em ${brl.format(cpl)}.` : "Não há volume suficiente para calcular CPL."}`;
  }

  if (/invest|gasto|or[cç]amento|saldo/.test(normalized)) {
    return `${header}: o investimento foi de ${brl.format(metrics.spend)}, com ${integer.format(metrics.impressions)} impressões e ${integer.format(metrics.reach)} pessoas alcançadas. ${metrics.spend === 0 ? "Confirme se a sincronização da conta está atualizada." : `O custo médio por clique foi ${metrics.clicks > 0 ? brl.format(metrics.spend / metrics.clicks) : "indisponível"}.`}`;
  }

  if (/ctr|clique|criativo|impress/.test(normalized)) {
    const direction = ctr >= 1.5
      ? "O CTR está em uma faixa saudável; teste novas variações sem interromper o melhor criativo."
      : "O CTR está baixo; revise gancho, promessa, primeira cena e coerência entre anúncio e página.";
    return `${header}: foram ${integer.format(metrics.clicks)} cliques em ${integer.format(metrics.impressions)} impressões, CTR de ${ctr.toFixed(2).replace(".", ",")}%. ${direction}`;
  }

  if (/roas|receita|venda|escala|crescer/.test(normalized)) {
    const direction = metrics.wonDeals === 0
      ? "Antes de escalar, valide a atribuição Meta × RD e a passagem de UTMs até a venda."
      : roas >= 2
        ? "Há sinal para escala gradual: aumente orçamento em etapas e monitore CPL, frequência e taxa de ganho."
        : "Priorize conversão do funil e qualidade dos leads antes de ampliar orçamento.";
    return `${header}: ${metrics.wonDeals} venda(s), ${brl.format(metrics.revenue)} de receita e ROAS reconciliado de ${roas.toFixed(2).replace(".", ",")}x. ${direction}`;
  }

  return `${header}: investimento ${brl.format(metrics.spend)}, ${integer.format(metrics.leads)} leads na Meta, ${integer.format(metrics.rdLeads)} negócios no RD, CPL ${metrics.leads > 0 ? brl.format(cpl) : "—"}, CTR ${ctr.toFixed(2).replace(".", ",")}% e ROAS ${roas.toFixed(2).replace(".", ",")}x. Pergunte por leads, investimento, CTR, criativos, RD Station, vendas ou escala para aprofundar.`;
}

