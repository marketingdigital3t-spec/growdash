import { describe, expect, it } from "vitest";
import { createAutomaticRemediationPlan } from "../../scripts/loop-engineering-auto-repair.mjs";
import { runLoop } from "../../scripts/loop-engineering.mjs";

describe("automatic loop engineering remediation", () => {
  it("creates a deterministic frontend plan only for the known timezone regression", () => {
    const plan = createAutomaticRemediationPlan({
      signature: "sig-date",
      title: "Comando falhou: npm test",
      evidence: {
        stderr: "expected 2026-08-10T03:00:00.000Z to deeply equal 2026-08-10T00:00:00.000Z",
      },
    });

    expect(plan?.risk).toBe("low");
    expect(plan?.files).toEqual(["src/hooks/useDateFilter.test.ts"]);
    expect(plan?.patches).toHaveLength(2);
    expect(plan?.findingSignatures).toEqual(["sig-date"]);
  });

  it("does not invent a patch for an unknown backend finding", () => {
    expect(createAutomaticRemediationPlan({
      signature: "sig-backend",
      title: "Consulta Supabase sem tratamento de erro: supabase/functions/example/index.ts",
      evidence: { stderr: "consulta sem tratamento" },
    })).toBeNull();
  });

  it("applies and validates a known plan when auto repair is enabled", async () => {
    let content = [
      "expect(range.startDate).toEqual(new Date(2026, 7, 10, 0, 0, 0, 0));",
      "expect(range.endDate).toEqual(new Date(2026, 7, 12, 23, 59, 59, 999));",
    ].join("\n");
    let calls = 0;
    const report = await runLoop({
      mode: "repair",
      autoRepair: true,
      output: "reports/loop-engineering-auto-repair-test.json",
      commands: ["npm test"],
      runCommand: async () => {
        calls += 1;
        return calls === 1
          ? { exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "expected 2026-08-10T03:00:00.000Z to deeply equal 2026-08-10T00:00:00.000Z" }
          : { exitCode: 0, signal: null, timedOut: false, stdout: "ok", stderr: "" };
      },
      fileSystem: {
        readFile: async () => content,
        writeFile: async (_file, next) => { content = next; },
      },
    });

    expect(report.status).toBe("validated");
    expect(content).toContain('new Date("2026-08-10T00:00:00-03:00")');
    expect(calls).toBe(5);
  });
});
