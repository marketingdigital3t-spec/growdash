import { describe, expect, it } from "vitest";
import {
  SYNC_CONTRACT_VERSION,
  attributionStatus,
  buildSyncIdempotencyKey,
  classifySyncErrorCode,
  classifySyncStatus,
  hasCompleteAttribution,
  normalizeAttribution,
  isTerminalSyncFailure,
  redactSyncErrorMessage,
  syncFailurePolicy,
} from "./syncContract";

describe("sync contract", () => {
  it("keeps the version and rejects unresolved macros", () => {
    expect(SYNC_CONTRACT_VERSION).toBe("sync-v1");
    expect(normalizeAttribution({ campaign_name: "{{campaign.name}}", platform: " instagram " })).toEqual({ campaign_name: null, platform: "instagram" });
  });

  it("requires source delivery and the complete Meta hierarchy", () => {
    const complete = { campaign_id: "c1", campaign_name: "Campanha", adset_id: "s1", adset_name: "Conjunto", ad_id: "a1", ad_name: "Anúncio", form_id: "f1", form_name: "Formulário", source: "form" as const, platform: "instagram", placement: "reels" };
    expect(hasCompleteAttribution(complete)).toBe(true);
    expect(attributionStatus({ ...complete, placement: null })).toBe("partial");
    expect(hasCompleteAttribution({ ...complete, source: "conversation", form_id: null, form_name: null })).toBe(true);
  });

  it("classifies terminal and snapshot-preserving outcomes explicitly", () => {
    expect(classifySyncStatus({ status: "blocked" })).toBe("blocked");
    expect(classifySyncStatus({ status: "failed" })).toBe("failed");
    expect(classifySyncStatus({ error: "timeout", lastValidSnapshotAt: "2026-10-26T10:00:00Z" })).toBe("stale");
    expect(classifySyncStatus({ status: "partial" })).toBe("partial");
    expect(classifySyncStatus({ success: true })).toBe("success");
  });

  it("builds stable idempotency keys without inventing identifiers", () => {
    expect(buildSyncIdempotencyKey({ provider: "meta_leads", accountId: "A1", objectId: "L1", eventId: null, scope: "daily" })).toBe("meta_leads:a1:l1:-:daily");
    expect(buildSyncIdempotencyKey({ provider: "meta", accountId: null })).toBe("meta:-:-:-:-");
  });

  it("maps provider failures to actionable codes", () => {
    expect(classifySyncErrorCode("HTTP 429 rate limit")).toBe("RATE_LIMITED");
    expect(classifySyncErrorCode("(#4) Application request limit reached")).toBe("RATE_LIMITED");
    expect(classifySyncErrorCode("HTTP 403 permission denied")).toBe("PERMISSION_DENIED");
    expect(classifySyncErrorCode("AbortError: timeout")).toBe("PROVIDER_TIMEOUT");
    expect(classifySyncErrorCode("PROVIDER_TIMEOUT: Meta excedeu o prazo")).toBe("PROVIDER_TIMEOUT");
  });

  it("keeps the automatic repair policy explicit and fail-closed", () => {
    expect(syncFailurePolicy("RATE_LIMITED")).toMatchObject({ automaticAction: "retry", blocksPromotion: false });
    expect(syncFailurePolicy("CONTRACT_INVALID")).toMatchObject({ severity: "critical", automaticAction: "block_promotion", blocksPromotion: true });
    expect(syncFailurePolicy("UNKNOWN")).toMatchObject({ automaticAction: "dead_letter", blocksPromotion: true });
    expect(isTerminalSyncFailure("failed")).toBe(true);
    expect(isTerminalSyncFailure("blocked")).toBe(true);
    expect(isTerminalSyncFailure("partial")).toBe(false);
    expect(redactSyncErrorMessage("HTTP 401 https://graph.test?access_token=secret Bearer abc")).toContain("[REDACTED]");
    expect(redactSyncErrorMessage("HTTP 401 https://graph.test?access_token=secret Bearer abc")).not.toContain("secret");
  });
});
