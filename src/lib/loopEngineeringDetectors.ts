import { createFinding, type Finding, type FindingLayer } from "./loopEngineeringContract";

export type CommandResult = {
  command: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export function detectCommandFailure(result: CommandResult, context: { layer: FindingLayer; route?: string }): Finding | null {
  if (!result.timedOut && result.exitCode === 0) return null;
  const timeout = result.timedOut || result.signal === "SIGTERM";
  return createFinding({
    layer: context.layer,
    severity: timeout ? "high" : "medium",
    category: "runtime",
    title: timeout ? `Command timeout: ${result.command}` : `Command failed: ${result.command}`,
    evidence: {
      command: result.command,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      stderr: result.stderr,
      durationMs: result.durationMs,
      ...(context.route ? { route: context.route } : {}),
    },
  });
}

export function detectDataAvailabilityRegression(output: string, context: { route: string }): Finding[] {
  const loading = /(?:status\s*=\s*loading|loading\s*[:=]\s*true)/i.test(output);
  const falseZero = /(?:campaigns|leads|sales|revenue|roas)\s*=\s*0(?:\b|\s)/i.test(output);
  if (!loading || !falseZero) return [];
  return [createFinding({
    layer: "frontend",
    severity: "high",
    category: "data_availability",
    title: "Zero exibido durante loading",
    evidence: { route: context.route, state: "loading", output },
  })];
}
