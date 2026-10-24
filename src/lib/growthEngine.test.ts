import { describe, expect, it } from "vitest";
import { canStartTest, detectCreativeHealth, deriveTestBudget, experimentIdempotencyKey, qualityScore, shouldPromoteTest, shouldStopTest } from "./growthEngine";

const base = { spend: 100, impressions: 10000, reach: 6000, clicks: 300, leads: 10, qualifiedLeads: 5, opportunities: 2, sales: 1, revenue: 400, ctr: 3, cpm: 10, cpl: 10, frequency: 1.7 };

describe("growth engine rules", () => {
  it("weights downstream funnel outcomes above raw lead volume", () => {
    expect(qualityScore({ ...base, leads: 20, qualifiedLeads: 1, opportunities: 0, sales: 0, cpl: 5 }, 10)).toBeLessThan(qualityScore(base, 10));
  });

  it("detects fatigue from CTR, CPM and frequency changes", () => {
    const result = detectCreativeHealth({ ...base, ctr: 2, cpm: 14, cpl: 14, frequency: 3.2 }, base, 10);
    expect(result.deteriorating).toBe(true);
    expect(result.frequencyRisk).toBe(true);
  });

  it("limits each test to one reference CPL and the account cap", () => {
    expect(deriveTestBudget(40, 500, 0)).toBe(40);
    expect(deriveTestBudget(40, 200, 15)).toBe(5);
  });

  it("blocks tests on stale or incomplete attribution", () => {
    const result = canStartTest({ current: base, baseline: base, health: { freshnessMinutes: 120, quality: "stale", attributionCoverage: 1 }, referenceCpl: 10, accountDailyBudget: 500, activeTestSpendToday: 0, maxConcurrentTests: 2, activeTests: 0 });
    expect(result).toEqual({ ok: false, reason: "stale_snapshot", budget: 10 });
  });

  it("stops unproductive tests and promotes quality winners only after 72 hours", () => {
    expect(shouldStopTest({ ...base, spend: 10, qualifiedLeads: 0, opportunities: 0, sales: 0 }, 10, 10, 24)).toBe(true);
    expect(shouldPromoteTest({ ...base, sales: 2, revenue: 800 }, base, 10, 72)).toBe(true);
    expect(shouldPromoteTest(base, base, 10, 48)).toBe(false);
  });

  it("creates stable idempotency keys", () => {
    expect(experimentIdempotencyKey("a", "b", "Hook Novo", "2026-10-23")).toBe("a:b:hook novo:2026-10-23");
  });
});
