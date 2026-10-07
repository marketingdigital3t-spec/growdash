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

export function classBelongsToDateRange(row: EventClassFilterRow, scope: ClassDateRangeScope) {
  return row.date_start >= scope.startDate && row.date_start <= scope.endDate;
}

export function filterEventClassesByScope<T extends EventClassFilterRow>(rows: T[], scope: ClassDateRangeScope, accountIds: string[], expertId?: string, expertName?: string) {
  const normalizedExpertName = expertName?.trim().toLocaleLowerCase("pt-BR");
  return rows.filter((row) => {
    if (!classBelongsToDateRange(row, scope)) return false;
    if (accountIds.length && row.ad_account_id && !accountIds.includes(row.ad_account_id)) return false;
    if (accountIds.length && !row.ad_account_id) {
      if (!expertId && !normalizedExpertName) return false;
      const matchesId = Boolean(expertId && row.expert_id && row.expert_id === expertId);
      const matchesName = Boolean(normalizedExpertName && row.expert_name?.trim().toLocaleLowerCase("pt-BR") === normalizedExpertName);
      if (!matchesId && !matchesName) return false;
    }
    if (expertId && row.expert_id && row.expert_id !== expertId) return false;
    if (expertId && !row.expert_id && row.expert_name?.trim().toLocaleLowerCase("pt-BR") !== normalizedExpertName) return false;
    return true;
  });
}
