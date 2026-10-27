type AdminClient = {
  from: (table: string) => any;
};

export type RDConnection = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  external_account_id: string | null;
  account_name: string;
  api_token: string | null;
  write_enabled: boolean;
  status: "pending" | "connected" | "blocked" | "partial" | "failed";
  permissions: unknown;
};

export function isRDConnectionReadableByUser(connection: Pick<RDConnection, "user_id" | "workspace_id">, userId: string, activeWorkspaceMember: boolean) {
  if (!userId) return false;
  if (connection.user_id === userId) return true;
  return Boolean(connection.workspace_id && activeWorkspaceMember);
}

export async function resolveRDConnection(
  admin: AdminClient,
  input: { connectionId?: string | null; funnelId?: string | null; userId?: string | null; access?: "read" | "write" },
): Promise<RDConnection> {
  let connectionId = input.connectionId || null;
  let userId = input.userId || null;

  if (!connectionId && input.funnelId) {
    const { data: funnel, error } = await admin
      .from("rd_funnels")
      .select("rd_connection_id,user_id")
      .eq("id", input.funnelId)
      .maybeSingle();
    if (error) throw error;
    connectionId = funnel?.rd_connection_id || null;
    userId = userId || funnel?.user_id || null;
  }

  if (!connectionId) throw new Error("RD_CONNECTION_REQUIRED");

  let query = admin
    .from("rd_account_connections")
    .select("id,user_id,workspace_id,external_account_id,account_name,api_token,status,permissions,write_enabled")
    .eq("id", connectionId);
  // Resolve by connection first, then apply the same workspace membership
  // contract to every read caller. Filtering only by owner excluded delegated
  // users from funnel and activity reads.
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("RD_CONNECTION_NOT_FOUND");
  if (data.status !== "connected" || !data.api_token) throw new Error("RD_CONNECTION_NOT_AUTHORIZED");
  if (userId && data.user_id !== userId) {
    if (!data.workspace_id) throw new Error("RD_CONNECTION_NOT_AUTHORIZED");
    const { data: membership, error: membershipError } = await admin.from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!isRDConnectionReadableByUser(data, userId, Boolean(membership))) throw new Error("RD_CONNECTION_NOT_AUTHORIZED");
    if (input.access === "write") {
      const { data: canEdit, error: editError } = await admin.rpc("can_edit_workspace", { _workspace_id: data.workspace_id, _user_id: userId });
      if (editError) throw editError;
      if (canEdit !== true) throw new Error("RD_CONNECTION_NOT_AUTHORIZED");
    }
  }
  return data as RDConnection;
}

export async function listAuthorizedRDConnections(admin: AdminClient, userIds?: string[]) {
  let query = admin
    .from("rd_account_connections")
    .select("id,user_id,workspace_id,external_account_id,account_name,api_token,status,permissions,write_enabled")
    .eq("status", "connected")
    .not("api_token", "is", null);
  if (userIds?.length) query = query.in("user_id", userIds);
  const { data, error } = await query.order("account_name", { ascending: true });
  if (error) throw error;
  return (data || []) as RDConnection[];
}
