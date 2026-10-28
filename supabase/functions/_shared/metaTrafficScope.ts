export type MetaTrafficScopeAccount = {
  id: string;
  attribution_window?: string | null;
  timezone_name?: string | null;
};

/**
 * Builds the scope metadata returned by the structured Meta traffic tool.
 * Keep this pure so the response contract cannot depend on an out-of-scope
 * variable from the database query loop.
 */
export function buildMetaTrafficScope(
  accounts: readonly MetaTrafficScopeAccount[],
  accountIds: readonly string[],
  campaignIds: readonly string[],
  startDate: string,
  endDate: string,
) {
  return {
    account_ids: [...accountIds],
    campaign_ids: [...campaignIds],
    start_date: startDate,
    end_date: endDate,
    attribution_window_by_account: Object.fromEntries(
      accounts.map((account) => [account.id, account.attribution_window || "account_default"]),
    ),
    timezone_by_account: Object.fromEntries(
      accounts.map((account) => [account.id, account.timezone_name || "America/Sao_Paulo"]),
    ),
  };
}
