import fs from "node:fs";
import {
  createFinding,
  dedupeFindings,
  isHighRiskFinding,
  type Finding,
} from "./loopEngineeringContract";

describe("loop engineering contract", () => {
  it("promotes main pushes through the protected workflow and closes the Edge smoke loop", () => {
    const workflow = fs.readFileSync(".github/workflows/loop-engineering.yml", "utf8");
    expect(workflow).toMatch(/^\x20{2}push:\n\x20{4}branches:\n\x20{6}- main/m);
    expect(workflow).toMatch(/for fn in controlled-realtime-sync[\s\S]*?\n\s+done\n\n\x20{6}- name: Smoke authenticated production browser/);
    expect(workflow).not.toMatch(/run: npx playwright test[^\n]*\n\s+done/);
    expect(workflow).toContain("supabase link --project-ref cixnvosxqlacjbpymjha");
  });

  it("creates a stable signature from the same finding evidence", () => {
    const first = createFinding({
      layer: "frontend",
      severity: "medium",
      category: "data_availability",
      title: "Timeout virou zero",
      evidence: { route: "/crm", message: "timeout" },
    });
    const second = createFinding({
      layer: "frontend",
      severity: "medium",
      category: "data_availability",
      title: "Timeout virou zero",
      evidence: { route: "/crm", message: "timeout" },
    });

    expect(first.signature).toBe(second.signature);
    expect(first.id).toBe(second.id);
    expect(first.remediation).toBe("not_attempted");
    expect(first.releaseDecision).toBe("blocked");
  });

  it("deduplicates findings by signature while preserving order", () => {
    const first = createFinding({ layer: "build", severity: "low", category: "build", title: "x", evidence: { command: "build" } });
    const duplicate = { ...first, id: "other-id" };
    const other = createFinding({ layer: "test", severity: "medium", category: "test", title: "y", evidence: { command: "test" } });

    expect(dedupeFindings([first, duplicate, other])).toEqual([first, other]);
  });

  it("classifies authorization and security findings as high risk", () => {
    const finding: Finding = createFinding({
      layer: "backend",
      severity: "high",
      category: "authorization",
      title: "Workspace isolation",
      evidence: { table: "rd_deals" },
    });

    expect(isHighRiskFinding(finding)).toBe(true);
  });
});
