import { adAccountAccessKey, filterAuthorizedAdAccounts, type AdAccountRecord } from "../../../src/lib/accountAccess.ts";

type Query = {
  select: (columns: string) => Query;
  eq: (column: string, value: unknown) => Query;
  in: (column: string, values: string[]) => Query;
  maybeSingle: () => Promise<{ data: any; error: any }>;
  order: (column: string, options: { ascending: boolean }) => Promise<{ data: any[] | null; error: any }>;
};

type AdminClient = {
  from: (table: string) => Query;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
};

export async function resolveAuthorizedAdAccounts<T extends AdAccountRecord = AdAccountRecord>(
  admin: AdminClient,
  userId: string,
  options: { accountIds?: string[]; select?: string } = {},
): Promise<T[]> {
  if (!userId) return [];
  const requestedIds = Array.from(new Set((options.accountIds || []).filter(Boolean)));
  let accountQuery = admin.from("ad_accounts").select(options.select || "*");
  if (requestedIds.length) accountQuery = accountQuery.in("id", requestedIds);
  const accountResult = await accountQuery.order("created_at", { ascending: true });
  if (accountResult.error) throw accountResult.error;
  const accounts = (accountResult.data || []) as T[];
  if (!accounts.length) return [];

  const masterResult = await admin.rpc("is_master", { _user_id: userId });
  if (masterResult.error) throw masterResult.error;
  const membershipResult = await admin.from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("workspace_id", { ascending: true });
  if (membershipResult.error) throw membershipResult.error;
  const workspaceIds = Array.from(new Set((membershipResult.data || []).map((row: { workspace_id: string | null }) => row.workspace_id).filter(Boolean))) as string[];
  const managerWorkspaceIds = new Set<string>();
  for (const workspaceId of workspaceIds) {
    const managerResult = await admin.rpc("can_manage_workspace", { _workspace_id: workspaceId, _user_id: userId });
    if (managerResult.error) throw managerResult.error;
    if (managerResult.data === true) managerWorkspaceIds.add(workspaceId);
  }

  let accessQuery = admin.from("user_ad_account_access").select("ad_account_id,workspace_id").eq("user_id", userId);
  if (requestedIds.length) accessQuery = accessQuery.in("ad_account_id", requestedIds);
  const accessResult = await accessQuery.order("ad_account_id", { ascending: true });
  if (accessResult.error) throw accessResult.error;
  const workspaceByAccount = new Map(accounts.map((account) => [account.id, account.workspace_id || null]));
  const accountAccess = new Set<string>((accessResult.data || []).map((row: { ad_account_id: string; workspace_id?: string | null }) => adAccountAccessKey(
    userId,
    row.ad_account_id,
    row.workspace_id === undefined ? workspaceByAccount.get(row.ad_account_id) || null : row.workspace_id,
  )));

  return filterAuthorizedAdAccounts(accounts, {
    userId,
    master: masterResult.data === true,
    managerWorkspaceIds,
    accountAccess,
  });
}
