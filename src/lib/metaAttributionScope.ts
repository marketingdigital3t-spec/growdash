type AccountAttributionConfig = {
  id: string;
  attribution_window?: string | null;
};

/** Resolve attribution windows for the exact internal account scope queried. */
export function buildAttributionWindowsByAccount(
  accounts: AccountAttributionConfig[],
  accountIds: Iterable<string>,
): Record<string, string> {
  const allowedIds = new Set(accountIds);
  return Object.fromEntries(
    accounts
      .filter((account) => allowedIds.has(account.id))
      .map((account) => [account.id, account.attribution_window || "account_default"]),
  );
}
