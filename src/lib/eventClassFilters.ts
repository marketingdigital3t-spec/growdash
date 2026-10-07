/** Global date scope used by the event-class inventory. Dates are YYYY-MM-DD business dates. */
export interface ClassDateRangeScope {
  startDate: string;
  endDate: string;
}

export interface EventClassFilterRow {
  date_start: string;
  ad_account_id?: string | null;
  expert_id?: string | null;
  expert_name?: string | null;
  archived_at?: string | null;
}

export interface ExpertAccountScope {
  accountToExpertIds: Record<string, string[]>;
  expertToAccountIds: Record<string, string[]>;
  expertNameToIds: Record<string, string[]>;
}

export interface ExpertAccountScopeSource {
  expert_id?: string | null;
  ad_account_id?: string | null;
}

export interface ExpertAccountScopeExpert {
  id: string;
  nome?: string | null;
}

export const normalizeExpertName = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9\s]/g, " ")
  .trim()
  .replace(/\s+/g, " ")
  .toLocaleLowerCase("pt-BR");

export function buildExpertAccountScope(
  sources: ExpertAccountScopeSource[],
  experts: ExpertAccountScopeExpert[],
): ExpertAccountScope {
  const accountToExpertIds: Record<string, string[]> = {};
  const expertToAccountIds: Record<string, string[]> = {};
  const expertNameToIds: Record<string, string[]> = {};
  const add = (map: Record<string, string[]>, key: string, value: string) => {
    if (!key || !value) return;
    map[key] = Array.from(new Set([...(map[key] || []), value]));
  };
  sources.forEach((source) => {
    if (source.expert_id && source.ad_account_id) {
      add(accountToExpertIds, source.ad_account_id, source.expert_id);
      add(expertToAccountIds, source.expert_id, source.ad_account_id);
    }
  });
  experts.forEach((expert) => {
    const name = normalizeExpertName(expert.nome);
    if (name) add(expertNameToIds, name, expert.id);
  });
  return { accountToExpertIds, expertToAccountIds, expertNameToIds };
}

export function classBelongsToDateRange(row: EventClassFilterRow, scope: ClassDateRangeScope) {
  return row.date_start >= scope.startDate && row.date_start <= scope.endDate;
}

export function filterEventClassesByScope<T extends EventClassFilterRow>(
  rows: T[],
  scope: ClassDateRangeScope,
  accountIds: string[],
  expertId?: string,
  expertName?: string,
  accountScope?: ExpertAccountScope,
) {
  const normalizedExpertName = normalizeExpertName(expertName);
  const selectedAccountSet = new Set(accountIds);
  return rows.filter((row) => {
    if (!classBelongsToDateRange(row, scope)) return false;
    if (!accountIds.length) return true;
    if (row.ad_account_id) return selectedAccountSet.has(row.ad_account_id);

    const candidateExpertIds = new Set<string>();
    if (row.expert_id) candidateExpertIds.add(row.expert_id);
    const rowName = normalizeExpertName(row.expert_name);
    Object.entries(accountScope?.expertNameToIds || {}).forEach(([expertNameKey, ids]) => {
      if (rowName === expertNameKey || rowName.includes(expertNameKey) || expertNameKey.includes(rowName)) {
        ids.forEach((id) => candidateExpertIds.add(id));
      }
    });
    if (expertId) candidateExpertIds.add(expertId);
    if (normalizedExpertName && accountScope) {
      (accountScope.expertNameToIds[normalizedExpertName] || []).forEach((id) => candidateExpertIds.add(id));
    }

    for (const candidateId of candidateExpertIds) {
      if ((accountScope?.expertToAccountIds[candidateId] || []).some((id) => selectedAccountSet.has(id))) return true;
    }

    // Keep the previous exact fallback for legacy data when the account map is unavailable.
    if (!accountScope && expertId && row.expert_id === expertId) return true;
    if (!accountScope && normalizedExpertName && normalizeExpertName(row.expert_name) === normalizedExpertName) return true;
    return false;
  });
}
