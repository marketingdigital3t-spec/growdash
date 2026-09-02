import type { Sale } from "@/hooks/useSales";
import { normalizeUF, type FunnelAnalytics } from "@/hooks/useRDDeals";
import { realizedSales } from "@/lib/saleRevenue";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function normalized(value: string | null | undefined) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function sourceKey(value: string | null | undefined) {
  return String(value || "").trim() || "Não informado";
}

function saleDate(sale: Sale) {
  return sale.source_closed_at?.slice(0, 10) || sale.sale_date;
}

function weekdayForSale(sale: Sale) {
  return new Date(`${saleDate(sale)}T12:00:00-03:00`).getDay();
}

function hourForSale(sale: Sale) {
  if (!sale.source_closed_at) return 12;
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(sale.source_closed_at));
  const hour = Number.parseInt(value, 10);
  return Number.isFinite(hour) ? hour : 12;
}

function periodOfHour(hour: number): "Manhã" | "Tarde" | "Noite" | "Madrugada" {
  if (hour >= 5 && hour < 12) return "Manhã";
  if (hour >= 12 && hour < 18) return "Tarde";
  if (hour >= 18) return "Noite";
  return "Madrugada";
}

export interface FunnelSaleFilters {
  funnelId?: string;
  funnelIds?: string[];
  /** IDs de negócios RD já limitados ao funil ativo. Usado como fallback
   * seguro quando a venda canônica ainda não recebeu rd_funnel_id. */
  scopedDealIds?: Set<string>;
  source?: string;
  campaign?: string;
  state?: string;
  product?: string;
  allowedDealIds?: Set<string>;
  stateByDealId?: ReadonlyMap<string, string | null | undefined>;
}

export interface FunnelRevenueContext {
  /** Estado do negócio no RD é o fallback quando a venda canônica ainda não
   * recebeu `lead_state` durante a sincronização. */
  stateByDealId?: ReadonlyMap<string, string | null | undefined>;
}

/**
 * Aplica aos faturamentos os mesmos filtros visíveis na análise de funil.
 * Vendas RD sem correspondência com o funil selecionado nunca vazam para
 * outra conta/funil.
 */
export function filterCanonicalFunnelSales(sales: Sale[], filters: FunnelSaleFilters) {
  return realizedSales(sales).filter((sale) => {
    if (filters.funnelIds?.length) {
      const matchesFunnel = !!sale.rd_funnel_id && filters.funnelIds.includes(sale.rd_funnel_id);
      const matchesScopedDeal = !sale.rd_funnel_id && !!sale.rd_deal_id && !!filters.scopedDealIds?.has(sale.rd_deal_id);
      if (!matchesFunnel && !matchesScopedDeal) return false;
    }
    if (!filters.funnelIds?.length && filters.funnelId) {
      const matchesFunnel = sale.rd_funnel_id === filters.funnelId;
      const matchesScopedDeal = !sale.rd_funnel_id && !!sale.rd_deal_id && !!filters.scopedDealIds?.has(sale.rd_deal_id);
      if (!matchesFunnel && !matchesScopedDeal) return false;
    }
    if (filters.allowedDealIds && (!sale.rd_deal_id || !filters.allowedDealIds.has(sale.rd_deal_id))) return false;
    if (filters.source && filters.source !== "all" && normalized(sale.utm_source) !== normalized(filters.source)) return false;
    if (filters.campaign && filters.campaign !== "all") {
      const expected = normalized(filters.campaign);
      if (![sale.utm_campaign, sale.rd_campaign_name].some((value) => normalized(value) === expected)) return false;
    }
    const saleState = sale.lead_state || (sale.rd_deal_id ? filters.stateByDealId?.get(sale.rd_deal_id) : null);
    if (filters.state && filters.state !== "all" && normalizeUF(saleState) !== normalizeUF(filters.state)) return false;
    if (filters.product && filters.product !== "all" && normalized(sale.rd_product_name) !== normalized(filters.product)) return false;
    return true;
  });
}

/**
 * Mantém volume, etapas e perdas calculados a partir do snapshot do RD, mas
 * substitui todas as medidas monetárias/de conversão pela fonte canônica
 * `sales`. Assim todos os módulos exibem exatamente o mesmo faturamento.
 */
export function reconcileFunnelRevenue(base: FunnelAnalytics, inputSales: Sale[], context: FunnelRevenueContext = {}): FunnelAnalytics {
  const sales = realizedSales(inputSales);
  const conversions = sales.reduce((sum, sale) => sum + Math.max(1, Number(sale.quantity || 1)), 0);
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);

  const sourceMap = new Map(base.sourceBreakdown.map((row) => [normalized(row.source), { ...row, sales: 0, revenue: 0 }]));
  const stateMap = new Map(base.stateBreakdown.map((row) => [normalized(row.state), { ...row, conversions: 0 }]));
  const weekdayMap = new Map(base.weekdayBreakdown.map((row) => [row.weekday, { ...row, conversions: 0, revenue: 0 }]));
  const hourMap = new Map<number, { leads: number; conversions: number; revenue: number }>();
  for (const period of base.hourBreakdown) {
    for (const hour of period.hours) hourMap.set(hour.hour, { ...hour, conversions: 0, revenue: 0 });
  }
  for (let hour = 0; hour < 24; hour++) {
    if (!hourMap.has(hour)) hourMap.set(hour, { leads: 0, conversions: 0, revenue: 0 });
  }
  const evolution = new Map(base.evolution.map((row) => [row.date, { ...row, conversions: 0 }]));

  for (const sale of sales) {
    const quantity = Math.max(1, Number(sale.quantity || 1));
    const amount = Number(sale.net_revenue || 0);

    const source = sourceKey(sale.utm_source);
    const sourceId = normalized(source);
    const sourceRow = sourceMap.get(sourceId) || { source, leads: 0, sales: 0, conversionRate: 0, revenue: 0 };
    sourceRow.sales += quantity;
    sourceRow.revenue += amount;
    sourceMap.set(sourceId, sourceRow);

    const state = normalizeUF(sale.lead_state || (sale.rd_deal_id ? context.stateByDealId?.get(sale.rd_deal_id) : null));
    const stateId = normalized(state);
    // Vendas fechadas no período podem pertencer a leads que entraram antes
    // dele. Preservar a UF com zero leads evita descartar conversões reais.
    const stateRow = stateMap.get(stateId) || { state, leads: 0, conversions: 0, conversionRate: 0 };
    stateRow.conversions += quantity;
    stateMap.set(stateId, stateRow);

    const weekday = weekdayForSale(sale);
    const weekdayRow = weekdayMap.get(weekday) || { weekday, label: WEEKDAYS[weekday], leads: 0, conversions: 0, conversionRate: 0, revenue: 0 };
    weekdayRow.conversions += quantity;
    weekdayRow.revenue += amount;
    weekdayMap.set(weekday, weekdayRow);

    const hour = hourForSale(sale);
    const hourRow = hourMap.get(hour)!;
    hourRow.conversions += quantity;
    hourRow.revenue += amount;

    const day = saleDate(sale);
    const evolutionRow = evolution.get(day) || { date: day, leads: 0, opportunities: 0, conversions: 0 };
    evolutionRow.conversions += quantity;
    evolution.set(day, evolutionRow);
  }

  const sourceBreakdown = Array.from(sourceMap.values())
    .map((row) => ({ ...row, conversionRate: row.leads > 0 ? row.sales / row.leads * 100 : 0 }))
    .sort((a, b) => b.sales - a.sales || b.leads - a.leads);
  const stateBreakdown = Array.from(stateMap.values())
    .map((row) => ({ ...row, conversionRate: row.leads > 0 ? row.conversions / row.leads * 100 : 0 }))
    .sort((a, b) => b.leads - a.leads);
  const weekdayBreakdown = Array.from(weekdayMap.values())
    .map((row) => ({ ...row, conversionRate: row.leads > 0 ? row.conversions / row.leads * 100 : 0 }))
    .sort((a, b) => a.weekday - b.weekday);
  const hourBreakdown = (["Manhã", "Tarde", "Noite", "Madrugada"] as const).map((period) => {
    const hours = Array.from(hourMap.entries())
      .filter(([hour]) => periodOfHour(hour) === period)
      .map(([hour, row]) => ({ hour, ...row }))
      .sort((a, b) => a.hour - b.hour);
    const leads = hours.reduce((sum, row) => sum + row.leads, 0);
    const periodConversions = hours.reduce((sum, row) => sum + row.conversions, 0);
    return { period, leads, conversions: periodConversions, conversionRate: leads > 0 ? periodConversions / leads * 100 : 0, hours };
  });

  return {
    ...base,
    conversions,
    revenue,
    avgTicket: conversions > 0 ? revenue / conversions : 0,
    conversionRate: base.totalLeads > 0 ? conversions / base.totalLeads * 100 : 0,
    sourceBreakdown,
    stateBreakdown,
    weekdayBreakdown,
    hourBreakdown,
    evolution: Array.from(evolution.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
