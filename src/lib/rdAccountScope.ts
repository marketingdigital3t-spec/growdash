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
  const activeFunnels = funnels.filter((funnel) => funnel.is_active && Boolean(funnel.rd_funnel_id));
  if (selectedAccountIds.length === 0) return activeFunnels.map((funnel) => funnel.id);

  const selectedAccounts = accounts.filter((account) => selectedAccountIds.includes(account.id));
  const externalIds = new Set(selectedAccounts.map((account) => canonicalExternalAccountId(account.account_id)).filter(Boolean));
  const connectionIds = new Set(
    connections
      .filter((connection) => externalIds.has(canonicalExternalAccountId(connection.external_account_id)))
      .map((connection) => connection.id),
  );
  const linkedFunnels = activeFunnels
    .filter((funnel) => (funnel.ad_account_id && selectedAccountIds.includes(funnel.ad_account_id))
      || (funnel.rd_connection_id && connectionIds.has(funnel.rd_connection_id)))
    .map((funnel) => funnel.id);

  return linkedFunnels.length ? linkedFunnels : [NO_LINKED_RD_FUNNEL_SCOPE_ID];
}
