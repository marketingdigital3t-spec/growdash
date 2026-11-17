export function sanitizeSelectedAdAccountIds(selectedIds: string[], availableAccounts: { id: string }[]): string[] {
  if (!availableAccounts.length) return selectedIds;
  const availableSet = new Set(availableAccounts.map((acc) => acc.id));
  return selectedIds.filter((id) => availableSet.has(id));
}

export function getUserFiltersStorageKey(baseKey: string, userId: string | null | undefined): string {
  return userId ? `${baseKey}:${userId}` : baseKey;
}
