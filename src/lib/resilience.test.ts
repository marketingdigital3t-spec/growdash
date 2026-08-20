import { describe, expect, it } from "vitest";
import { clearRecoveryAttempts, consumeRecoveryAttempt, isRecoverableChunkError, latestBuildRecoveryUrl } from "./resilience";

describe("resilience helpers", () => {
  it("recognizes transient chunk failures after a deploy", () => {
    expect(isRecoverableChunkError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isRecoverableChunkError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(isRecoverableChunkError(new Error("Load failed"))).toBe(true);
    expect(isRecoverableChunkError(new Error("Unable to preload CSS: /assets/page.css"))).toBe(true);
  });

  it("does not classify a normal application error as a cache failure", () => {
    expect(isRecoverableChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("stops recovery attempts before they become a retry loop", () => {
    clearRecoveryAttempts("campaigns");
    expect(consumeRecoveryAttempt("campaigns", 30_000, 2).blocked).toBe(false);
    expect(consumeRecoveryAttempt("campaigns", 30_000, 2).blocked).toBe(false);
    expect(consumeRecoveryAttempt("campaigns", 30_000, 2).blocked).toBe(true);
    clearRecoveryAttempts("campaigns");
  });

  it("limits a stale chunk recovery scope to one automatic attempt", () => {
    clearRecoveryAttempts("chunk:traffic");
    expect(consumeRecoveryAttempt("chunk:traffic", 60_000, 1).blocked).toBe(false);
    expect(consumeRecoveryAttempt("chunk:traffic", 60_000, 1).blocked).toBe(true);
    clearRecoveryAttempts("chunk:traffic");
  });

  it("keeps the active route while cache-busting a stale deployment shell", () => {
    expect(latestBuildRecoveryUrl("https://growdash.com.br/campanhas?account=abc#table", 123)).toBe(
      "https://growdash.com.br/campanhas?account=abc&__gd_build=123#table",
    );
  });
});
