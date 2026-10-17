import { resolveRDConnection, type RDConnection } from "./rdConnection.ts";

type AdminClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type RDWriteAction = "move_stage" | "update_deal" | "update_contact" | "create_contact";

export type RDWriteInput = {
  admin: AdminClient;
  userId: string;
  connectionId: string;
  action: RDWriteAction;
  target: Record<string, unknown>;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  correlationId: string;
  method: "POST" | "PUT" | "PATCH";
  path: string;
  body?: Record<string, unknown>;
};

export type RDWriteResult = {
  auditId: string;
  skipped: boolean;
  providerStatus?: number;
  providerBody?: unknown;
};

export class RDWriteError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = "RDWriteError";
    this.code = code;
    this.status = status;
  }
}

async function assertWriteAuthorized(admin: AdminClient, userId: string, connectionId: string): Promise<RDConnection> {
  if (!userId || !connectionId) throw new RDWriteError("RD_WRITE_AUTH_REQUIRED", "Usuário e conexão RD são obrigatórios.");
  const connection = await resolveRDConnection(admin, { connectionId }).catch((error) => {
    throw new RDWriteError("RD_CONNECTION_NOT_AUTHORIZED", error instanceof Error ? error.message : "Conexão RD não autorizada.");
  });

  if (!connection.write_enabled) {
    throw new RDWriteError("RD_WRITE_DISABLED", "As escritas no RD estão desativadas para esta conexão.");
  }

  const owner = connection.user_id === userId;
  let workspaceManager = false;
  if (!owner && connection.workspace_id) {
    const { data, error } = await admin.rpc("can_manage_workspace", {
      _workspace_id: connection.workspace_id,
      _user_id: userId,
    });
    if (error) throw new RDWriteError("RD_WRITE_PERMISSION_CHECK_FAILED", "Não foi possível validar a permissão da organização.", 500);
    workspaceManager = data === true;
  }
  if (!owner && !workspaceManager) {
    throw new RDWriteError("RD_WRITE_FORBIDDEN", "Usuário sem permissão para escrever nesta conexão RD.");
  }
  return connection;
}

async function readExistingAudit(admin: AdminClient, connectionId: string, correlationId: string) {
  const { data, error } = await admin
    .from("rd_write_audit")
    .select("id,status,payload_depois,erro")
    .eq("rd_connection_id", connectionId)
    .eq("correlation_id", correlationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function providerUrl(path: string, token: string) {
  if (!path.startsWith("/")) throw new RDWriteError("RD_WRITE_PATH_INVALID", "O caminho do endpoint RD deve começar com '/'.", 500);
  const url = new URL(`https://crm.rdstation.com/api/v1${path}`);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function executeRDWrite(input: RDWriteInput): Promise<RDWriteResult> {
  const connection = await assertWriteAuthorized(input.admin, input.userId, input.connectionId);
  const existing = await readExistingAudit(input.admin, connection.id, input.correlationId);
  if (existing?.status === "success") {
    return { auditId: existing.id, skipped: true };
  }
  if (existing?.status === "pending") {
    throw new RDWriteError("RD_WRITE_IN_PROGRESS", "Esta escrita já está em andamento.", 409);
  }

  let audit: { id: string } | null = null;
  let auditError: unknown = null;
  if (existing) {
    const { data, error } = await input.admin
      .from("rd_write_audit")
      .update({
        usuario_id: input.userId,
        acao: input.action,
        alvo: input.target,
        payload_antes: input.before,
        payload_depois: input.after,
        status: "pending",
        erro: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    audit = data;
    auditError = error;
  } else {
    const { data, error } = await input.admin
      .from("rd_write_audit")
      .insert({
        rd_connection_id: connection.id,
        usuario_id: input.userId,
        acao: input.action,
        alvo: input.target,
        payload_antes: input.before,
        payload_depois: input.after,
        status: "pending",
        correlation_id: input.correlationId,
      })
      .select("id")
      .single();
    audit = data;
    auditError = error;
  }
  if (auditError || !audit?.id) {
    const duplicate = await readExistingAudit(input.admin, connection.id, input.correlationId);
    if (duplicate?.status === "success") return { auditId: duplicate.id, skipped: true };
    throw new RDWriteError("RD_WRITE_AUDIT_FAILED", "Não foi possível registrar a auditoria antes da escrita.", 500);
  }

  let response: Response | null = null;
  let responseBody: unknown = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(providerUrl(input.path, connection.api_token!), {
        method: input.method,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: input.method === "POST" || input.method === "PUT" || input.method === "PATCH"
          ? JSON.stringify(input.body ?? {})
          : undefined,
      });
      responseBody = await response.json().catch(() => null);
      if (response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha de rede ao chamar o RD Station.";
      break;
    }
  }

  if (!response?.ok) {
    const safeError = lastError || `RD Station respondeu HTTP ${response?.status ?? 502}.`;
    await input.admin.from("rd_write_audit").update({ status: "failed", erro: safeError, updated_at: new Date().toISOString() }).eq("id", audit.id);
    throw new RDWriteError("RD_WRITE_PROVIDER_FAILED", safeError, response?.status === 429 ? 429 : 502);
  }

  await input.admin.from("rd_write_audit").update({ status: "success", erro: null, updated_at: new Date().toISOString() }).eq("id", audit.id);
  return { auditId: audit.id, skipped: false, providerStatus: response.status, providerBody: responseBody };
}
