import { dedupeFindings, type Finding } from "./loopEngineeringContract";
import { detectCommandFailure, detectDataAvailabilityRegression, type CommandResult } from "./loopEngineeringDetectors";

export type CommandRunner = (command: string) => Promise<CommandResult>;

export type LoopRun = {
  schemaVersion: 1;
  mode: "detect";
  status: "detected" | "failed";
  commitSha: string;
  startedAt: string;
  finishedAt: string;
  findings: Finding[];
};

const allowedCommands = new Set(["npm test", "npm run lint", "npm run build", "npm run test:visual", "git diff --check"]);

export async function runDetectionSuite(args: { commitSha: string; commandRunner: CommandRunner; commands?: string[] }): Promise<LoopRun> {
  const startedAt = new Date().toISOString();
  const findings: Finding[] = [];
  const commands = args.commands ?? Array.from(allowedCommands);
  for (const command of commands) {
    if (!allowedCommands.has(command)) {
      findings.push(...detectDataAvailabilityRegression(`command_not_allowed=${command}`, { route: "runner" }));
      continue;
    }
    const result = await args.commandRunner(command);
    const commandFinding = detectCommandFailure(result, { layer: "release" });
    if (commandFinding) findings.push(commandFinding);
    findings.push(...detectDataAvailabilityRegression(`${result.stdout}\n${result.stderr}`, { route: command }));
  }
  return {
    schemaVersion: 1,
    mode: "detect",
    status: "detected",
    commitSha: args.commitSha,
    startedAt,
    finishedAt: new Date().toISOString(),
    findings: dedupeFindings(findings),
  };
}
