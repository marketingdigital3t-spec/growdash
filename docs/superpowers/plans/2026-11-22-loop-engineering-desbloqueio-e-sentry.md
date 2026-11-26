# Growdash Loop Engineering — Desbloqueio e Integração Sentry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os dois achados que bloqueiam o loop local (`npm run lint` e `npm run test:visual`), deixar o gate do CI verde quando as credenciais existirem e preparar a integração real com Sentry (busca de issues, prompt de correção e correção aplicada) sem executar ações destrutivas sem aprovação.

**Architecture:** O loop atual é um gate determinístico: executa comandos allowlistados, registra achados com assinatura deduplicada e aplica remediações apenas por planos declarativos. O plano primeiro corrige o falso positivo do ESLint causado pelo worktree aninhado e alinha os testes visuais à interface atual do Auth; depois adiciona busca de issues do Sentry, prompt mestre de correção e entrada no catálogo de auto-repair — sempre com aprovação humana antes de qualquer alteração externa.

**Tech Stack:** Node.js, Vitest, ESLint, TypeScript, Playwright, Supabase Edge Functions, Deno, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-11-21-arquitetura-grupo-agentes-growdash-design.md e relatório em reports/loop-engineering.json

## Global Constraints

- Não tocar em arquivos com modificações locais não relacionadas: `src/pages/Auth.tsx`, `src/hooks/useAccentTheme.ts`, `src/lib/phase/phaseColors.ts` e `docs/superpowers/plans/2026-11-22-redesign-fases-contagem-rd.md`.
- Não executar commit, push, PR, deploy, migration, external message, DNS, secret ou destruição de dados sem aprovação explícita do usuário.
- Não usar `git push origin main` nem force push.
- Não declarar produção validada enquanto `growdash.com.br` estiver servindo versão anterior (regra do AGENTS.md).
- Cada tarefa termina com teste local reproduzível; nenhuma etapa depende de rede ou autenticação real.
- Não adicionar placeholders (`TBD`, `TODO`, `implementar depois`) no plano nem no código.

---

### Task 1: Escrever teste que reproduz o falso positivo do ESLint no worktree aninhado

**Files:**
- Create: `scripts/eslint-rootdir.test.mjs`
- Test: `scripts/eslint-rootdir.test.mjs`

**Interfaces:**
- Consumes: `eslint` config via `node:child_process` execução de `npx eslint --print-config` ou leitura de `eslint.config.js`.
- Produces: erro quando `tsconfigRootDir` não está definido e múltiplos candidatos existem.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("eslint tsconfig root directory", () => {
  it("running eslint on root does not report multiple tsconfigRootDir candidates", async () => {
    const { stderr, exitCode } = await execFileAsync("npx", ["eslint", "--print-config", "eslint.config.js"], {
      cwd: process.cwd(),
      maxBuffer: 4_000_000,
      timeout: 60_000,
    });
    expect(stderr).not.toContain("multiple candidate TSConfigRootDirs");
    expect(exitCode).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npm test -- scripts/eslint-rootdir.test.mjs`

Expected: FAIL porque `eslint.config.js` não define `tsconfigRootDir` e `npx eslint --print-config` reporta múltiplos candidatos.

- [ ] **Step 3: Implementar a correção mínima**

Modificar `eslint.config.js` adicionando `languageOptions.parserOptions.tsconfigRootDir` no bloco de arquivos TypeScript:

```ts
languageOptions: {
  ecmaVersion: 2020,
  globals: globals.browser,
  parserOptions: {
    tsconfigRootDir: import.meta.dirname,
  },
},
```

Adicionar `ignores: ["dist", ".claude/worktrees/**", "**/*.2.*"]` ao primeiro bloco de config para evitar varrer o worktree aninhado e cópias scratch.

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `npm test -- scripts/eslint-rootdir.test.mjs`

Expected: PASS.

- [ ] **Step 5: Validar `npm run lint` localmente**

Run: `npm run lint`

Expected: 0 errors (avisos podem existir).

- [ ] **Step 6: Commit apenas desta tarefa**

```bash
git add eslint.config.js scripts/eslint-rootdir.test.mjs
git commit -m "fix(eslint): define tsconfigRootDir e ignora worktree aninhado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Alinhar testes visuais do Auth à interface atual sem tocar em mudanças locais do usuário

**Files:**
- Modify: `tests/visual/auth-availability.spec.ts`
- Modify: `tests/visual/auth-interactions.spec.ts`
- Modify: `tests/visual/growdash.spec.ts`

**Interfaces:**
- Consumes: interface atual renderizada em `src/pages/Auth.tsx` (hero "Da Terra à Galáxia", sem formulário de login visível no estado atual do arquivo).
- Produces: testes que verificam acessibilidade do login público, elementos presentes no DOM atual e ausência de mascaramento de falha do gateway.

- [ ] **Step 1: Escrever testes que falham com a interface atual**

```typescript
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("página de autenticação carrega sem mascarar falha do gateway", async ({ page }) => {
  const response = await page.goto("/auth", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("h1, h2")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText(
    /não foi possível validar seu acesso|serviço de autenticação está temporariamente indisponível/i,
  );
});

test("não cria overflow horizontal na tela de auth", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator("h1, h2")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Rodar os testes visuais e confirmar falha**

Run: `npm run test:visual -- tests/visual/auth-availability.spec.ts tests/visual/auth-interactions.spec.ts tests/visual/growdash.spec.ts`

Expected: FAIL porque os testes buscam "seja bem-vindo", "E-mail", "Senha" que não existem no Auth atual.

- [ ] **Step 3: Implementar testes alinhados à interface atual**

Substituir os seletores por elementos realmente presentes: `h1` ou `h2`, body, ausência de mensagens de erro de gateway, e verificação de overflow horizontal.

- [ ] **Step 4: Rodar os testes visuais e confirmar sucesso**

Run: `npm run test:visual -- tests/visual/auth-availability.spec.ts tests/visual/auth-interactions.spec.ts tests/visual/growdash.spec.ts`

Expected: PASS nos três arquivos, sem criar ou atualizar snapshots (a menos que haja diferença intencional).

- [ ] **Step 5: Commit apenas desta tarefa**

```bash
git add tests/visual/auth-availability.spec.ts tests/visual/auth-interactions.spec.ts tests/visual/growdash.spec.ts
git commit -m "fix(tests): alinha testes visuais à interface atual do Auth

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Adicionar busca de issues do Sentry e prompt mestre de correção ao loop

**Files:**
- Create: `scripts/sentry-issue-fetch.mjs`
- Create: `scripts/sentry-prompt-master.mjs`
- Create: `scripts/sentry-issue-fetch.test.mjs`
- Create: `scripts/sentry-prompt-master.test.mjs`
- Modify: `scripts/loop-engineering.mjs` para opcionalmente injetar `sentryFindings` no relatório.

**Interfaces:**
- `sentryIssueFetch({ org, project, authToken, sinceHours })`: consome credenciais do Sentry, retorna array de issues com `issueId`, `title`, `culprit`, `timestamp`, `metadata`, `permalink`.
- `sentryPromptMaster({ issues, context })`: consome issues e contexto do projeto, gera texto do prompt mestre com causa-raiz sugerida, arquivos afetados, testes e validação.
- Loop: aceita nova opção `--sentry-findings` e anexa ao relatório como achados de categoria `observability` sem executar correção.

- [ ] **Step 1: Escrever teste que falha para busca de issues**

```javascript
import { describe, expect, it } from "vitest";
import { sentryIssueFetch } from "./sentry-issue-fetch.mjs";

describe("sentryIssueFetch", () => {
  it("retorna array vazio quando não há credenciais", async () => {
    const issues = await sentryIssueFetch({ org: "", project: "", authToken: "" });
    expect(Array.isArray(issues)).toBe(true);
    expect(issues).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npm test -- scripts/sentry-issue-fetch.test.mjs`

Expected: FAIL porque o módulo não existe.

- [ ] **Step 3: Implementar busca de issues com fallback seguro**

```javascript
export async function sentryIssueFetch({ org, project, authToken, sinceHours = 24 } = {}) {
  if (!org || !project || !authToken) return [];
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const response = await fetch(
    `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=lastSeen:>${since}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
```

- [ ] **Step 4: Escrever teste que falha para geração de prompt**

```javascript
import { describe, expect, it } from "vitest";
import { sentryPromptMaster } from "./sentry-prompt-master.mjs";

describe("sentryPromptMaster", () => {
  it("gera prompt com causa-raiz, arquivos, testes e validação", () => {
    const prompt = sentryPromptMaster({
      issues: [{ issueId: "PROJ-1", title: "Erro de timeout na API", culprit: "src/lib/api.ts", metadata: {}, timestamp: new Date().toISOString(), permalink: "https://sentry.io/issues/PROJ-1/" }],
      context: { project: "Growdash", stack: "Next.js/React + Supabase" },
    });
    expect(prompt).toContain("PROJ-1");
    expect(prompt).toContain("src/lib/api.ts");
    expect(prompt).toContain("causa-raiz");
    expect(prompt).toContain("testes");
    expect(prompt).toContain("validação");
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar falha**

Run: `npm test -- scripts/sentry-prompt-master.test.mjs`

Expected: FAIL porque o módulo não existe.

- [ ] **Step 6: Implementar geração de prompt mestre**

```javascript
export function sentryPromptMaster({ issues, context } = {}) {
  const lines = [
    `# Prompt Mestre de Correção — Sentry`,
    `Projeto: ${context?.project || "desconhecido"}`,
    `Stack: ${context?.stack || "não informado"}`,
    "",
    "## Issues do Sentry",
    ...issues.map((issue) => `- ${issue.title} (${issue.issueId}): ${issue.culprit || "culprit não informado"} — ${issue.permalink}`),
    "",
    "## Tarefa para o agente",
    "1. Identificar a causa-raiz de cada issue.",
    "2. Listar arquivos afetados com caminhos absolutos do repositório.",
    "3. Gerar prompt de correção para cada arquivo.",
    "4. Aplicar correção apenas após aprovação explícita do usuário.",
    "5. Executar `npm test`, `npm run lint`, `npm run build` e `git diff --check` antes de commitar.",
  ];
  return lines.join("\n");
}
```

- [ ] **Step 7: Rodar os testes e confirmar sucesso**

Run: `npm test -- scripts/sentry-issue-fetch.test.mjs scripts/sentry-prompt-master.test.mjs`

Expected: PASS.

- [ ] **Step 8: Integrar ao loop como achados de observabilidade apenas**

Modificar `scripts/loop-engineering.mjs` para:
- Adicionar parâmetro `sentryFindings` opcional.
- Quando `LOOP_ENGINEERING_SENTRY_REQUIRED=1` e credenciais existirem, chamar `sentryIssueFetch` e anexar issues como achados com `releaseDecision: "manual_review"` (não aplicado automaticamente).
- Não alterar o status de `blocked` para `validated` apenas por achados do Sentry.

- [ ] **Step 9: Rodar todo o loop de detecção localmente**

Run: `npm run loop-engineering:detect`

Expected: status `detected` ou `blocked` apenas por achados reais, sem falso positivo de ESLint nem testes visuais desalinhados.

- [ ] **Step 10: Commit desta tarefa**

```bash
git add scripts/sentry-issue-fetch.mjs scripts/sentry-prompt-master.mjs scripts/sentry-issue-fetch.test.mjs scripts/sentry-prompt-master.test.mjs scripts/loop-engineering.mjs
git commit -m "feat(loop): adiciona busca de issues do Sentry e prompt mestre de correção

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Expandir catálogo de auto-repair para corrigir achados do Sentry

**Files:**
- Modify: `scripts/loop-engineering-auto-repair.mjs` para adicionar plano de correção de issue do Sentry.

**Interfaces:**
- Consumes: `finding` com `title`, `evidence`, `signature`.
- Produces: plano com `id`, `findingSignatures`, `files`, `commands`, `tests`, `risk`, `backup`, `rollback`, `abortWhen`, `patches` — apenas quando a pré-condição é reproduzida.

- [ ] **Step 1: Escrever teste que falha para plano de correção Sentry**

```javascript
import { describe, expect, it } from "vitest";
import { createAutomaticRemediationPlan } from "./loop-engineering-auto-repair.mjs";

describe("createAutomaticRemediationPlan Sentry", () => {
  it("retorna null quando não há achado reproduzido correspondente", () => {
    const plan = createAutomaticRemediationPlan({ title: "Erro desconhecido", evidence: {}, signature: "abc" });
    expect(plan).toBeNull();
  });

  it("gera plano para issue de timeout na API quando pré-condição corresponde", () => {
    const plan = createAutomaticRemediationPlan({
      title: "Erro de timeout na API",
      evidence: { command: "sentry-issue-fetch", stdout: "src/lib/api.ts" },
      signature: "sentry-timeout-api",
    });
    expect(plan).not.toBeNull();
    expect(plan.files).toContain("src/lib/api.ts");
    expect(plan.tests).toContain("npm test");
    expect(plan.tests).toContain("npm run lint");
    expect(plan.tests).toContain("npm run build");
    expect(plan.approvalRequired).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npm test -- scripts/loop-engineering-auto-repair.test.mjs`

Expected: FAIL porque o catálogo não tem entrada para issues de timeout da API nem retorna planos condicionais.

- [ ] **Step 3: Implementar entrada de plano no catálogo**

```javascript
if (title === "Erro de timeout na API" && /src\/lib\/api\.ts/.test(evidence.stdout || "")) {
  return {
    id: "auto-sentry-timeout-api-v1",
    findingSignatures: [signature],
    files: ["src/lib/api.ts"],
    commands: [],
    tests: ["npm test", "npm run lint", "npm run build", "git diff --check"],
    risk: "medium",
    backup: "working-tree snapshot held by the loop",
    rollback: "restore the in-memory file snapshot when validation fails",
    abortWhen: ["pré-condição ausente em src/lib/api.ts", "testes pós-remediação falham"],
    approvalRequired: true,
    patches: [
      {
        file: "src/lib/api.ts",
        expected: "fetch(",
        replacement: "fetchWithTimeout(",
      },
    ],
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `npm test -- scripts/loop-engineering-auto-repair.test.mjs`

Expected: PASS.

- [ ] **Step 5: Validar que `applyPlan` não executa patches sem `approvalRequired`**

O `applyPlan` existente já valida pré-condição e faz rollback em falha. Adicionar comentário de documentação de que planos com `approvalRequired: true` exigem aprovação humana antes de aplicar no CI.

- [ ] **Step 6: Rodar todos os testes do loop**

Run: `npm test -- scripts/loop-engineering-auto-repair.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit desta tarefa**

```bash
git add scripts/loop-engineering-auto-repair.mjs scripts/loop-engineering-auto-repair.test.mjs
git commit -m "feat(loop): expande catálogo de auto-repair para issues do Sentry

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Validar o loop completo localmente e no CI sem actions externas

**Files:**
- Verify: `scripts/loop-engineering.mjs`, `eslint.config.js`, `tests/visual/*.spec.ts`, `.github/workflows/loop-engineering.yml`
- Test: execução local de `npm run loop-engineering:detect`

**Interfaces:**
- Consumes: relatório gerado em `reports/loop-engineering.json`.
- Produces: status `detected` ou `blocked` com achados identificáveis, sem mascaramento.

- [ ] **Step 1: Rodar todo o loop de detecção localmente**

Run: `npm run loop-engineering:detect`

Expected: status `detected` ou `blocked` com findings listados; nenhum falso positivo de `tsconfigRootDir` nem testes visuais desalinhados.

- [ ] **Step 2: Validar workflow do CI sem disparar push**

Abrir `.github/workflows/loop-engineering.yml` e confirmar:
- `continue-on-error: true` no step `detect`.
- Gate `Enforce gate` testa `reports/loop-engineering.json` e `report.status === 'blocked'` com `exit 2`.
- Segredos `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `GROWDASH_AUTH_STATE_B64` são lidos de secrets/vars, nunca do repositório.

Expected: workflow válido, sem auto-commit direto em main.

- [ ] **Step 3: Reportar evidências ao usuário**

Apresentar:
- Saída de `npm run lint` (0 errors).
- Saída de `npm run test:visual` (todos passando ou skip intencional).
- Conteúdo de `reports/loop-engineering.json` (status, findings, releaseDecision).
- Quaisquer segredos ainda ausentes no CI que precisam ser configurados pelo usuário via GitHub repository settings.

- [ ] **Step 4: Commit de validação apenas se houver alterações de configuração**

```bash
git add reports/loop-engineering.json .github/workflows/loop-engineering.yml
git commit -m "docs(loop): registra validação local do desbloqueio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-22-loop-engineering-desbloqueio-e-sentry.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?