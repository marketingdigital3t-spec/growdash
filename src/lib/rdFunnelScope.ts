export interface ScopedRDFunnel {
  ad_account_id?: string | null;
  [key: string]: unknown;
}

/**
 * Keeps automatic RD reconciliation inside the advertising-account scope
 * selected in the Growdash shell. An empty account scope intentionally means
 * all accessible funnels.
 */
export function filterRDFunnelsByAccountScope<T extends ScopedRDFunnel>(funnels: T[], accountIds: readonly string[] = []) {
  const selected = new Set(accountIds.map(String).filter(Boolean));
  if (!selected.size) return funnels;
  return funnels.filter((funnel) => funnel.ad_account_id != null && selected.has(String(funnel.ad_account_id)));
}
