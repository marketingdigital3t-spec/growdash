import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type Finding = {
  fingerprint: string; severity: "info" | "low" | "medium" | "high" | "critical";
  category: string; source: string; description: string; evidence: Record<string, unknown>;
  account_id?: string; funnel_id?: string;
};

async function resolveCaller(req: Request) {
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const cronHeader = req.headers.get("x-cron-secret");
  const secret = Deno.env.get("AGENT_OFFICE_CRON_SECRET") || Deno.env.get("CRON_SECRET");
  let validCron = Boolean(secret && cronHeader === secret);
  // The scheduled job currently sources its secret from the private sync
  // ledger. Keep that contract valid without exposing the value to clients.
  if (!validCron && cronHeader) {
    const { data: config } = await admin.schema("private").from("daily_incremental_sync_config").select("cron_secret").eq("singleton", true).maybeSingle();
    validCron = Boolean(config?.cron_secret && cronHeader === config.cron_secret);
  }
  if (bearer === serviceKey || validCron) return { kind: "system" as const, userId: null };
  if (!bearer) return null;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
  const { data: { user } } = await caller.auth.getUser();
  return user ? { kind: "owner" as const, userId: user.id } : null;
}

function bucket() { return Math.floor(Date.now() / 900_000).toString(); }

async function ensureAgents(workspace: { id: string; owner_id: string }) {
  const seed = [
    ["ceo", "CEO Orquestrador", { audit: true, dispatch: true, approve: false, deploy: false }],
    ["backend_security", "Dev Backend Segurança", { audit: true, patch_backend: true, deploy: false }],
    ["backend_meta_rd", "Dev Backend Meta/RD", { audit: true, patch_backend: true, deploy: false }],
    ["frontend", "Dev Frontend", { audit: true, patch_frontend: true, deploy: false }],
    ["designer", "Designer", { audit: true, proposal_only: true, deploy: false }],
  ] as const;
  const { data, error: listError } = await admin.from("agent_office_agents").select("id,role").eq("workspace_id", workspace.id);
  if (listError) throw listError;
  const existing = new Set((data || []).map((row: { role: string }) => row.role));
  for (const [role, name, permissions] of seed) {
    if (existing.has(role)) continue;
    const { error } = await admin.from("agent_office_agents").insert({ workspace_id: workspace.id, owner_id: workspace.owner_id, role, name, permissions, config: {} });
    if (error) throw error;
  }
  const { data: agents, error: agentsError } = await admin.from("agent_office_agents").select("id,role,name").eq("workspace_id", workspace.id);
  if (agentsError) throw agentsError;
  return agents || [];
}

async function collectFindings(workspaceId: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const { data: accounts, error: accountsError } = await admin.from("ad_accounts")
    .select("id,name,connection_status,last_sync_success_at,last_sync_error,metadata").eq("workspace_id", workspaceId);
  if (accountsError) findings.push({ fingerprint: `meta-query:${workspaceId}`, severity: "high", category: "meta", source: "ad_accounts", description: "Não foi possível consultar as contas Meta.", evidence: { code: accountsError.code || "QUERY_ERROR" } });
  for (const account of accounts || []) {
    if (account.connection_status === "disconnected") continue;
    if (account.connection_status !== "connected") findings.push({ fingerprint: `meta-status:${account.id}`, severity: "high", category: "meta", source: "ad_accounts", account_id: account.id, description: `Conta Meta ${account.name || account.id} está ${account.connection_status || "sem estado"}.`, evidence: { status: account.connection_status || null, last_error: account.last_error || null } });
    if (account.last_sync_error) findings.push({ fingerprint: `meta-error:${account.id}:${String(account.last_sync_error).slice(0, 80)}`, severity: "medium", category: "meta", source: "ad_accounts", account_id: account.id, description: `A última sincronização da conta Meta registrou erro.`, evidence: { last_error: String(account.last_sync_error).slice(0, 500) } });
  }

  const { data: connections, error: connectionError } = await admin.from("rd_account_connections")
    .select("id,account_name,status,last_success_at,last_error").eq("workspace_id", workspaceId);
  if (connectionError) findings.push({ fingerprint: `rd-query:${workspaceId}`, severity: "high", category: "rd", source: "rd_account_connections", description: "Não foi possível consultar as conexões RD.", evidence: { code: connectionError.code || "QUERY_ERROR" } });
  for (const connection of connections || []) {
    if (connection.status !== "connected") findings.push({ fingerprint: `rd-status:${connection.id}`, severity: "high", category: "rd", source: "rd_account_connections", description: `Conexão RD ${connection.account_name || connection.id} está ${connection.status || "sem estado"}.`, evidence: { status: connection.status || null, last_error: connection.last_error || null } });
  }
  const { data: funnels, error: funnelError } = await admin.from("rd_funnels").select("id,rd_connection_id,name,is_active").eq("workspace_id", workspaceId).eq("is_active", true);
  if (funnelError) findings.push({ fingerprint: `rd-funnels-query:${workspaceId}`, severity: "high", category: "rd", source: "rd_funnels", description: "Não foi possível consultar os funis RD.", evidence: { code: funnelError.code || "QUERY_ERROR" } });
  if (!funnelError && (funnels || []).length === 0) findings.push({ fingerprint: `rd-no-funnels:${workspaceId}`, severity: "info", category: "rd", source: "rd_funnels", description: "Nenhum funil RD ativo foi encontrado para este workspace.", evidence: { count: 0 } });

  // daily_incremental_sync_runs is a global job ledger without workspace_id.
  // Do not project its latest row into a single workspace, which would leak
  // another workspace's sync state into this audit.
  return findings;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const caller = await resolveCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const trigger = caller.kind === "system" ? "cron" : "manual";
  const runKey = trigger === "cron" ? bucket() : `manual-${crypto.randomUUID()}`;
  let workspaceQuery = admin.from("workspaces").select("id,owner_id");
  if (caller.userId) workspaceQuery = workspaceQuery.eq("owner_id", caller.userId);
  const { data: workspaces, error: workspaceError } = await workspaceQuery;
  if (workspaceError) return json({ status: "failed", error: "WORKSPACE_QUERY_FAILED" }, 500);
  const results: Array<Record<string, unknown>> = [];
  for (const workspace of workspaces || []) {
    const { data: existing } = await admin.from("agent_office_runs").select("id,status").eq("workspace_id", workspace.id).eq("lock_key", runKey).maybeSingle();
    if (existing) { results.push({ workspace_id: workspace.id, status: "blocked", reason: "RUN_ALREADY_EXISTS" }); continue; }
    const { data: run, error: runInsertError } = await admin.from("agent_office_runs").insert({ workspace_id: workspace.id, trigger, lock_key: runKey, status: "investigating", metadata: { ai: "blocked", reason: "AI_PROVIDER_NOT_CONFIGURED" } }).select("id").single();
    if (runInsertError || !run) {
      results.push({ workspace_id: workspace.id, status: runInsertError?.code === "23505" ? "blocked" : "failed", reason: runInsertError?.code === "23505" ? "RUN_ALREADY_EXISTS" : "RUN_CREATE_FAILED" });
      continue;
    }
    try {
      const agents = await ensureAgents(workspace);
      const byRole = new Map(agents.map((agent: { id: string; role: string }) => [agent.role, agent.id]));
      const findings = await collectFindings(workspace.id);
      const { data: previousRuns } = await admin.from("agent_office_runs")
        .select("id,status,finished_at")
        .eq("workspace_id", workspace.id)
        .neq("id", run.id)
        .order("started_at", { ascending: false })
        .limit(2);
      const consecutiveFailures = (previousRuns || []).length === 2 && (previousRuns || []).every((item: { status: string }) => ["failed", "partial", "blocked"].includes(item.status));
      if (consecutiveFailures) findings.push({ fingerprint: `three-failures:${workspace.id}:${bucket()}`, severity: "critical", category: "reliability", source: "agent_office_runs", description: "Três ciclos consecutivos do Agent Office falharam ou ficaram parciais.", evidence: { previous_statuses: (previousRuns || []).map((item: { status: string }) => item.status), alert: true } });
      for (const finding of findings) {
        const role = finding.category === "meta" || finding.category === "rd" || finding.category === "sync" ? "backend_meta_rd" : "backend_security";
        const agentId = byRole.get(role) || byRole.get("ceo");
        const { data: saved, error: findingError } = await admin.from("agent_office_findings").upsert({ workspace_id: workspace.id, run_id: run.id, agent_id: agentId, ...finding }, { onConflict: "workspace_id,fingerprint" }).select("id").single();
        if (findingError || !saved) throw findingError || new Error("FINDING_SAVE_FAILED");
        if (agentId) {
          const { error: taskError } = await admin.from("agent_office_tasks").upsert({ workspace_id: workspace.id, run_id: run.id, agent_id: agentId, finding_id: saved.id, task_type: `investigate_${finding.category}`, priority: finding.severity === "critical" ? "critical" : finding.severity === "high" ? "high" : "medium", status: "detected", scope: { account_id: finding.account_id || null, funnel_id: finding.funnel_id || null }, payload: { finding_id: saved.id, description: finding.description } }, { onConflict: "workspace_id,run_id,finding_id" });
          if (taskError) throw taskError;
        }
      }
      const status = findings.some((finding) => finding.severity === "critical" || finding.severity === "high") ? "partial" : "success";
      const { error: finishError } = await admin.from("agent_office_runs").update({ status, finished_at: new Date().toISOString(), summary: findings.length ? `${findings.length} achado(s) registrados; IA bloqueada por configuração ausente.` : "Verificações determinísticas concluídas; IA bloqueada por configuração ausente." }).eq("id", run.id);
      if (finishError) throw finishError;
      results.push({ workspace_id: workspace.id, run_id: run.id, status, findings: findings.length, ai: "blocked" });
    } catch (error) {
      await admin.from("agent_office_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_code: "ORCHESTRATOR_ERROR", summary: "Falha interna registrada sem expor detalhes sensíveis." }).eq("id", run.id);
      results.push({ workspace_id: workspace.id, run_id: run.id, status: "failed", error: (error as Error).message.slice(0, 160) });
    }
  }
  return json({ status: results.some((result) => result.status === "failed") ? "failed" : results.some((result) => result.status === "partial") ? "partial" : "success", results });
});
