import { detectBackendSourceRegressions, parseArgs, runLoop, sanitizeText } from "../../scripts/loop-engineering.mjs";

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

  it("detects an Edge Function query that drops backend errors", () => {
    const findings = detectBackendSourceRegressions('Deno.serve(async () => { const { data } = await admin.from("insights").select("*"); return data || []; });', "supabase/functions/example/index.ts");
    expect(findings[0]).toMatchObject({ category: "data_availability", severity: "high", line: 1 });
  });

  it("ignores a query without an empty-collection fallback", () => {
    const findings = detectBackendSourceRegressions('Deno.serve(async () => { const { data: account } = await admin.from("ad_accounts").select("id").maybeSingle(); if (!account) return new Response("not found", { status: 404 }); return Response.json(account); });', "supabase/functions/example/index.ts");
    expect(findings).toEqual([]);
  });

  it("runs backend scanning only when explicitly enabled", async () => {
    const report = await runLoop({ mode: "detect", output: "reports/loop-engineering-cli-backend-opt-in.json", commands: [], backendScan: false, runCommand: async () => ({ exitCode: 0, signal: null, timedOut: false, stdout: "", stderr: "" }) });
    expect(report.findings).toEqual([]);
  });

  it("blocks a release check without real auth state and Sentry credentials", async () => {
    const report = await runLoop({
      mode: "detect",
      output: "reports/loop-engineering-cli-auth-gate.json",
      commands: [],
      authenticatedRuntime: true,
      authStatePath: null,
      sentryRequired: true,
      sentryToken: null,
      runCommand: async () => ({ exitCode: 0, signal: null, timedOut: false, stdout: "", stderr: "" }),
    });
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.category)).toEqual(["authentication", "observability"]);
  });

  it("applies a complete declarative patch in repair mode", async () => {
    let content = "return 0;";
    const fail = { exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "regression" };
    const pass = { exitCode: 0, signal: null, timedOut: false, stdout: "ok", stderr: "" };
    const detected = await runLoop({ mode: "detect", output: "reports/loop-engineering-cli-detect.json", commands: ["npm test"], runCommand: async () => fail });
    const plan = { findingSignatures: [detected.findings[0].signature], files: ["src/example.ts"], patches: [{ file: "src/example.ts", expected: "return 0;", replacement: "return undefined;" }], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["text changed"] };
    const report = await runLoop({ mode: "repair", output: "reports/loop-engineering-cli-repair.json", commands: ["npm test"], plan, runCommand: async (command) => command === "npm test" ? (content.includes("undefined") ? pass : fail) : pass, fileSystem: { readFile: async () => content, writeFile: async (_file, next) => { content = next; } } });

    expect(report.status).toBe("validated");
    expect(content).toBe("return undefined;");
  });

  it("runs only allowlisted commands declared by a remediation plan", async () => {
    const calls: string[] = [];
    const detected = await runLoop({ mode: "detect", output: "reports/loop-engineering-cli-detect-allowlist.json", commands: ["npm test"], runCommand: async () => ({ exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "regression" }) });
    const plan = { findingSignatures: [detected.findings[0].signature], files: ["supabase/migrations/fix.sql"], patches: [], commands: ["supabase db advisors"], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["advisor failure"] };
    let invocation = 0;
    const report = await runLoop({ mode: "repair", output: "reports/loop-engineering-cli-repair-allowlist.json", commands: ["npm test"], plan, fileSystem: { readFile: async () => "migration", writeFile: async () => undefined }, runCommand: async (command) => { invocation += 1; calls.push(command); return { exitCode: command === "npm test" && (invocation === 1 || invocation === 3) ? 1 : 0, signal: null, timedOut: false, stdout: "ok", stderr: "" }; } });

    expect(report.status).toBe("blocked");
    expect(calls).toEqual(["npm test", "supabase db advisors", "npm test"]);
  });

  it("blocks wildcard or unmatched remediation plans", async () => {
    const plan = { findingSignatures: ["*"], files: ["src/example.ts"], patches: [], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["mismatch"] };
    const report = await runLoop({ mode: "repair", output: "reports/loop-engineering-cli-invalid-plan.json", commands: [], plan });
    expect(report.status).toBe("blocked");
    expect(report.findings[0].title).toContain("Plano de remediação inválido");

    const unmatched = await runLoop({ mode: "repair", output: "reports/loop-engineering-cli-unmatched-plan.json", commands: ["npm test"], plan: { ...plan, findingSignatures: ["sha256:not-reproduced"] }, runCommand: async () => ({ exitCode: 0, signal: null, timedOut: false, stdout: "ok", stderr: "" }) });
    expect(unmatched.status).toBe("blocked");
    expect(unmatched.findings[0].title).toContain("Remediação sem achado reproduzido");
  });

  it("rolls back a patch when a declared post-validation test fails", async () => {
    let content = "return 0;";
    const fail = { exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "regression" };
    const detected = await runLoop({ mode: "detect", output: "reports/loop-engineering-cli-detect-rollback.json", commands: ["npm test"], runCommand: async () => fail });
    const plan = { findingSignatures: [detected.findings[0].signature], files: ["src/example.ts"], patches: [{ file: "src/example.ts", expected: "return 0;", replacement: "return 1;" }], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["text changed"] };
    let invocation = 0;
    const report = await runLoop({ mode: "repair", output: "reports/loop-engineering-cli-repair-rollback.json", commands: ["npm test"], plan, runCommand: async () => { invocation += 1; return invocation === 1 ? fail : fail; }, fileSystem: { readFile: async () => content, writeFile: async (_file, next) => { content = next; } } });

    expect(report.status).toBe("blocked");
    expect(report.findings.some((item) => item.title === "Teste pós-remediação falhou")).toBe(true);
    expect(content).toBe("return 0;");
  });

  it("applies multiple patches to the same file from the latest content", async () => {
    let content = "alpha beta";
    const fail = { exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "regression" };
    const detected = await runLoop({ mode: "detect", output: "reports/loop-engineering-cli-detect-multi.json", commands: ["npm test"], runCommand: async () => fail });
    const plan = { findingSignatures: [detected.findings[0].signature], files: ["src/example.ts"], patches: [{ file: "src/example.ts", expected: "alpha", replacement: "A" }, { file: "src/example.ts", expected: "beta", replacement: "B" }], backup: "snapshot", rollback: "restore", tests: ["npm test"], abortWhen: ["text changed"] };
    let invocation = 0;
    const report = await runLoop({ mode: "repair", output: "reports/loop-engineering-cli-repair-multi.json", commands: ["npm test"], plan, runCommand: async () => { invocation += 1; return invocation === 1 ? fail : { exitCode: 0, signal: null, timedOut: false, stdout: "ok", stderr: "" }; }, fileSystem: { readFile: async () => content, writeFile: async (_file, next) => { content = next; } } });

    expect(report.status).toBe("validated");
    expect(content).toBe("A B");
  });
});
