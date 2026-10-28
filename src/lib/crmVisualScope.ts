export function buildCrmVisualScopeKey(input: {
  accountId: string;
  accountIds: string[];
  funnelIds: string[];
  startDate: string | null;
  endDate: string | null;
}) {
  return JSON.stringify({
    account: input.accountId,
    accounts: input.accountIds.slice().sort(),
    funnels: input.funnelIds.slice().sort(),
    startDate: input.startDate,
    endDate: input.endDate,
  });
}
