export interface ScopedRDFunnel {
  ad_account_id?: string | null;
  [key: string]: unknown;
}

/**
 * Keeps automatic RD reconciliation inside the advertising-account scope
 * selected in the Growdash shell. An empty account scope intentionally means
 * all accessible funnels.
 */
export function filterRDFunnelsByAccountScope<T extends ScopedRDFunnel>(funnels: T[], accountIds: readonly string[] = [], requestedFunnelIds: readonly string[] = []) {
  const selected = new Set(accountIds.map(String).filter(Boolean));
  if (!selected.size) return funnels;
  const requested = new Set(requestedFunnelIds.map(String).filter(Boolean));
  return funnels.filter((funnel) => {
    if (funnel.ad_account_id != null && selected.has(String(funnel.ad_account_id))) return true;
    // Account-to-RD links may intentionally keep ad_account_id null on the
    // funnel row. The caller has already resolved these provider ids through
    // the selected account connection; retain only those explicit ids.
    return requested.has(String((funnel as any).id)) || requested.has(String((funnel as any).rd_funnel_id));
  });
}
