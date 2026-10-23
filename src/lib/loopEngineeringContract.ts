import { createHash } from "node:crypto";

export type LoopMode = "detect" | "repair" | "release";
export type FindingLayer = "frontend" | "backend" | "database" | "integration" | "release";
export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingCategory = "runtime" | "data_availability" | "performance" | "security" | "authorization" | "build" | "test" | "deployment" | "integration";
export type RemediationState = "not_attempted" | "applied" | "blocked" | "not_applicable";
export type ReleaseDecision = "eligible" | "blocked" | "manual_review";

export interface Finding {
  id: string;
  signature: string;
  layer: FindingLayer;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  evidence: Record<string, unknown>;
  reproduction: Record<string, unknown> | null;
  remediation: RemediationState;
  validation: Record<string, unknown> | null;
  releaseDecision: ReleaseDecision;
  rollback: Record<string, unknown> | null;
}

export type FindingInput = Omit<Partial<Finding>, "id" | "signature" | "remediation" | "releaseDecision"> & Pick<Finding, "layer" | "severity" | "category" | "title" | "evidence">;
export type LoopStatus = "detected" | "reproduced" | "repairing" | "validated" | "blocked" | "released" | "failed";
export const LOOP_SCHEMA_VERSION = 1 as const;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function createFinding(input: FindingInput): Finding {
  const identity = stableValue({
    layer: input.layer,
    severity: input.severity,
    category: input.category,
    title: input.title,
    evidence: input.evidence,
    reproduction: input.reproduction ?? null,
  });
  const signature = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  return {
    id: `finding-${signature.slice(0, 16)}`,
    signature,
    layer: input.layer,
    severity: input.severity,
    category: input.category,
    title: input.title,
    evidence: input.evidence,
    reproduction: input.reproduction ?? null,
    remediation: "not_attempted",
    validation: input.validation ?? null,
    releaseDecision: input.releaseDecision ?? "blocked",
    rollback: input.rollback ?? null,
  };
}

export function dedupeFindings(findings: Finding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.signature)) return false;
    seen.add(finding.signature);
    return true;
  });
}

export function isHighRiskFinding(finding: Finding) {
  return finding.severity === "high"
    || finding.severity === "critical"
    || ["database", "security", "authorization", "integration"].includes(finding.layer)
    || finding.category === "security"
    || finding.category === "authorization"
    || /(?:secret|token|webhook|callback|permission|metric|finance|financial|rls|migration)/i.test(`${finding.title} ${JSON.stringify(finding.evidence)}`);
}

export interface LoopRun {
  schemaVersion: typeof LOOP_SCHEMA_VERSION;
  runId: string;
  startedAt: string;
  finishedAt?: string;
  commitSha: string;
  mode: LoopMode;
  status: LoopStatus;
  findings: Finding[];
}

export function createRun(mode: LoopMode, commitSha = "unknown"): LoopRun {
  const startedAt = new Date().toISOString();
  const runId = createHash("sha256").update(`${mode}:${commitSha}:${startedAt}`).digest("hex").slice(0, 24);
  return { schemaVersion: LOOP_SCHEMA_VERSION, runId: `loop_${runId}`, startedAt, commitSha, mode, status: "detected", findings: [] };
}
