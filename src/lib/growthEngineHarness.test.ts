import { describe, expect, it } from "vitest";
import { runGrowthReplay, type GrowthReplayScenario } from "./growthEngineHarness";

const base = { spend: 100, impressions: 10000, reach: 6000, clicks: 300, leads: 10, qualifiedLeads: 5, opportunities: 2, sales: 1, revenue: 400, ctr: 3, cpm: 10, cpl: 10, frequency: 1.7 };
const decision = (overrides = {}): GrowthReplayScenario["decision"] => ({ current: base, baseline: base, health: { freshnessMinutes: 10, quality: "confirmed", attributionCoverage: 1 }, referenceCpl: 10, accountDailyBudget: 500, activeTestSpendToday: 0, maxConcurrentTests: 2, activeTests: 0, ...overrides });

describe("growth engine historical replay harness", () => {
  it("covers guardrails and outcomes without calling Meta", () => {
    const scenarios: GrowthReplayScenario[] = [
      { id: "stale", current: base, baseline: base, decision: decision({ health: { freshnessMinutes: 120, quality: "stale", attributionCoverage: 1 } }), hoursRunning: 0, expected: "blocked" },
      { id: "token", current: base, baseline: base, decision: decision({ tokenValid: false }), hoursRunning: 0, expected: "blocked" },
      { id: "policy", current: base, baseline: base, decision: decision({ hasPolicyFailure: true }), hoursRunning: 0, expected: "blocked" },
      { id: "budget", current: base, baseline: base, decision: decision({ accountDailyBudget: 0 }), hoursRunning: 0, expected: "blocked" },
      { id: "loser", current: { ...base, spend: 10, qualifiedLeads: 0, opportunities: 0, sales: 0 }, baseline: base, decision: decision({ current: { ...base, spend: 10, qualifiedLeads: 0, opportunities: 0, sales: 0 } }), hoursRunning: 24, expected: "stop" },
      { id: "winner", current: { ...base, sales: 2, revenue: 800 }, baseline: base, decision: decision({ current: { ...base, sales: 2, revenue: 800 } }), hoursRunning: 72, expected: "promote" },
    ];
    const results = runGrowthReplay(scenarios);
    expect(results.every((result) => result.passed)).toBe(true);
    expect(new Set(results.map((result) => result.idempotencyKey)).size).toBe(results.length);
  });
});
