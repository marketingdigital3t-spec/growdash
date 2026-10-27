export type AdAccountRecord = {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  name?: string | null;
  account_id?: string | null;
  timezone_name?: string | null;
  attribution_window?: string | null;
  access_token?: string | null;
  connection_status?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type AdAccountAccessContext = {
  userId: string;
  master: boolean;
  managerWorkspaceIds: ReadonlySet<string>;
  /** Keys are `${userId}:${adAccountId}` and are loaded from user_ad_account_access. */
  accountAccess: ReadonlySet<string>;
};

export function adAccountAccessKey(userId: string, accountId: string, workspaceId: string | null = null) {
  return `${userId}:${accountId}:${workspaceId || "null"}`;
}

export function isAdAccountAuthorized(account: AdAccountRecord, context: AdAccountAccessContext) {
  if (account.metadata?.profile_disconnected === true) return false;
  if (context.master || account.user_id === context.userId) return true;
  if (account.workspace_id && context.managerWorkspaceIds.has(account.workspace_id)) return true;
  return context.accountAccess.has(adAccountAccessKey(context.userId, account.id, account.workspace_id));
}

export function filterAuthorizedAdAccounts<T extends AdAccountRecord>(accounts: T[], context: AdAccountAccessContext) {
  return accounts.filter((account) => isAdAccountAuthorized(account, context));
}
