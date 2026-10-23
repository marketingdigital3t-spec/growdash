export function throwOnQueryError(error: unknown, context: string) {
  if (!error) return;
  const detail = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || error);
  throw new Error(`${context}: ${detail}`);
}

export function dataHealthScopeKey({ workspaceId, adAccountIds, startDate, endDate }: { workspaceId?: string; adAccountIds: string[]; startDate: string; endDate: string }) {
  return [workspaceId || "none", adAccountIds.slice().sort().join(",") || "all", startDate, endDate].join(":");
}

export function resolveDataHealthState({ isLoading, hasData, error }: { isLoading: boolean; hasData: boolean; error?: unknown }) {
  if (isLoading && !hasData) return "loading" as const;
  if (error && !hasData) return "error" as const;
  return "ready" as const;
}
