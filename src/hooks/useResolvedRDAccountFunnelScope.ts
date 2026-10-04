import { useMemo } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDAccountConnections } from "@/hooks/useRDAccountConnections";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { NO_LINKED_RD_FUNNEL_SCOPE_ID, resolveLinkedRDFunnelIds } from "@/lib/rdAccountScope";

type Params = {
  adAccountId?: string;
  adAccountIds?: string[];
  funnelIds?: string[];
};

/**
 * Resolve RD pipelines from the selected Meta account when a caller has not
 * supplied an explicit RD funnel scope. RD deals imported through a connection
 * commonly have `ad_account_id = null`, so filtering that column alone drops
 * valid deals; the canonical relationship is Meta external account → RD
 * connection → RD funnel.
 */
export function useResolvedRDAccountFunnelScope({ adAccountId, adAccountIds, funnelIds }: Params) {
  const accountIds = useMemo(
    () => Array.from(new Set([...(adAccountIds ?? []), ...(adAccountId ? [adAccountId] : [])].filter(Boolean))).sort(),
    [adAccountId, adAccountIds],
  );
  const explicitFunnelIds = useMemo(() => Array.from(new Set((funnelIds ?? []).filter(Boolean))).sort(), [funnelIds]);
  // GlobalFiltersContext uses the sentinel while its linkage metadata loads.
  // Resolve it here as well so a temporary loading state cannot look like a
  // confirmed empty RD day.
  const unresolvedSentinel = explicitFunnelIds.length === 1 && explicitFunnelIds[0] === NO_LINKED_RD_FUNNEL_SCOPE_ID;
  const needsResolution = (explicitFunnelIds.length === 0 || unresolvedSentinel) && accountIds.length > 0;
  const accounts = useAdAccounts();
  const connections = useRDAccountConnections();
  const funnels = useRDFunnels(undefined, needsResolution);

  const loading = needsResolution && (accounts.isLoading || connections.isLoading || funnels.isLoading);
  const error = needsResolution ? accounts.error || connections.error || funnels.error : null;
  const resolvedFunnelIds = useMemo(() => {
    if (explicitFunnelIds.length && !unresolvedSentinel) return explicitFunnelIds;
    if (!accountIds.length || loading || error) return accountIds.length ? [] : undefined;
    return resolveLinkedRDFunnelIds(
      accountIds,
      accounts.data ?? [],
      connections.data ?? [],
      funnels.data ?? [],
    );
  }, [accountIds, accounts.data, connections.data, error, explicitFunnelIds, funnels.data, loading, unresolvedSentinel]);

  return {
    accountScoped: needsResolution,
    funnelIds: resolvedFunnelIds,
    loading,
    error,
    ready: !needsResolution || (!loading && !error),
  };
}
