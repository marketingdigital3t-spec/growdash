import { classifySyncErrorCode, type SyncErrorCode } from "./syncContract.ts";

type MetaSyncResult = {
  error?: unknown;
  data?: { error?: unknown; status?: string | null } | null;
};

function stringifyControlledError(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 1_000);
  try { return JSON.stringify(value).slice(0, 1_000); } catch { return String(value).slice(0, 1_000); }
}

export function controlledSyncErrorMessage(
  functionName: string,
  responseError: unknown,
  payload: Record<string, unknown> | null | undefined,
) {
  const source = responseError ?? payload?.error ?? payload?.errors ?? `${functionName} returned ${String(payload?.status || "an unknown terminal status")}`;
  const code = String(payload?.error_code || classifySyncErrorCode(source) as SyncErrorCode);
  return `${code}: ${stringifyControlledError(source) || `${functionName} failed`}`;
}

/** A partial Insights run may still have persisted useful daily facts. Always
 * attempt the independent action/leads block unless Insights itself failed. */
export function canRunSelectedMetaLeadSync(insights: MetaSyncResult) {
  return !insights.error
    && !insights.data?.error
    && !["failed", "blocked"].includes(String(insights.data?.status || ""));
}

export function selectedMetaSyncIsPartial(insights: MetaSyncResult, leads: MetaSyncResult) {
  const insightsPartial = String(insights.data?.status || "") === "partial";
  const leadsStatus = String(leads.data?.status || (leads.error || leads.data?.error ? "error" : "success"));
  const leadsPartial = ["partial", "failed", "error", "blocked"].includes(leadsStatus);
  return insightsPartial || leadsPartial;
}
