import { classifySyncErrorCode, classifySyncStatus, SYNC_CONTRACT_VERSION, type SyncProvider, type SyncStatus } from "../../../src/lib/syncContract.ts";
import { captureSyncSentryEvent } from "./sentrySync.ts";

export type SyncExecutionContext = {
  userId?: string | null;
  provider: SyncProvider;
  triggerSource: string;
  scopeKey: string;
  scope?: Record<string, unknown>;
  codeVersion?: string | null;
};

export async function startSyncExecution(admin: any, context: SyncExecutionContext): Promise<string | null> {
  try {
    const { data, error } = await admin.from("sync_execution_runs").insert({
      user_id: context.userId || null,
      provider: context.provider,
      trigger_source: context.triggerSource,
      scope_key: context.scopeKey,
      scope: context.scope || {},
      contract_version: SYNC_CONTRACT_VERSION,
      code_version: context.codeVersion || Deno.env.get("GIT_SHA") || null,
      status: "running",
    }).select("id").single();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  } catch (error) {
    console.error("sync_execution_start_failed", { provider: context.provider, scope_key: context.scopeKey, error: String(error).slice(0, 500) });
    await captureSyncSentryEvent({
      provider: context.provider,
      status: "failed",
      errorCode: classifySyncErrorCode(error),
      errorMessage: String(error),
      triggerSource: context.triggerSource,
      scopeKey: context.scopeKey,
      codeVersion: context.codeVersion || Deno.env.get("GIT_SHA"),
    });
    return null;
  }
}

export async function finishSyncExecution(admin: any, syncRunId: string | null, outcome: {
  status?: string | null;
  success?: boolean | null;
  error?: unknown;
  warnings?: unknown;
  lastValidSnapshotAt?: string | null;
  retryCount?: number;
  recordsRead?: number;
  recordsUpserted?: number;
}) {
  if (!syncRunId) return;
  const status = classifySyncStatus(outcome);
  const errorCode = outcome.error ? classifySyncErrorCode(outcome.error) : null;
  let executionContext: any = null;
  try {
    const { data } = await admin.from("sync_execution_runs").select("provider,trigger_source,scope_key,code_version,started_at").eq("id", syncRunId).maybeSingle();
    executionContext = data || null;
  } catch {
    // The terminal update remains authoritative even if context enrichment is unavailable.
  }
  console.log("sync_execution_finished", {
    sync_run_id: syncRunId,
    status,
    error_code: errorCode,
    contract_version: SYNC_CONTRACT_VERSION,
    retry_count: Number(outcome.retryCount || 0),
    records_read: Number(outcome.recordsRead || 0),
    records_upserted: Number(outcome.recordsUpserted || 0),
  });
  try {
    const { error } = await admin.from("sync_execution_runs").update({
      status,
      finished_at: new Date().toISOString(),
      last_valid_snapshot_at: outcome.lastValidSnapshotAt || null,
      retry_count: Math.max(0, Number(outcome.retryCount || 0)),
      records_read: Math.max(0, Number(outcome.recordsRead || 0)),
      records_upserted: Math.max(0, Number(outcome.recordsUpserted || 0)),
      error_code: errorCode,
      error_message: outcome.error ? String(outcome.error).slice(0, 2_000) : null,
      warnings: Array.isArray(outcome.warnings) ? outcome.warnings.slice(0, 50) : outcome.warnings ? [outcome.warnings] : [],
    }).eq("id", syncRunId);
    if (error) throw error;
  } catch (error) {
    console.error("sync_execution_finish_failed", { sync_run_id: syncRunId, error: String(error).slice(0, 500) });
  }
  if (status !== "success") {
    await captureSyncSentryEvent({
      syncRunId,
      provider: executionContext?.provider || "unknown",
      status,
      errorCode,
      errorMessage: outcome.error ? String(outcome.error) : null,
      triggerSource: executionContext?.trigger_source || null,
      scopeKey: executionContext?.scope_key || null,
      codeVersion: executionContext?.code_version || Deno.env.get("GIT_SHA"),
      durationMs: executionContext?.started_at ? Math.max(0, Date.now() - new Date(executionContext.started_at).getTime()) : null,
      retryCount: outcome.retryCount,
      recordsRead: outcome.recordsRead,
      recordsUpserted: outcome.recordsUpserted,
    });
  }
}

export function aggregateSyncStatus(statuses: Array<string | null | undefined>): Exclude<SyncStatus, "running"> {
  const normalized = statuses.map((status) => String(status || "").toLowerCase());
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("failed") || normalized.includes("error")) return "failed";
  if (normalized.includes("partial")) return "partial";
  if (normalized.includes("stale") || normalized.includes("stale_snapshot")) return "stale";
  return "success";
}
