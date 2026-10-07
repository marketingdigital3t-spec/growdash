export interface ClassMonthScope {
  year: number;
  month: number;
}

export interface EventClassFilterRow {
  date_start: string;
  ad_account_id?: string | null;
  expert_id?: string | null;
  expert_name?: string | null;
  archived_at?: string | null;
}

export function currentClassMonth(now = new Date()): ClassMonthScope {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric" }).formatToParts(now);
  return { year: Number(parts.find((part) => part.type === "year")?.value), month: Number(parts.find((part) => part.type === "month")?.value) };
}

export function classMonthBounds(scope: ClassMonthScope) {
  const start = `${scope.year}-${String(scope.month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(scope.year, scope.month, 0)).getUTCDate();
  return { start, end: `${scope.year}-${String(scope.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
}

export function normalizeClassMonth(scope: ClassMonthScope): ClassMonthScope {
  const date = new Date(Date.UTC(scope.year, scope.month - 1, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function shiftClassMonth(scope: ClassMonthScope, delta: number): ClassMonthScope {
  return normalizeClassMonth({ year: scope.year, month: scope.month + delta });
}

export function classBelongsToMonth(row: EventClassFilterRow, scope: ClassMonthScope) {
  const { start, end } = classMonthBounds(scope);
  return row.date_start >= start && row.date_start <= end;
}

export function filterEventClassesByScope<T extends EventClassFilterRow>(rows: T[], scope: ClassMonthScope, accountIds: string[], expertId?: string, expertName?: string) {
  const normalizedExpertName = expertName?.trim().toLocaleLowerCase("pt-BR");
  return rows.filter((row) => {
    if (!classBelongsToMonth(row, scope)) return false;
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
