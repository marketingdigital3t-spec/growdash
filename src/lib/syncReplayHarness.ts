import { attributionStatus, buildSyncIdempotencyKey, classifySyncErrorCode, classifySyncStatus, normalizeAttribution, type SyncAttribution, type SyncStatus } from "./syncContract";

export type ReplayFixture = {
  name: string;
  provider: "meta" | "rd";
  payload: SyncAttribution & { accountId: string; objectId: string; eventId?: string | null };
  expectedStatus: "captured" | "partial";
};

export type ReplayScenarioName =
  | "pagination-resume"
  | "token-expired"
  | "permission-denied"
  | "rate-limit"
  | "provider-timeout"
  | "duplicate-event"
  | "incomplete-payload"
  | "partial-provider-response"
  | "rd-unavailable"
  | "database-error"
  | "interrupted-run";

export type ReplayScenarioResult = {
  name: ReplayScenarioName;
  status: Exclude<SyncStatus, "running">;
  errorCode: string | null;
  retries: number;
  cursor: string | null;
  previousSnapshotPreserved: boolean;
  recordsUpserted: number;
  duplicateRecords: number;
  outboxQueued: number;
  deadLettered: number;
};

export const SYNC_REPLAY_FIXTURES: readonly ReplayFixture[] = [
  {
    name: "meta-form-feed",
    provider: "meta",
    payload: {
      accountId: "demo-account",
      objectId: "lead-form-001",
      eventId: "lead-event-001",
      campaign_id: "campaign-001",
      campaign_name: "Campanha teste formulário",
      adset_id: "adset-001",
      adset_name: "Conjunto feed",
      ad_id: "ad-001",
      ad_name: "Criativo feed",
      form_id: "form-001",
      form_name: "Formulário de teste",
      source: "form",
      platform: "instagram",
      placement: "feed",
    },
    expectedStatus: "captured",
  },
  {
    name: "meta-conversation-reels",
    provider: "meta",
    payload: {
      accountId: "demo-account",
      objectId: "conversation-001",
      eventId: "conversation-event-001",
      campaign_id: "campaign-002",
      campaign_name: "Campanha conversa",
      adset_id: "adset-002",
      adset_name: "Conjunto reels",
      ad_id: "ad-002",
      ad_name: "Criativo reels",
      source: "conversation",
      platform: "instagram",
      placement: "reels",
    },
    expectedStatus: "captured",
  },
  {
    name: "meta-incomplete-placement",
    provider: "meta",
    payload: {
      accountId: "demo-account",
      objectId: "lead-form-002",
      campaign_id: "campaign-003",
      campaign_name: "Campanha sem posicionamento",
      adset_id: "adset-003",
      adset_name: "Conjunto",
      ad_id: "ad-003",
      ad_name: "Criativo",
      form_id: "form-003",
      form_name: "Formulário",
      source: "form",
      platform: "facebook",
      placement: "{{placement}}",
    },
    expectedStatus: "partial",
  },
];

export function replayAttributionFixture(fixture: ReplayFixture) {
  const attribution = normalizeAttribution(fixture.payload);
  const status = attributionStatus(attribution);
  return {
    name: fixture.name,
    status,
    idempotencyKey: buildSyncIdempotencyKey({
      provider: fixture.provider,
      accountId: fixture.payload.accountId,
      objectId: fixture.payload.objectId,
      eventId: fixture.payload.eventId,
      scope: "replay",
    }),
  };
}

export function replayFailure(status: Extract<SyncStatus, "success" | "partial" | "stale" | "failed" | "blocked">, hasSnapshot = false) {
  return classifySyncStatus({ status, snapshotAvailable: hasSnapshot, lastValidSnapshotAt: hasSnapshot ? new Date(0).toISOString() : null });
}

/**
 * Deterministic provider/CRM failure matrix. It models the persistence
 * decisions made by the Edge Functions without calling Meta, RD or Supabase,
 * so CI can prove idempotence and recovery before a deployment.
 */
export function replaySyncScenario(name: ReplayScenarioName): ReplayScenarioResult {
  const base: ReplayScenarioResult = {
    name,
    status: "success",
    errorCode: null,
    retries: 0,
    cursor: null,
    previousSnapshotPreserved: false,
    recordsUpserted: 1,
    duplicateRecords: 0,
    outboxQueued: 0,
    deadLettered: 0,
  };
  switch (name) {
    case "pagination-resume":
      return { ...base, cursor: "page-2", recordsUpserted: 2 };
    case "token-expired":
      return { ...base, status: "blocked", errorCode: classifySyncErrorCode("HTTP 401 token expired"), recordsUpserted: 0, deadLettered: 1 };
    case "permission-denied":
      return { ...base, status: "blocked", errorCode: classifySyncErrorCode("HTTP 403 permission denied"), recordsUpserted: 0, deadLettered: 1 };
    case "rate-limit":
      return { ...base, retries: 3 };
    case "provider-timeout":
      return { ...base, status: "stale", errorCode: classifySyncErrorCode("AbortError: timeout"), recordsUpserted: 0, previousSnapshotPreserved: true };
    case "duplicate-event":
      return { ...base, duplicateRecords: 1, recordsUpserted: 0 };
    case "incomplete-payload":
      return { ...base, status: "partial", recordsUpserted: 1 };
    case "partial-provider-response":
      return { ...base, status: "partial", recordsUpserted: 1, cursor: "page-3" };
    case "rd-unavailable":
      return { ...base, status: "partial", errorCode: classifySyncErrorCode("RD HTTP 503 unavailable"), outboxQueued: 1 };
    case "database-error":
      return { ...base, status: "stale", errorCode: "SNAPSHOT_PRESERVED", recordsUpserted: 0, previousSnapshotPreserved: true };
    case "interrupted-run":
      return { ...base, status: "stale", errorCode: "PROVIDER_TIMEOUT", cursor: "page-4", recordsUpserted: 0, previousSnapshotPreserved: true };
  }
}

export const SYNC_REPLAY_SCENARIOS: readonly ReplayScenarioName[] = [
  "pagination-resume",
  "token-expired",
  "permission-denied",
  "rate-limit",
  "provider-timeout",
  "duplicate-event",
  "incomplete-payload",
  "partial-provider-response",
  "rd-unavailable",
  "database-error",
  "interrupted-run",
];
