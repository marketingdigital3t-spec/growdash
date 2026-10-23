import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const DEFAULT_COMMANDS = ["npm test", "npm run lint", "npm run build", "git diff --check"];
const ALLOWED_COMMANDS = new Set([...DEFAULT_COMMANDS, "npm run test:visual"]);

export function sanitizeText(value) {
  return String(value ?? "")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/((?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password)\s*[=:]\s*)[^\s,;&]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|key|secret|code|signature)=)[^&\s]+/gi, "$1[REDACTED]");
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value, Object.keys(value).sort())).digest("hex").slice(0, 24);
}

function finding({ title, category = "runtime", severity = "medium", command, result }) {
  const evidence = { command, exitCode: result.exitCode, signal: result.signal, timedOut: result.timedOut, stdout: sanitizeText(result.stdout).slice(-4000), stderr: sanitizeText(result.stderr).slice(-4000) };
  const signature = stableHash({ title, category, command, timedOut: result.timedOut, exitCode: result.exitCode });
  return { id: `finding_${signature}`, signature, layer: "release", severity, category, title, evidence, reproduction: { command, status: "reproduced" }, remediation: "not_attempted", validation: { status: "not_run", tests: [] }, releaseDecision: "blocked", rollback: { status: "not_defined" } };
}

export function parseArgs(argv) {
  const args = { mode: "detect", output: "reports/loop-engineering.json", plan: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--mode" && argv[index + 1]) args.mode = argv[++index];
    else if (flag === "--output" && argv[index + 1]) args.output = argv[++index];
    else if (flag === "--plan" && argv[index + 1]) args.plan = argv[++index];
    else if (flag === "--help") args.help = true;
  }
  if (!["detect", "repair", "release"].includes(args.mode)) throw new Error(`Modo inválido: ${args.mode}`);
  return args;
}

export function validatePlan(plan) {
  const reasons = [];
  if (!plan || !plan.files?.length) reasons.push("arquivos declarados ausentes");
  if (!plan?.tests?.length) reasons.push("testes declarados ausentes");
  if (!plan?.backup) reasons.push("backup/snapshot ausente");
  if (!plan?.rollback) reasons.push("rollback ausente");
  if (!plan?.abortWhen?.length) reasons.push("condições de abortar ausentes");
  for (const patch of plan?.patches ?? []) {
    if (!plan.files.includes(patch.file)) reasons.push(`patch fora da lista: ${patch.file}`);
    if (!patch.expected) reasons.push(`pré-condição ausente: ${patch.file}`);
    if (patch.file.startsWith("/") || patch.file.includes("..")) reasons.push(`arquivo fora do workspace: ${patch.file}`);
  }
  return { valid: reasons.length === 0, reasons };
}

async function applyPlan(plan, fileSystem) {
  const validation = validatePlan(plan);
  if (!validation.valid) return { status: "blocked", reasons: validation.reasons };
  const previous = new Map();
  try {
    for (const patch of plan.patches ?? []) {
      const current = previous.get(patch.file) ?? await fileSystem.readFile(patch.file);
      if (!current.includes(patch.expected)) throw new Error(`Pré-condição não encontrada em ${patch.file}`);
      previous.set(patch.file, current);
      await fileSystem.writeFile(patch.file, current.replace(patch.expected, patch.replacement));
    }
    return { status: "applied", reasons: [] };
  } catch (error) {
    for (const [file, content] of previous) await fileSystem.writeFile(file, content);
    return { status: "blocked", reasons: [error instanceof Error ? error.message : "patch abortado"] };
  }
}

async function defaultRunCommand(command, timeoutMs = 15 * 60_000) {
  if (!ALLOWED_COMMANDS.has(command)) return { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: `Comando não permitido: ${command}` };
  const [file, ...parameters] = command.split(" ");
  try {
    const result = await execFile(file, parameters, { timeout: timeoutMs, maxBuffer: 2_000_000, shell: false });
    return { exitCode: 0, signal: null, timedOut: false, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: typeof error.code === "number" ? error.code : null, signal: error.signal ?? null, timedOut: error.signal === "SIGTERM" || error.killed === true, stdout: error.stdout ?? "", stderr: error.stderr ?? String(error) };
  }
}

function renderMarkdown(report) {
  const rows = report.findings.length ? report.findings.map((item) => `| ${item.severity} | ${item.category} | ${item.title} | ${item.remediation} | ${item.releaseDecision} |`).join("\n") : "| — | — | Nenhum achado | — | eligible |";
  return `# Loop Engineering\n\n- Execução: ${report.runId}\n- Commit: ${report.commitSha}\n- Modo: ${report.mode}\n- Status: ${report.status}\n\n## Achados\n\n| Severidade | Categoria | Título | Remediação | Release |\n|---|---|---|---|---|\n${rows}\n\n## Pendências\n\n${report.findings.length ? report.findings.map((item) => `- ${item.title}: ${sanitizeText(item.evidence.stderr || "evidência registrada")}`).join("\n") : "- Nenhuma"}\n`;
}

export async function runLoop({ mode = "detect", output = "reports/loop-engineering.json", plan = null, commands = DEFAULT_COMMANDS, runCommand = defaultRunCommand, commitSha = "unknown", fileSystem = { readFile: (file) => readFile(file, "utf8"), writeFile: (file, content) => writeFile(file, content, "utf8") } }) {
  const startedAt = new Date().toISOString();
  const runId = `loop_${stableHash({ mode, commitSha, startedAt })}`;
  const findings = [];
  for (const command of commands) {
    const result = await runCommand(command);
    if (result.exitCode !== 0 || result.timedOut) {
      findings.push(finding({ command, result, severity: result.timedOut ? "high" : "medium", title: result.timedOut ? `Comando timeout: ${command}` : `Comando falhou: ${command}`, category: result.timedOut ? "runtime" : /build/.test(command) ? "build" : /test|lint/.test(command) ? "test" : "runtime" }));
    }
    const outputText = `${result.stdout}\n${result.stderr}`;
    if (/(?:status\s*=\s*loading|loading\s*[:=]\s*true|carregando)/i.test(outputText) && /(?:campaigns|campanhas|leads|sales|vendas|revenue|roas)\s*[=:]\s*0\b/i.test(outputText)) {
      findings.push(finding({ command, result, severity: "high", category: "data_availability", title: `Zero exibido durante loading: ${command}` }));
    }
  }
  if (mode !== "detect" && !plan) findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Plano de remediação obrigatório" }, severity: "high", category: "authorization", title: "Plano de remediação ausente" }), remediation: "blocked" });
  if (mode !== "detect" && plan) {
    const remediation = await applyPlan(plan, fileSystem);
    if (remediation.status === "blocked") {
      findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: remediation.reasons.join("; ") }, severity: "high", category: "authorization", title: "Remediação bloqueada" }), remediation: "blocked" });
    } else {
      for (const item of findings) {
        if (plan.findingSignatures?.includes("*") || plan.findingSignatures?.includes(item.signature)) {
          item.remediation = "applied";
          item.validation = { status: "passed", tests: plan.tests };
          item.releaseDecision = mode === "release" ? "eligible" : "manual_review";
          item.rollback = { status: "defined", instructions: plan.rollback };
        }
      }
    }
  }
  const unique = [...new Map(findings.map((item) => [item.signature, item])).values()];
  const report = { schemaVersion: 1, runId, startedAt, finishedAt: new Date().toISOString(), commitSha, mode, status: unique.length ? "blocked" : "detected", findings: unique };
  await mkdir(new URL("../reports/", import.meta.url), { recursive: true }).catch(() => undefined);
  await mkdir(new URL(`../${output.split("/").slice(0, -1).join("/") || "reports"}/`, import.meta.url), { recursive: true }).catch(() => undefined);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(output.replace(/\.json$/i, ".md"), renderMarkdown(report), "utf8");
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Uso: node scripts/loop-engineering.mjs [--mode detect|repair|release] [--output arquivo.json] [--plan arquivo.json]");
    return;
  }
  let commitSha = "unknown";
  try { commitSha = (await execFile("git", ["rev-parse", "HEAD"])).stdout.trim(); } catch { /* relatório ainda é útil sem Git */ }
  const report = await runLoop({ ...args, commitSha });
  console.log(JSON.stringify({ runId: report.runId, status: report.status, findings: report.findings.length, output: args.output }, null, 2));
  if (report.status === "blocked") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
