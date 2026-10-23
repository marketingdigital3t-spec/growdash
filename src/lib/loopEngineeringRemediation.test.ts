import { applyRemediationPlan, validateRemediationPlan, type RemediationPlan } from "./loopEngineeringRemediation";
import { createFinding } from "./loopEngineeringContract";

const finding = createFinding({ layer: "backend", severity: "high", category: "authorization", title: "RLS permissivo", evidence: { table: "rd_deals" } });

describe("loop engineering remediation plans", () => {
  it("blocks a high-risk plan without backup and rollback", () => {
    const plan = { id: "rls-fix", findingSignatures: [finding.signature], files: ["supabase/migrations/fix.sql"], commands: [], tests: ["rls"], risk: "high", backup: "", rollback: "", abortWhen: ["permission mismatch"] } as RemediationPlan;

    expect(validateRemediationPlan(plan, finding).status).toBe("blocked");
  });

  it("accepts a complete high-risk plan and executes only declared files", async () => {
    const plan: RemediationPlan = { id: "rls-fix", findingSignatures: [finding.signature], files: ["supabase/migrations/fix.sql"], commands: ["supabase db advisors"], tests: ["npm test"], risk: "high", backup: "snapshot:rd_deals", rollback: "revert migration fix.sql", abortWhen: ["permission mismatch"] };
    const calls: string[] = [];
    const result = await applyRemediationPlan(plan, {
      run: async (command) => { calls.push(command); return { exitCode: 0, stdout: "ok", stderr: "" }; },
      readFile: async (file) => file === plan.files[0] ? "migration" : "outside",
    });

    expect(validateRemediationPlan(plan, finding).status).toBe("eligible");
    expect(result.status).toBe("applied");
    expect(calls).toEqual(["supabase db advisors"]);
  });

  it("applies a declared patch only when the expected source still matches", async () => {
    const plan: RemediationPlan = { id: "deterministic-fix", findingSignatures: [finding.signature], files: ["src/example.ts"], commands: [], tests: ["npm test"], risk: "high", backup: "snapshot:file", rollback: "restore previous file", abortWhen: ["expected text changed"], patches: [{ file: "src/example.ts", expected: "return 0;", replacement: "return undefined;" }] };
    let content = "return 0;";
    const result = await applyRemediationPlan(plan, {
      run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      readFile: async () => content,
      writeFile: async (_file, next) => { content = next; },
    });

    expect(result.status).toBe("applied");
    expect(content).toBe("return undefined;");
  });
});
