/**
 * Escopo de leitura das acoes Meta (insight_actions).
 *
 * A policy RLS de `insight_actions` avalia `user_can_view_ad_account(...)`
 * linha a linha. Uma query sem filtro de conta percorre a tabela inteira e
 * re-avalia a policy a cada pagina de `LIMIT/OFFSET`, o que torna o custo
 * quadratico no tamanho da tabela e estoura o pool de conexoes do PostgREST.
 *
 * Todo acesso as acoes Meta deve, portanto, ser limitado as contas que o
 * usuario realmente acessa - o mesmo escopo usado pelos hooks de metricas.
 */
export const MAX_ACTION_SCOPE_PAGES = 40;
export const ACTION_SCOPE_PAGE_SIZE = 1000;
export const ACTION_SCOPE_TIMEOUT_MS = 8_000;

/**
 * Normaliza a lista de contas visiveis para o usuario. A entrada normalmente
 * vem de `useAdAccounts`, que ja aplica o filtro de conexao ativa.
 */
export function normalizeActionScopeAccountIds(accounts: Array<{ id?: string | null }> | undefined | null): string[] {
  const ids = (accounts || [])
    .map((account) => String(account?.id || "").trim())
    .filter((id) => id.length > 0 && id !== "all");
  return Array.from(new Set(ids));
}

/**
 * Divide a consulta de acoes em paginas, respeitando o teto de paginas.
 * Sem conta nao ha leitura possivel: o RLS bloquearia tudo e o scan seria
 * inutil, entao devolvemos lista vazia.
 */
export async function fetchActionRows<T>(options: {
  accountIds: string[];
  pageSize?: number;
  maxPages?: number;
  fetchPage: (params: { accountIds: string[]; from: number; to: number }) => Promise<{ rows: T[]; error: { message: string } | null }>;
}): Promise<T[]> {
  const { accountIds, pageSize = ACTION_SCOPE_PAGE_SIZE, maxPages = MAX_ACTION_SCOPE_PAGES, fetchPage } = options;
  if (!accountIds.length) return [];
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { rows: pageRows, error } = await fetchPage({ accountIds, from, to: from + pageSize - 1 });
    if (error) throw new Error(error.message);
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}
