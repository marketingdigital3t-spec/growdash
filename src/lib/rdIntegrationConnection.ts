export type RDIntegrationConnectionCandidate = {
  id: string;
  status: string;
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
    if (isOwnerLevel && isConnected) return 0;
    if (isOwnerLevel) return 1;
    if (isConnected) return 2;
    return 3;
  };

  return [...connections].sort((a, b) => {
    const rankDifference = rank(a) - rank(b);
    if (rankDifference !== 0) return rankDifference;
    const createdDifference = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    if (createdDifference !== 0) return createdDifference;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}
