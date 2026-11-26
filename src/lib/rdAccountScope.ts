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
 * Extrai a titularidade completa de um nome de conta ou de funil RD.
 *
 * Remove o identificador da conta de anúncio (CA01), o nome do grupo e as
 * variações de pipeline (Aluna, Paciente Modelo, Expanção). O resultado é a
 * pessoa responsável ("DRA RANNIELY SILVA"), e não palavras soltas: casar
 * tokens avulsos mistura funis de titulares diferentes no mesmo escopo.
 */
export function expertSignature(value: string | null | undefined): string {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (!normalized.trim()) return "";
  // Remove prefixos de conta e sufixos de grupo antes de tokenizar.
  const withoutAccount = normalized
    .replace(/\bca\s?\d+\b/gi, " ")
    .replace(/\[.*?\]/g, " ");
  const tokens = withoutAccount
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !/^(dra|dro|dr|grupo|zntt|conta|anuncio|anuncios|aluna|aluno|paciente|modelo|expansao|expansao|atendimento|contato|conversa)$/i.test(token));
  return tokens.join(" ").trim();
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
  const directlyLinkedFunnels = activeFunnels.filter((funnel) => funnel.ad_account_id && selectedAccountIds.includes(funnel.ad_account_id));
  // A direct Meta→pipeline link is the strongest account boundary. Once one
  // exists for the selected account, do not widen the scope with every
  // pipeline belonging to the same RD connection. This is important when one
  // RD token serves several funnels/accounts or when an old connection-only
  // association was left behind during a relink.
  const candidateFunnels = directlyLinkedFunnels.length > 0
    ? directlyLinkedFunnels
    : activeFunnels.filter((funnel) => funnel.rd_connection_id && connectionIds.has(funnel.rd_connection_id));

  let resolvedCandidates = candidateFunnels;
  // When sister accounts (e.g. CA01 / CA02) belong to the same expert but
  // only one has an explicit link row in the mirror, resolve by the shared
  // expert signature so selecting CA02 does not return an empty scope.
  //
  // The signature must match the whole expert name, not loose fragments:
  // matching individual tokens let "DRA RANNIELY SILVA" resolve funnels of
  // another expert that happens to share one of those words, which inflated
  // the pipeline of the selected account with foreign negotiations.
  if (!resolvedCandidates.length && selectedAccounts.length > 0) {
    const signatures = selectedAccounts
      .map((account) => expertSignature((account as any).name))
      .filter((sig) => sig.length >= 4);
    if (signatures.length > 0) {
      resolvedCandidates = activeFunnels.filter((funnel) => {
        const funnelSignature = expertSignature(
          `${(funnel as any).expert_name || ""} ${(funnel as any).name || ""}`,
        );
        if (!funnelSignature) return false;
        // A funnel matches when it carries the complete expert signature or
        // one of its parts, so "DRA RANNIELY SILVA" matches "DRA RANNIELY SILVA"
        // but never a funnel that only says "RANNIELY".
        return signatures.some((sig) => funnelSignature.includes(sig) || sig.includes(funnelSignature));
      });
    }
  }

  const linkedFunnels = dedupeActiveRDFunnels(resolvedCandidates, selectedAccountIds);

  return linkedFunnels.length ? linkedFunnels.map((funnel) => funnel.id) : [NO_LINKED_RD_FUNNEL_SCOPE_ID];
}

export function resolveScopedRDFunnelIds<T extends MetaAccount, C extends RDConnection, F extends RDFunnel>(
  explicitFunnelIds: string[],
  selectedAccountIds: string[],
  accounts: T[],
  connections: C[],
  funnels: F[],
) {
  if (!selectedAccountIds.length) return explicitFunnelIds;
  const linked = resolveLinkedRDFunnelIds(selectedAccountIds, accounts, connections, funnels);
  if (linked.includes(NO_LINKED_RD_FUNNEL_SCOPE_ID)) return linked;
  if (!explicitFunnelIds.length) return linked;
  const linkedSet = new Set(linked);
  const narrowed = explicitFunnelIds.filter((id) => linkedSet.has(id));
  return narrowed.length ? narrowed : linked;
}
