import { parseArgs, runLoop, sanitizeText } from "../../scripts/loop-engineering.mjs";

describe("loop engineering CLI", () => {
  it("defaults to detect and writes a sanitized report", async () => {
    const args = parseArgs([]);
    const report = await runLoop({ ...args, commands: ["npm test"], runCommand: async () => ({ exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "Authorization: Bearer secret-value" }) });

    expect(args.mode).toBe("detect");
    expect(report.status).toBe("blocked");
    expect(JSON.stringify(report)).not.toContain("secret-value");
  });

  it("redacts secrets before reporting", () => {
    expect(sanitizeText("Authorization: Bearer abc123 access_token=xyz")).toContain("[REDACTED]");
    expect(sanitizeText("Authorization: Bearer abc123 access_token=xyz")).not.toContain("abc123");
  });

  it("applies a complete declarative patch in repair mode", async () => {
    let content = "return 0;";
    const plan = { findingSignatures: ["*"], files: ["src/example.ts"], patches: [{ file: "src/example.ts", expected: "return 0;", replacement: "return undefined;" }], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["text changed"] };
    const report = await runLoop({ mode: "repair", commands: [], plan, fileSystem: { readFile: async () => content, writeFile: async (_file, next) => { content = next; } } });

    expect(report.status).toBe("detected");
    expect(content).toBe("return undefined;");
  });

  it("runs only allowlisted commands declared by a remediation plan", async () => {
    const calls: string[] = [];
    const plan = { findingSignatures: ["*"], files: ["supabase/migrations/fix.sql"], patches: [], commands: ["supabase db advisors"], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["advisor failure"] };
    const report = await runLoop({ mode: "repair", commands: [], plan, fileSystem: { readFile: async () => "migration", writeFile: async () => undefined }, runCommand: async (command) => { calls.push(command); return { exitCode: 0, signal: null, timedOut: false, stdout: "ok", stderr: "" }; } });

    expect(report.status).toBe("detected");
    expect(calls).toEqual(["supabase db advisors"]);
  });
});
