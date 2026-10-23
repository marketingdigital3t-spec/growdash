import { isHighRiskFinding, type LoopRun } from "./loopEngineeringContract";
import type { GateResult } from "./loopEngineeringRemediation";

export interface RepositoryState {
  clean: boolean;
  synced: boolean;
  manifest: boolean;
}

export function evaluateReleaseGate(run: LoopRun, repository: RepositoryState): GateResult {
  const reasons: string[] = [];
  if (!repository.clean) reasons.push("árvore Git possui alterações não validadas");
  if (!repository.synced) reasons.push("origem Git não está sincronizada");
  if (!repository.manifest) reasons.push("manifesto de assets ausente");
  for (const finding of run.findings) {
    const unresolved = finding.remediation !== "applied" || finding.validation?.status !== "passed";
    if (unresolved) reasons.push(`${isHighRiskFinding(finding) ? "alto risco" : "achado"}: ${finding.title}`);
  }
  return reasons.length ? { status: "blocked", reasons } : { status: "eligible", reasons: [] };
}
