export const SYNC_CONTRACT_VERSION = "sync-v1" as const;

export const SYNC_STATUSES = [
  "running",
  "success",
  "partial",
  "stale",
  "failed",
  "blocked",
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];
export type SyncProvider = "controlled" | "meta" | "meta_leads" | "rd" | "balance" | "daily";

export type SyncAttribution = {
  campaign_id?: string | null;
  campaign_name?: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  form_id?: string | null;
  form_name?: string | null;
  source?: "form" | "conversation" | "unknown" | null;
  platform?: string | null;
  placement?: string | null;
};

export type SyncExecutionOutcome = {
  status?: string | null;
  error?: unknown;
  success?: boolean | null;
  snapshotAvailable?: boolean;
  lastValidSnapshotAt?: string | null;
};

export const SYNC_ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  RATE_LIMITED: "RATE_LIMITED",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  CONTRACT_INVALID: "CONTRACT_INVALID",
  DUPLICATE_EVENT: "DUPLICATE_EVENT",
  SNAPSHOT_PRESERVED: "SNAPSHOT_PRESERVED",
  UNKNOWN: "UNKNOWN",
} as const;

export type SyncErrorCode = (typeof SYNC_ERROR_CODES)[keyof typeof SYNC_ERROR_CODES];

export type SyncFailurePolicy = {
  severity: "low" | "medium" | "high" | "critical";
  owner: "provider" | "integration" | "database" | "contract" | "platform";
  automaticAction: "retry" | "preserve_snapshot" | "dead_letter" | "block_until_reauth" | "block_promotion" | "ignore_duplicate";
  blocksPromotion: boolean;
};

/**
 * Versioned operating policy shared by the agent, replay harness and release
 * loop. A new provider error must be added here before it can be emitted by an
 * Edge Function; this prevents an unclassified failure from being treated as a
 * successful sync.
 */
export const SYNC_FAILURE_POLICIES: Record<SyncErrorCode, SyncFailurePolicy> = {
  AUTH_REQUIRED: { severity: "high", owner: "integration", automaticAction: "block_until_reauth", blocksPromotion: true },
  TOKEN_EXPIRED: { severity: "high", owner: "provider", automaticAction: "block_until_reauth", blocksPromotion: true },
  PERMISSION_DENIED: { severity: "high", owner: "provider", automaticAction: "block_until_reauth", blocksPromotion: true },
  RATE_LIMITED: { severity: "medium", owner: "provider", automaticAction: "retry", blocksPromotion: false },
  PROVIDER_TIMEOUT: { severity: "medium", owner: "provider", automaticAction: "preserve_snapshot", blocksPromotion: false },
  PROVIDER_UNAVAILABLE: { severity: "high", owner: "provider", automaticAction: "preserve_snapshot", blocksPromotion: false },
  CONTRACT_INVALID: { severity: "critical", owner: "contract", automaticAction: "block_promotion", blocksPromotion: true },
  DUPLICATE_EVENT: { severity: "low", owner: "integration", automaticAction: "ignore_duplicate", blocksPromotion: false },
  SNAPSHOT_PRESERVED: { severity: "medium", owner: "database", automaticAction: "preserve_snapshot", blocksPromotion: false },
  UNKNOWN: { severity: "high", owner: "platform", automaticAction: "dead_letter", blocksPromotion: true },
};

export function syncFailurePolicy(errorCode: SyncErrorCode): SyncFailurePolicy {
  return SYNC_FAILURE_POLICIES[errorCode] || SYNC_FAILURE_POLICIES.UNKNOWN;
}

export function isTerminalSyncFailure(status: string | null | undefined): boolean {
  return status === "failed" || status === "blocked";
}

export function redactSyncErrorMessage(value: unknown): string {
  return String(value instanceof Error ? value.message : value || "")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:access_token|token|key|secret)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password)\s*[=:]\s*)[^\s,;&]+/gi, "$1[REDACTED]")
    .slice(0, 2_000);
}

export function normalizeSyncText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /^\{\{[^{}]+\}\}$/.test(text)) return null;
  return text;
}

export function normalizeAttribution<T extends SyncAttribution>(attribution: T): T {
  const normalized = { ...attribution } as T;
  for (const key of [
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "form_id",
    "form_name",
    "platform",
    "placement",
  ] as const) {
    if (key in attribution) {
      (normalized as Record<string, unknown>)[key] = normalizeSyncText(attribution[key]);
    }
  }
  return normalized;
}

export function hasCompleteAttribution(attribution: SyncAttribution): boolean {
  const value = normalizeAttribution(attribution);
  const campaign = value.campaign_id && value.campaign_name;
  const adset = value.adset_id && value.adset_name;
  const ad = value.ad_id && value.ad_name;
  const delivery = value.platform && value.placement;
  const source = value.source === "conversation" || (value.form_id && value.form_name);
  return Boolean(campaign && adset && ad && delivery && source);
}

export function attributionStatus(attribution: SyncAttribution): "captured" | "partial" {
  return hasCompleteAttribution(attribution) ? "captured" : "partial";
}

export function classifySyncStatus(outcome: SyncExecutionOutcome): Exclude<SyncStatus, "running"> {
  const explicit = String(outcome.status || "").toLowerCase();
  if (explicit === "blocked") return "blocked";
  if (explicit === "failed" || explicit === "error") return "failed";
  if (explicit === "stale" || explicit === "stale_snapshot") return "stale";
  if (explicit === "partial") return "partial";
  if (outcome.error || outcome.success === false) {
    return outcome.snapshotAvailable || outcome.lastValidSnapshotAt ? "stale" : "failed";
  }
  return "success";
}

export function buildSyncIdempotencyKey(input: {
  provider: SyncProvider | string;
  accountId?: string | null;
  objectId?: string | null;
  eventId?: string | null;
  scope?: string | null;
}): string {
  return [input.provider, input.accountId, input.objectId, input.eventId, input.scope]
    .map((part) => String(part || "").trim().toLowerCase() || "-")
    .join(":");
}

export function classifySyncErrorCode(error: unknown): SyncErrorCode {
  const text = String(error instanceof Error ? error.message : error || "").toLowerCase();
  if (/401|unauthori[sz]|token.*expir|missing auth/.test(text)) return SYNC_ERROR_CODES.TOKEN_EXPIRED;
  if (/403|forbidden|permission|scope/.test(text)) return SYNC_ERROR_CODES.PERMISSION_DENIED;
  if (/429|#4\b|rate.?limit|application request limit|too many/.test(text)) return SYNC_ERROR_CODES.RATE_LIMITED;
  if (/abort|timeout|timed out|excedeu/.test(text)) return SYNC_ERROR_CODES.PROVIDER_TIMEOUT;
  // PostgREST emits PGRST002 while it cannot reach the database/schema cache.
  // This is a transient data-plane outage and must remain retryable; treating
  // the word "schema" as a contract defect blocks promotion and can dead-letter
  // a valid sync even though no payload contract changed.
  if (/pgrst002|schema cache|could not query the database|connection terminated|database.*(?:unavailable|timeout)/.test(text)) return SYNC_ERROR_CODES.PROVIDER_UNAVAILABLE;
  if (/5\d\d|unavailable|network|fetch failed/.test(text)) return SYNC_ERROR_CODES.PROVIDER_UNAVAILABLE;
  if (/duplicate|idempot/.test(text)) return SYNC_ERROR_CODES.DUPLICATE_EVENT;
  if (/contract|schema|invalid payload/.test(text)) return SYNC_ERROR_CODES.CONTRACT_INVALID;
  if (/snapshot/.test(text)) return SYNC_ERROR_CODES.SNAPSHOT_PRESERVED;
  return SYNC_ERROR_CODES.UNKNOWN;
}
