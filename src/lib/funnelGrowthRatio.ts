/**
 * Metricas de growth da analise de funil: quantos leads sao necessarios
 * para 1 venda e qual a cobertura do rastreamento.
 *
 * O usuario precisa da razao "a cada N leads eu tenho 1 venda" (exemplo
 * real: Dra. Ranniely Aluna, 112 leads e 8 vendas = 14 leads por venda).
 * Essa razao so e confiavel quando o numerador e o denominador vem do mesmo
 * recorte (mesmo funil, mesmo periodo, mesma conta) e quando a cobertura do
 * rastreamento e conhecida.
 */

export interface LeadsPerSaleInput {
  /** Leads do RD Station no recorte. */
  rdLeads: number;
  /** Leads da Meta no mesmo recorte, quando o snapshot existe. */
  metaLeads?: number;
  /** Se os leads da Meta estao disponiveis para o recorte. */
  metaLeadsAvailable?: boolean;
  /** Vendas realizadas (RD ganho) no mesmo recorte. */
  sales: number;
  /** Deals do RD que chegaram a ter `meta_lead_id` preenchido. */
  dealsWithMetaAttribution?: number;
  /** Total de deals do RD no recorte, para medir a cobertura. */
  totalDeals?: number;
}

export interface LeadsPerSaleResult {
  /** Total de leads somando as fontes disponiveis. */
  totalLeads: number;
  /** Quantos leads por venda. `null` quando nao há venda para fazer a razão. */
  leadsPerSale: number | null;
  /** Frase pronta para leitura: "1 venda a cada 14 leads". */
  label: string;
  /** Vendas realizadas no recorte. */
  sales: number;
  /** Cobertura do rastreamento Meta sobre os deals (0..1). */
  attributionCoverage: number | null;
  /** Aviso quando o numero nao pode ser lido como confiavel. */
  caveat: string | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Calcula a razao leads-por-venda.
 *
 * Regras:
 * - O denominador (vendas) e o numerador (leads) precisam vir do mesmo
 *   recorte: o chamador garante isso, e o calculo nunca mistura escopos.
 * - Sem vendas, a razao e `null` e o rotulo diz "—" em vez de "infinito".
 * - A cobertura do rastreamento Meta aparece como ressalva: se a maioria
 *   dos deals nao tem lead da Meta vinculado, o total combinado subestima
 *   os leads e a razao fica otimista demais.
 */
export function computeLeadsPerSale(input: LeadsPerSaleInput): LeadsPerSaleResult {
  const rdLeads = isFiniteNumber(input.rdLeads) ? Math.max(0, input.rdLeads) : 0;
  const metaLeads = isFiniteNumber(input.metaLeads) ? Math.max(0, input.metaLeads) : 0;
  const sales = isFiniteNumber(input.sales) ? Math.max(0, input.sales) : 0;
  const metaLeadsAvailable = input.metaLeadsAvailable === true;

  // A Meta e o RD podem apontar o mesmo lead. O total combinado e a leitura
  // que o usuario pediu ("junta o leads meta e leads RD no mesmo bloco"),
  // e a composicao fica visivel para ele poder conferir a sobreposicao.
  const totalLeads = rdLeads + (metaLeadsAvailable ? metaLeads : 0);

  const leadsPerSale = sales > 0 && totalLeads > 0 ? totalLeads / sales : null;

  const label = leadsPerSale === null
    ? "—"
    : `1 venda a cada ${leadsPerSale >= 10 ? Math.round(leadsPerSale) : leadsPerSale.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} leads`;

  const totalDeals = isFiniteNumber(input.totalDeals) ? Math.max(0, input.totalDeals) : 0;
  const dealsWithMetaAttribution = isFiniteNumber(input.dealsWithMetaAttribution)
    ? Math.max(0, input.dealsWithMetaAttribution)
    : 0;
  const attributionCoverage = totalDeals > 0 ? dealsWithMetaAttribution / totalDeals : null;

  const caveats: string[] = [];
  if (sales === 0) {
    caveats.push("Sem vendas realizadas no período: a razão de leads por venda ainda não existe.");
  }
  if (!metaLeadsAvailable) {
    caveats.push("Sem snapshot de leads da Meta para este recorte: o total considera apenas o RD Station.");
  }
  if (attributionCoverage !== null && attributionCoverage < 0.5) {
    caveats.push(
      `Cobertura do rastreamento da Meta em ${Math.round(attributionCoverage * 100)}% dos negócios: parte dos leads pode não estar entrando no total.`,
    );
  }

  return {
    totalLeads,
    leadsPerSale,
    label,
    sales,
    attributionCoverage,
    caveat: caveats.length ? caveats.join(" ") : null,
  };
}
