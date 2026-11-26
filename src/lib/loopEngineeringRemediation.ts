import { isHighRiskFinding, type Finding } from "./loopEngineeringContract";

export type RemediationRisk = "low" | "medium" | "high" | "critical";

export interface RemediationPlan {
  id: string;
  findingSignatures: string[];
  files: string[];
  commands: string[];
  tests: string[];
  risk: RemediationRisk;
  backup: string;
  rollback: string;
  abortWhen: string[];
  patches?: Array<{ file: string; expected: string; replacement: string }>;
}

export interface GateResult {
  status: "eligible" | "blocked" | "manual_review";
  reasons: string[];
}

export function validateRemediationPlan(plan: RemediationPlan, finding: Finding): GateResult {
  const reasons: string[] = [];
  if (!plan || !plan.id) reasons.push("plano sem id");
  if (!plan?.findingSignatures?.includes(finding.signature)) reasons.push("assinatura não pertence ao plano");
  if (!plan?.files?.length) reasons.push("nenhum arquivo declarado");
  if (!plan?.tests?.length) reasons.push("nenhum teste declarado");
  if (!plan?.abortWhen?.length) reasons.push("condições de abortar ausentes");
  if ((isHighRiskFinding(finding) || ["high", "critical"].includes(plan?.risk)) && !plan?.backup) reasons.push("backup/snapshot ausente");
  if ((isHighRiskFinding(finding) || ["high", "critical"].includes(plan?.risk)) && !plan?.rollback) reasons.push("rollback ausente");
  return reasons.length ? { status: "blocked", reasons } : { status: "eligible", reasons: [] };
}

export interface RemediationIO {
  run(command: string): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readFile(file: string): Promise<string>;
  writeFile?: (file: string, content: string) => Promise<void>;
}

const ALLOWED_COMMANDS = new Set(["npm test", "npm run lint", "npm run build", "npm run test:visual", "git diff --check", "supabase db advisors", "supabase migration list", "supabase db push --dry-run"]);

export async function applyRemediationPlan(plan: RemediationPlan, io: RemediationIO) {
  const results: Array<{ command: string; exitCode: number; stdout: string; stderr: string }> = [];
  for (const command of plan.commands) {
    if (!ALLOWED_COMMANDS.has(command)) return { status: "blocked" as const, results, reason: `Comando não permitido: ${command}` };
    const result = await io.run(command);
    results.push({ command, ...result });
    if (result.exitCode !== 0) return { status: "blocked" as const, results, reason: `Comando falhou: ${command}` };
  }
  for (const file of plan.files) {
    if (!file || file.startsWith("/") || file.includes("..")) return { status: "blocked" as const, results, reason: `Arquivo fora do workspace: ${file}` };
    await io.readFile(file);
  }
  if (plan.patches?.length) {
    if (!io.writeFile) return { status: "blocked" as const, results, reason: "writeFile não configurado" };
    const previous = new Map<string, string>();
    try {
      for (const patch of plan.patches) {
        if (!plan.files.includes(patch.file) || patch.file.startsWith("/") || patch.file.includes("..")) return { status: "blocked" as const, results, reason: `Patch fora da lista: ${patch.file}` };
        const current = previous.get(patch.file) ?? await io.readFile(patch.file);
        if (!current.includes(patch.expected)) throw new Error(`Pré-condição não encontrada em ${patch.file}`);
        previous.set(patch.file, current);
        await io.writeFile(patch.file, current.replace(patch.expected, patch.replacement));
      }
    } catch (error) {
      for (const [file, content] of previous) await io.writeFile(file, content);
      return { status: "blocked" as const, results, reason: error instanceof Error ? error.message : "patch abortado" };
    }
  }
  return { status: "applied" as const, results };
}
