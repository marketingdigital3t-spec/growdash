import { evaluateReleaseGate } from "./loopEngineeringGates";
import { createRun, createFinding } from "./loopEngineeringContract";

describe("loop engineering release gates", () => {
  it("blocks a run with unresolved high-risk findings", () => {
    const run = createRun("release", "abc");
    run.findings = [createFinding({ layer: "database", severity: "critical", category: "security", title: "RLS", evidence: {} })];
    expect(evaluateReleaseGate(run, { clean: true, synced: true, manifest: true }).status).toBe("blocked");
  });

  it("requires a clean synced repository and asset manifest", () => {
    const run = createRun("release", "abc");
    expect(evaluateReleaseGate(run, { clean: false, synced: true, manifest: true }).status).toBe("blocked");
    expect(evaluateReleaseGate(run, { clean: true, synced: true, manifest: true }).status).toBe("eligible");
  });
});
