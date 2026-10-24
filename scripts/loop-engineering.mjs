import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const DEFAULT_COMMANDS = ["npm test", "npm run lint", "npm run build", "npm run test:visual", "git diff --check"];
const ALLOWED_COMMANDS = new Set([...DEFAULT_COMMANDS, "npm run test:visual"]);
const ALLOWED_PLAN_COMMANDS = new Set([...ALLOWED_COMMANDS, "supabase db advisors", "supabase migration list", "supabase db push --dry-run"]);

export function sanitizeText(value) {
  return String(value ?? "")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/((?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password)\s*[=:]\s*)[^\s,;&]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|key|secret|code|signature)=)[^&\s]+/gi, "$1[REDACTED]");
}

export function detectBackendSourceRegressions(source, file) {
  const findings = [];
  const lines = String(source ?? "").split("\n");
  if (!/Deno\.serve\s*\(/.test(source)) return findings;
  const uncheckedQuery = lines.findIndex((line) => /await\s+admin\.from\(/.test(line) && /const\s*\{\s*data(?:\s*[:,}])/.test(line) && !/\berror\b/.test(line));
  if (uncheckedQuery >= 0) {
    findings.push({ title: `Consulta Supabase sem tratamento de erro: ${file}`, category: "data_availability", severity: "high", line: uncheckedQuery + 1 });
  }
  return findings;
}

function stableHash(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex").slice(0, 24);
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
  if (!Array.isArray(plan?.findingSignatures) || plan.findingSignatures.length === 0) reasons.push("assinaturas de achados ausentes");
  if ((plan?.findingSignatures ?? []).includes("*")) reasons.push("wildcard de assinatura não é permitido");
  if (!plan || !plan.files?.length) reasons.push("arquivos declarados ausentes");
  if (!plan?.tests?.length) reasons.push("testes declarados ausentes");
  if (!plan?.backup) reasons.push("backup/snapshot ausente");
  if (!plan?.rollback) reasons.push("rollback ausente");
  if (!plan?.abortWhen?.length) reasons.push("condições de abortar ausentes");
  for (const command of [...(plan?.commands ?? []), ...(plan?.tests ?? [])]) {
    if (!ALLOWED_PLAN_COMMANDS.has(command)) reasons.push(`comando não permitido: ${command}`);
  }
  for (const patch of plan?.patches ?? []) {
    if (!plan.files.includes(patch.file)) reasons.push(`patch fora da lista: ${patch.file}`);
    if (!patch.expected) reasons.push(`pré-condição ausente: ${patch.file}`);
    if (patch.file.startsWith("/") || patch.file.includes("..")) reasons.push(`arquivo fora do workspace: ${patch.file}`);
  }
  return { valid: reasons.length === 0, reasons };
}

function outputPathFor(reportPath, suffix) {
  return reportPath.replace(/\.json$/i, `${suffix}.json`);
}

async function writeReportAtomically(path, content) {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}

async function acquireReportLock(output) {
  const lockPath = `${output}.lock`;
  try {
    await mkdir(lockPath, { recursive: false });
    await writeFile(`${lockPath}/owner`, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
    return async () => rm(lockPath, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    try {
      const owner = await stat(`${lockPath}/owner`);
      if (Date.now() - owner.mtimeMs > 30 * 60_000) {
        await rm(lockPath, { recursive: true, force: true });
        return acquireReportLock(output);
      }
    } catch { /* lock owner is still being written; keep the gate closed */ }
    return null;
  }
}

async function applyPlan(plan, fileSystem, runCommand) {
  const validation = validatePlan(plan);
  if (!validation.valid) return { status: "blocked", reasons: validation.reasons };
  const previous = new Map();
  const currentContents = new Map();
  try {
    for (const command of plan.commands ?? []) {
      if (!ALLOWED_PLAN_COMMANDS.has(command)) return { status: "blocked", reasons: [`comando não permitido: ${command}`] };
      const result = await runCommand(command);
      if (result.exitCode !== 0 || result.timedOut) return { status: "blocked", reasons: [`comando falhou: ${command}`] };
    }
    for (const patch of plan.patches ?? []) {
      const current = currentContents.get(patch.file) ?? await fileSystem.readFile(patch.file);
      if (!current.includes(patch.expected)) throw new Error(`Pré-condição não encontrada em ${patch.file}`);
      if (!previous.has(patch.file)) previous.set(patch.file, current);
      const next = current.replace(patch.expected, patch.replacement);
      currentContents.set(patch.file, next);
      await fileSystem.writeFile(patch.file, next);
    }
    let rolledBack = false;
    return {
      status: "applied",
      reasons: [],
      rollback: async () => {
        if (rolledBack) return;
        rolledBack = true;
        for (const [file, content] of previous) await fileSystem.writeFile(file, content);
      },
    };
  } catch (error) {
    for (const [file, content] of previous) await fileSystem.writeFile(file, content);
    return { status: "blocked", reasons: [error instanceof Error ? error.message : "patch abortado"] };
  }
}

async function defaultRunCommand(command, timeoutMs = 15 * 60_000) {
  if (!ALLOWED_PLAN_COMMANDS.has(command)) return { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: `Comando não permitido: ${command}` };
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
  const unlock = await acquireReportLock(output);
  if (!unlock) {
    const locked = { schemaVersion: 1, runId: `loop_locked_${stableHash({ output })}`, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), commitSha, mode, status: "blocked", findings: [finding({ command: output, result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Outra execução do loop já está usando este relatório." }, severity: "high", category: "runtime", title: "Execução concorrente bloqueada" })] };
    return locked;
  }
  const startedAt = new Date().toISOString();
  try {
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
    if (process.env.LOOP_ENGINEERING_BACKEND_SCAN === "1") {
      let files = [];
      try { files = (await execFile("git", ["ls-files", "supabase/functions"])).stdout.split("\n").filter((file) => file.endsWith(".ts")); } catch { files = []; }
      for (const file of files) {
        const source = await readFile(file, "utf8").catch(() => "");
        for (const issue of detectBackendSourceRegressions(source, file)) {
          const result = { exitCode: 2, signal: null, timedOut: false, stdout: `line=${issue.line}`, stderr: "Consulta pode converter falha de backend em coleção vazia." };
          findings.push(finding({ command: `backend-scan:${file}`, result, severity: issue.severity, category: issue.category, title: issue.title }));
        }
      }
    }
    if (mode !== "detect" && !plan) findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Plano de remediação obrigatório" }, severity: "high", category: "authorization", title: "Plano de remediação ausente" }), remediation: "blocked" });
    if (mode !== "detect" && plan) {
    const planValidation = validatePlan(plan);
    const matchedFindings = findings.filter((item) => plan.findingSignatures?.includes(item.signature));
    if (!planValidation.valid) {
      findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: planValidation.reasons.join("; ") }, severity: "high", category: "authorization", title: "Plano de remediação inválido" }), remediation: "blocked" });
    } else if (!matchedFindings.length) {
      findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Nenhum achado reproduzido corresponde às assinaturas declaradas." }, severity: "high", category: "authorization", title: "Remediação sem achado reproduzido" }), remediation: "blocked" });
    } else {
      const remediation = await applyPlan(plan, fileSystem, runCommand);
      if (remediation.status === "blocked") {
      findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: remediation.reasons.join("; ") }, severity: "high", category: "authorization", title: "Remediação bloqueada" }), remediation: "blocked" });
      } else {
        const validationResults = [];
        let validationFailed = false;
        for (const test of plan.tests) {
          const result = await runCommand(test);
          validationResults.push({ command: test, exitCode: result.exitCode, timedOut: result.timedOut });
          if (result.exitCode !== 0 || result.timedOut) {
            validationFailed = true;
            break;
          }
        }
        if (validationFailed) {
          await remediation.rollback?.();
          findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: JSON.stringify(validationResults) }, severity: "high", category: "test", title: "Teste pós-remediação falhou" }), remediation: "blocked", validation: { status: "failed", tests: validationResults } });
        } else {
          for (const item of matchedFindings) {
            item.remediation = "applied";
            item.validation = { status: "passed", tests: validationResults };
            item.releaseDecision = "manual_review";
            item.rollback = { status: "defined", instructions: plan.rollback };
          }
        }
      }
    }
    }
    const unique = [...new Map(findings.map((item) => [item.signature, item])).values()];
    const unresolved = unique.filter((item) => item.remediation !== "applied" || item.validation?.status !== "passed");
    const report = { schemaVersion: 1, runId, startedAt, finishedAt: new Date().toISOString(), commitSha, mode, status: unresolved.length ? "blocked" : mode === "detect" ? "detected" : "validated", findings: unique };
    await mkdir(new URL("../reports/", import.meta.url), { recursive: true }).catch(() => undefined);
    await mkdir(new URL(`../${output.split("/").slice(0, -1).join("/") || "reports"}/`, import.meta.url), { recursive: true }).catch(() => undefined);
    const json = `${JSON.stringify(report, null, 2)}\n`;
    await writeReportAtomically(output, json);
    await writeReportAtomically(output.replace(/\.json$/i, ".md"), renderMarkdown(report));
    await writeReportAtomically(outputPathFor(output, `.${runId}`), json);
    return report;
  } finally {
    await unlock();
  }
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
