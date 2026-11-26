/**
 * Date helpers para garantir consistência entre filtros do dashboard,
 * queries (date-only columns como `sale_date`, `date`) e exibição.
 *
 * Regra: NUNCA usar `Date.prototype.toISOString().split("T")[0]` para
 * derivar uma data-só (YYYY-MM-DD), pois ele converte para UTC e
 * desloca o dia em horários noturnos no Brasil (UTC-3).
 *
 * Sempre usar `toLocalDateString` ou `date-fns/format` no fuso local.
 */
import { format, parseISO } from "date-fns";

/**
 * Converte um Date para string YYYY-MM-DD usando o fuso LOCAL do
 * navegador (no Brasil: BRT). É o equivalente correto a
 * `toISOString().split("T")[0]` para colunas `date` do Postgres.
 */
export function toLocalDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Parse seguro de uma string YYYY-MM-DD vinda do banco para Date.
 * Evita deslocamento de timezone que ocorre com `new Date("2025-01-15")`
 * (interpretada como UTC e exibida como 14/01 no Brasil).
 */
export function parseLocalDate(s: string): Date {
  // parseISO trata "yyyy-MM-dd" como data local (sem timezone).
  return parseISO(s);
}

/**
 * Formata um intervalo de filtro para uso em queries que comparam
 * colunas `date` (não timestamptz).
 */
export function formatDateRange(startDate: Date, endDate: Date) {
  return {
    start: toLocalDateString(startDate),
    end: toLocalDateString(endDate),
  };
}
