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
  status: "pending" | "connected" | "blocked" | "partial" | "failed";
  permissions: unknown;
};

export async function resolveRDConnection(
  admin: AdminClient,
  input: { connectionId?: string | null; funnelId?: string | null; userId?: string | null },
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
    .select("id,user_id,workspace_id,external_account_id,account_name,api_token,status,permissions")
    .eq("id", connectionId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("RD_CONNECTION_NOT_FOUND");
  if (data.status !== "connected" || !data.api_token) throw new Error("RD_CONNECTION_NOT_AUTHORIZED");
  return data as RDConnection;
}

export async function listAuthorizedRDConnections(admin: AdminClient, userIds?: string[]) {
  let query = admin
    .from("rd_account_connections")
    .select("id,user_id,workspace_id,external_account_id,account_name,api_token,status,permissions")
    .eq("status", "connected")
    .not("api_token", "is", null);
  if (userIds?.length) query = query.in("user_id", userIds);
  const { data, error } = await query.order("account_name", { ascending: true });
  if (error) throw error;
  return (data || []) as RDConnection[];
}
