export const NO_LINKED_RD_FUNNEL_SCOPE_ID = "__no_linked_rd_funnels__";

type MetaAccount = { id: string; account_id?: string | null };
type RDConnection = { id: string; external_account_id?: string | null };
type RDFunnel = {
  id: string;
  ad_account_id?: string | null;
  rd_connection_id?: string | null;
  rd_funnel_id?: string | null;
  is_active: boolean;
};

/**
 * A single RD pipeline can be linked more than once while an old Meta/RD
 * association is being replaced. The provider pipeline id is the stable
 * identity; the local UUID is only the association row. Keep one active
 * association per provider pipeline for read scopes so the CRM cannot render
 * the same pipeline twice or count the same deal through two local rows.
 *
 * When an account is selected, prefer the association that points directly to
 * that account. This preserves the account boundary while still collapsing
 * duplicate rows for consolidated views.
 */
export function dedupeActiveRDFunnels<T extends RDFunnel>(funnels: T[], preferredAccountIds: string[] = []) {
  const preferred = new Set(preferredAccountIds.filter(Boolean));
  const selected = new Map<string, { row: T; score: number; index: number }>();
  funnels.forEach((row, index) => {
    if (!row.is_active || !row.rd_funnel_id) return;
    const providerId = String(row.rd_funnel_id);
    const score = (row.ad_account_id && preferred.has(row.ad_account_id) ? 0 : 2)
      + (row.ad_account_id ? 0 : 1)
      + (row.rd_connection_id ? 0 : 1);
    const current = selected.get(providerId);
    if (!current || score < current.score || (score === current.score && index < current.index)) {
      selected.set(providerId, { row, score, index });
    }
  });
  return Array.from(selected.values()).map(({ row }) => row);
}

function canonicalExternalAccountId(value: string | null | undefined) {
  const digits = String(value || "").trim().replace(/^act_/i, "");
  return digits ? `act_${digits}` : "";
}

/**
 * Resolves the RD pipelines belonging to the selected Meta accounts. Newer RD
 * links live on rd_account_connections (external_account_id = Meta act_ ID),
 * while older installations may still store the internal account UUID on the
 * funnel itself. No linked funnel is represented explicitly so consumers do
 * not mistake an empty linked scope for “all funnels”.
 */
export function resolveLinkedRDFunnelIds(
  selectedAccountIds: string[],
  accounts: MetaAccount[],
  connections: RDConnection[],
  funnels: RDFunnel[],
) {
  const activeFunnels = dedupeActiveRDFunnels(funnels, selectedAccountIds);
  if (selectedAccountIds.length === 0) return activeFunnels.map((funnel) => funnel.id);

  const selectedAccounts = accounts.filter((account) => selectedAccountIds.includes(account.id));
  // Never widen a partially resolved selection: if one requested account is
  // missing from the authorized account list, the safe RD scope is empty.
  if (selectedAccounts.length !== selectedAccountIds.length) return [NO_LINKED_RD_FUNNEL_SCOPE_ID];
  const externalIds = new Set(selectedAccounts.map((account) => canonicalExternalAccountId(account.account_id)).filter(Boolean));
  const connectionIds = new Set(
    connections
      .filter((connection) => externalIds.has(canonicalExternalAccountId(connection.external_account_id)))
      .map((connection) => connection.id),
  );
  const linkedFunnels = dedupeActiveRDFunnels(activeFunnels
    .filter((funnel) => (funnel.ad_account_id && selectedAccountIds.includes(funnel.ad_account_id))
      || (funnel.rd_connection_id && connectionIds.has(funnel.rd_connection_id))), selectedAccountIds);

  return linkedFunnels.length ? linkedFunnels.map((funnel) => funnel.id) : [NO_LINKED_RD_FUNNEL_SCOPE_ID];
}
