import {
  canStartTest,
  detectCreativeHealth,
  experimentIdempotencyKey,
  shouldPromoteTest,
  shouldStopTest,
  type GrowthDecisionInput,
  type GrowthMetricSnapshot,
} from "./growthEngine";

export type GrowthReplayScenario = {
  id: string;
  current: GrowthMetricSnapshot;
  baseline: GrowthMetricSnapshot;
  decision: GrowthDecisionInput;
  hoursRunning: number;
  expected: "blocked" | "continue" | "stop" | "promote";
};

export type GrowthReplayResult = GrowthReplayScenario & {
  actual: "blocked" | "continue" | "stop" | "promote";
  health: ReturnType<typeof detectCreativeHealth>;
  budget: number;
  idempotencyKey: string;
  passed: boolean;
};

export function replayGrowthScenario(scenario: GrowthReplayScenario): GrowthReplayResult {
  const health = detectCreativeHealth(scenario.current, scenario.baseline, scenario.decision.referenceCpl);
  const start = canStartTest(scenario.decision);
  const actual = !start.ok
    ? "blocked"
    : shouldStopTest(scenario.current, start.budget, scenario.decision.referenceCpl, scenario.hoursRunning)
      ? "stop"
      : shouldPromoteTest(scenario.current, scenario.baseline, scenario.decision.referenceCpl, scenario.hoursRunning)
        ? "promote"
        : "continue";

  return {
    ...scenario,
    actual,
    health,
    budget: start.budget,
    idempotencyKey: experimentIdempotencyKey("replay-account", "replay-adset", scenario.id, "replay-window"),
    passed: actual === scenario.expected,
  };
}

export function runGrowthReplay(scenarios: GrowthReplayScenario[]): GrowthReplayResult[] {
  return scenarios.map(replayGrowthScenario);
}
