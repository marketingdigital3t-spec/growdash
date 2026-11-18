/**
 * Busca de funis RD na Central de Integrações.
 *
 * A lista de funis cresce junto com o número de conexões RD, então a busca
 * precisa ser local (sem nova chamada ao backend) e tolerante a variações de
 * escrita: acentos, espaços extras e caixa.
 */

export interface RDFunnelSearchable {
  name: string;
}

/** Normaliza o texto para comparação sem depender de acento ou caixa. */
export function normalizeFunnelSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/**
 * Filtra funis pelo nome. Uma consulta vazia devolve todos os funis — a
 * busca é um filtro opcional, nunca um estado que esconde a lista.
 */
export function filterRDFunnelsBySearch<T extends RDFunnelSearchable>(
  funnels: readonly T[],
  search: string,
): T[] {
  const query = normalizeFunnelSearch(search);
  if (!query) return [...funnels];
  return funnels.filter((funnel) => normalizeFunnelSearch(funnel.name).includes(query));
}
