export const CAMPAIGN_PAGE_SIZE = 250;
export const RELATION_PAGE_SIZE = 500;
export const INSIGHT_PAGE_SIZE = 1_000;
export const MAX_CAMPAIGN_QUERY_PAGES = 200;
export const CAMPAIGN_REQUEST_TIMEOUT_MS = 12_000;
/** Critical dashboard analytics must settle before the first useful paint. */
export const ANALYTICS_REQUEST_TIMEOUT_MS = 2_500;
export const EMPTY_ACCOUNT_SCOPE = "00000000-0000-0000-0000-000000000000";

export function resolveCampaignAccountScope(selectedAccount: string, visibleAccountIds: string[]) {
  const ids = selectedAccount !== "all" ? [selectedAccount] : visibleAccountIds;
  return ids.length ? ids : [EMPTY_ACCOUNT_SCOPE];
}

export function chunkValues(values: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

/**
 * Fetches one bounded page at a time. A query factory keeps every page
 * independent and lets us attach a fresh AbortController to each request.
 * This prevents a slow PostgREST page from leaving the route in a skeleton
 * forever while still allowing navigation to cancel the complete operation.
 */
export async function fetchCampaignPages(
  buildQuery: () => any,
  signal: AbortSignal | undefined,
  pageSize: number,
  label: string,
  maxPages = MAX_CAMPAIGN_QUERY_PAGES,
  timeoutMs = CAMPAIGN_REQUEST_TIMEOUT_MS,
) {
  const rows: any[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    if (signal?.aborted) throw new DOMException("A consulta foi cancelada.", "AbortError");
    const pageController = new AbortController();
    const abortPage = () => pageController.abort();
    const timeoutId = globalThis.setTimeout(() => pageController.abort(), timeoutMs);
    let raceTimeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    signal?.addEventListener("abort", abortPage, { once: true });
    try {
      const request = buildQuery()
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .abortSignal(pageController.signal);
      const result: any = await Promise.race([
        Promise.resolve(request),
        new Promise<never>((_, reject) => {
          raceTimeoutId = globalThis.setTimeout(() => reject(new Error("Tempo de carregamento excedido.")), timeoutMs);
        }),
      ]);
      if (result.error) throw result.error;
      const batch = (result.data || []) as any[];
      rows.push(...batch);
      if (batch.length < pageSize) return rows;
    } catch (error) {
      if (!signal?.aborted && pageController.signal.aborted) {
        throw new Error(`${label} demorou mais de ${Math.ceil(timeoutMs / 1000)} segundos. Tente novamente ou reduza o período.`, { cause: error });
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
      if (raceTimeoutId !== undefined) globalThis.clearTimeout(raceTimeoutId);
      signal?.removeEventListener("abort", abortPage);
    }
  }
  throw new Error(`${label} excedeu o limite seguro de ${(maxPages * pageSize).toLocaleString("pt-BR")} registros.`);
}
