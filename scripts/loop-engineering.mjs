import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createAutomaticRemediationPlan } from "./loop-engineering-auto-repair.mjs";

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
  const text = String(source ?? "");
  if (!/Deno\.serve\s*\(/.test(text)) return findings;
  const queryPattern = /const\s*\{\s*data(?:\s*:\s*([A-Za-z_$][\w$]*))?\s*\}\s*=\s*await\s+admin\.from\(/g;
  const lineNumber = (index) => text.slice(0, index).split("\n").length;
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const match of text.matchAll(queryPattern)) {
    const variable = match[1] || "data";
    const start = match.index ?? 0;
    const nextQuery = text.indexOf("const {", start + match[0].length);
    const context = text.slice(start, nextQuery >= 0 ? nextQuery : start + 1200);
    const emptyCollectionFallback = new RegExp(`\\b${escapeRegExp(variable)}\\s*(?:\\|\\||\\?\\?)\\s*\\[\\s*\\]`).test(context);
    if (!emptyCollectionFallback) continue;
    findings.push({ title: `Consulta Supabase sem tratamento de erro: ${file}`, category: "data_availability", severity: "high", line: lineNumber(start) });
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
  const args = { mode: "detect", output: "reports/loop-engineering.json", plan: null, autoRepair: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--mode" && argv[index + 1]) args.mode = argv[++index];
    else if (flag === "--output" && argv[index + 1]) args.output = argv[++index];
    else if (flag === "--plan" && argv[index + 1]) args.plan = argv[++index];
    else if (flag === "--auto") args.autoRepair = true;
    else if (flag === "--help") args.help = true;
  }
  if (!["detect", "repair", "release"].includes(args.mode)) throw new Error(`Modo inválido: ${args.mode}`);
  return args;
}

async function authenticatedRuntimeFinding({ authStatePath = process.env.GROWDASH_AUTH_STATE, required = false } = {}) {
  if (!required) return null;
  if (!authStatePath) {
    return finding({
      command: "npm run test:visual -- --workers=1",
      result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "GROWDASH_AUTH_STATE ausente; smoke autenticado real não foi executado." },
      severity: "high",
      category: "authentication",
      title: "Smoke autenticado bloqueado: sessão ausente",
    });
  }
  try {
    await access(authStatePath);
    return null;
  } catch {
    return finding({
      command: "npm run test:visual -- --workers=1",
      result: { exitCode: 2, signal: null, timedOut: false, stdout: `auth_state=${authStatePath}`, stderr: "Arquivo GROWDASH_AUTH_STATE não encontrado; smoke autenticado real não foi executado." },
      severity: "high",
      category: "authentication",
      title: "Smoke autenticado bloqueado: estado inválido",
    });
  }
}

function sentryConfigurationFinding({ required = false, token = process.env.SENTRY_AUTH_TOKEN } = {}) {
  if (!required || token) return null;
  return finding({
    command: "sentry-release-check",
    result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "SENTRY_AUTH_TOKEN ausente; eventos e source maps não podem ser verificados." },
    severity: "high",
    category: "observability",
    title: "Gate de observabilidade bloqueado: Sentry não configurado",
  });
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

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readLockOwners(lockPath) {
  let names = [];
  try {
    names = await readdir(lockPath);
  } catch {
    return [];
  }
  const ownerNames = names.filter((name) => name === "owner" || name.startsWith("owner "));
  const owners = [];
  for (const name of ownerNames) {
    try {
      const value = JSON.parse(await readFile(`${lockPath}/${name}`, "utf8"));
      if (value && Number.isInteger(value.pid)) owners.push(value);
    } catch {
      // A partially written owner file keeps the lock closed until the stale timeout.
    }
  }
  return owners;
}

async function acquireReportLock(output) {
  const lockPath = `${output}.lock`;
  try {
    await mkdir(lockPath, { recursive: false });
    await writeFile(`${lockPath}/owner`, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
    return async () => rm(lockPath, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const owners = await readLockOwners(lockPath);
    if (owners.some((owner) => isProcessAlive(owner.pid))) return null;
    try {
      const lockStat = await stat(lockPath);
      const stale = Date.now() - lockStat.mtimeMs > 30 * 60_000;
      // A recorded owner that is no longer alive is an orphan immediately. If
      // metadata is missing or malformed, wait for the normal stale timeout so
      // a concurrently starting process cannot be interrupted.
      if (owners.length > 0 || stale) {
        await rm(lockPath, { recursive: true, force: true });
        return acquireReportLock(output);
      }
    } catch {
      // The lock owner is still being written; keep the gate closed.
    }
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

export async function runLoop({ mode = "detect", output = "reports/loop-engineering.json", plan = null, autoRepair = false, commands = DEFAULT_COMMANDS, runCommand = defaultRunCommand, commitSha = "unknown", backendScan = false, authenticatedRuntime = false, authStatePath = process.env.GROWDASH_AUTH_STATE, sentryRequired = false, sentryToken = process.env.SENTRY_AUTH_TOKEN, fileSystem = { readFile: (file) => readFile(file, "utf8"), writeFile: (file, content) => writeFile(file, content, "utf8") } }) {
  const unlock = await acquireReportLock(output);
  if (!unlock) {
    const locked = { schemaVersion: 1, runId: `loop_locked_${stableHash({ output })}`, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), commitSha, mode, status: "blocked", findings: [finding({ command: output, result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Outra execução do loop já está usando este relatório." }, severity: "high", category: "runtime", title: "Execução concorrente bloqueada" })] };
    return locked;
  }
  const startedAt = new Date().toISOString();
  try {
    const runId = `loop_${stableHash({ mode, commitSha, startedAt })}`;
    const findings = [];
    const authFinding = await authenticatedRuntimeFinding({ authStatePath, required: authenticatedRuntime });
    if (authFinding) findings.push(authFinding);
    const sentryFinding = sentryConfigurationFinding({ required: sentryRequired, token: sentryToken });
    if (sentryFinding) findings.push(sentryFinding);
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
    if (backendScan) {
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
    if (mode !== "detect") {
      const plans = plan ? [plan] : autoRepair ? findings.map((item) => createAutomaticRemediationPlan(item)).filter(Boolean) : [];
      if (!plans.length && !autoRepair) {
        findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Plano de remediação obrigatório" }, severity: "high", category: "authorization", title: "Plano de remediação ausente" }), remediation: "blocked" });
      }
      for (const currentPlan of plans) {
        const planValidation = validatePlan(currentPlan);
        const matchedFindings = findings.filter((item) => currentPlan.findingSignatures?.includes(item.signature));
        if (!planValidation.valid) {
          findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: planValidation.reasons.join("; ") }, severity: "high", category: "authorization", title: "Plano de remediação inválido" }), remediation: "blocked" });
          continue;
        }
        if (!matchedFindings.length) {
          findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: "Nenhum achado reproduzido corresponde às assinaturas declaradas." }, severity: "high", category: "authorization", title: "Remediação sem achado reproduzido" }), remediation: "blocked" });
          continue;
        }
        const remediation = await applyPlan(currentPlan, fileSystem, runCommand);
        if (remediation.status === "blocked") {
          findings.push({ ...finding({ command: "--plan", result: { exitCode: 2, signal: null, timedOut: false, stdout: "", stderr: remediation.reasons.join("; ") }, severity: "high", category: "authorization", title: "Remediação bloqueada" }), remediation: "blocked" });
          continue;
        }
        const validationResults = [];
        let validationFailed = false;
        for (const test of currentPlan.tests) {
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
            item.rollback = { status: "defined", instructions: currentPlan.rollback };
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
    console.log("Uso: node scripts/loop-engineering.mjs [--mode detect|repair|release] [--auto] [--output arquivo.json] [--plan arquivo.json]");
    return;
  }
  let commitSha = "unknown";
  try { commitSha = (await execFile("git", ["rev-parse", "HEAD"])).stdout.trim(); } catch { /* relatório ainda é útil sem Git */ }
  const report = await runLoop({
    ...args,
    commitSha,
    backendScan: process.env.LOOP_ENGINEERING_BACKEND_SCAN === "1",
    authenticatedRuntime: process.env.LOOP_ENGINEERING_AUTH_REQUIRED === "1",
    sentryRequired: process.env.LOOP_ENGINEERING_SENTRY_REQUIRED === "1",
  });
  console.log(JSON.stringify({ runId: report.runId, status: report.status, findings: report.findings.length, output: args.output }, null, 2));
  if (report.status === "blocked") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
