type AccountAttributionConfig = {
  id: string;
  attribution_window?: string | null;
};

/** Resolve attribution windows for the exact internal account scope queried. */
export function buildAttributionWindowsByAccount(
  accounts: AccountAttributionConfig[],
  accountIds: Iterable<string>,
  explicitWindow?: string,
): Record<string, string> {
  const allowedIds = new Set(accountIds);
  const override = explicitWindow && explicitWindow !== "account_default" ? explicitWindow : undefined;
  return Object.fromEntries(
    accounts
      .filter((account) => allowedIds.has(account.id))
      .map((account) => [account.id, override || account.attribution_window || "account_default"]),
  );
}
