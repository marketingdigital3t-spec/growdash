export function buildCrmVisualScopeKey(input: {
  accountId: string;
  accountIds: string[];
  startDate: string | null;
  endDate: string | null;
}) {
  return JSON.stringify({
    account: input.accountId,
    accounts: input.accountIds.slice().sort(),
    startDate: input.startDate,
    endDate: input.endDate,
  });
}
