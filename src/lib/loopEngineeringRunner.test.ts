import { runDetectionSuite, type CommandRunner } from "./loopEngineeringRunner";

describe("loop engineering runner", () => {
  it("runs allowed checks sequentially and keeps their results", async () => {
    const order: string[] = [];
    const commandRunner: CommandRunner = async (command) => {
      order.push(command);
      return { command, exitCode: 0, signal: null, timedOut: false, stdout: "ok", stderr: "", durationMs: 1 };
    };

    const run = await runDetectionSuite({ commitSha: "abc123", commandRunner, commands: ["npm test", "npm run build"] });

    expect(order).toEqual(["npm test", "npm run build"]);
    expect(run.commitSha).toBe("abc123");
    expect(run.status).toBe("detected");
    expect(run.findings).toEqual([]);
  });
});
