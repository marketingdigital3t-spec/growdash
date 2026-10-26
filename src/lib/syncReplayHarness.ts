import { attributionStatus, buildSyncIdempotencyKey, classifySyncStatus, normalizeAttribution, type SyncAttribution, type SyncStatus } from "./syncContract";

export type ReplayFixture = {
  name: string;
  provider: "meta" | "rd";
  payload: SyncAttribution & { accountId: string; objectId: string; eventId?: string | null };
  expectedStatus: "captured" | "partial";
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
