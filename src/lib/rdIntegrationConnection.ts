export type RDIntegrationConnectionCandidate = {
  id: string;
  status: string;
  write_enabled?: boolean;
  external_account_id?: string | null;
  created_at?: string | null;
};

/**
 * Selects the stable owner-level RD connection used by the integration card.
 *
 * `updated_at` is intentionally not part of this decision: sync workers touch
 * that column on every account they process, which used to make the card jump
 * between connections after a reload. Connections created by the token-only
 * RD flow use the `rd:<user-id>:rd-station` identity; legacy RD-only rows have
 * a null external account id and are the next safest fallback.
 */
export function selectPrimaryRDIntegration<T extends RDIntegrationConnectionCandidate>(connections: T[]): T | null {
  if (!connections.length) return null;

  const rank = (connection: RDIntegrationConnectionCandidate) => {
    const externalId = connection.external_account_id ?? "";
    const isOwnerLevel = externalId.startsWith("rd:") || externalId === "";
    const isConnected = connection.status === "connected";
    // Preserve an already-enabled permission during the transition from the
    // old "latest updated row" selector. The settings endpoint normalizes all
    // rows on the next explicit toggle, so disabling is still deterministic.
    if (connection.write_enabled === true && isConnected) return 0;
    if (isOwnerLevel && isConnected) return 1;
    if (isConnected) return 2;
    if (isOwnerLevel) return 3;
    return 4;
  };

  return [...connections].sort((a, b) => {
    const rankDifference = rank(a) - rank(b);
    if (rankDifference !== 0) return rankDifference;
    const createdDifference = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    if (createdDifference !== 0) return createdDifference;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}
