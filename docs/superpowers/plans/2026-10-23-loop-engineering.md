# Loop Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um runner seguro que detecta regressões frontend/backend, reproduz achados, aplica remediações versionadas quando autorizadas, valida e produz decisão de release auditável.

**Architecture:** Um núcleo TypeScript executável pelo Node será separado em contrato, sanitização, detectores, remediações e gates. O CLI `scripts/loop-engineering.mjs` orquestrará comandos permitidos e fixtures sem executar código arbitrário; o workflow GitHub executará o modo `detect` por agenda/manual e salvará relatórios. Remediações de banco, segurança e integrações só poderão rodar com plano declarativo, testes e rollback declarados.

**Tech Stack:** Node.js, TypeScript compilado pelo `tsx`/Vitest existente, scripts ESM, GitHub Actions, Vite/Vitest/Playwright, Supabase migrations e Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-23-loop-engineering-design.md`

## Global Constraints

- Preservar alterações locais existentes e não usar `git reset --hard`, `git checkout --` ou remoções destrutivas.
- Não transformar timeout, erro ou integração indisponível em zero ou `empty_confirmed`.
- Não expor tokens, cookies, secrets, URLs assinadas ou autorizações em relatórios.
- Não executar JavaScript fornecido por usuário nem editar código arbitrário por inferência.
- Alterações de banco/RLS, permissões, autenticação, webhooks, callbacks, secrets e métricas financeiras exigem `remediation_plan` com causa raiz, escopo, testes, snapshot/backup e rollback.
- O runner nunca publica sem validação, árvore limpa, origem sincronizada e manifesto de assets.
- Manter o scroll vertical da sidebar esquerda e evitar overflow horizontal do conteúdo.
- Executar cada comando de ferramenta sequencialmente, sem subagentes ou fan-out.

### Task 1: Contrato e sanitização do loop

**Files:**
- Create: `src/lib/loopEngineeringContract.ts`
- Create: `src/lib/loopEngineeringContract.test.ts`
- Create: `src/lib/loopEngineeringRedaction.ts`
- Create: `src/lib/loopEngineeringRedaction.test.ts`
- Modify: `docs/GROWDASH_AUTOMATION_CONTRACT.md` (referência cruzada somente)

**Interfaces:**
- `LoopMode = "detect" | "repair" | "release"`.
- `Finding` contém `id`, `signature`, `layer`, `severity`, `category`, `evidence`, `reproduction`, `remediation`, `validation`, `releaseDecision` e `rollback`.
- `createFinding(input)` gera IDs e assinaturas estáveis.
- `sanitizeOutput(value)` remove tokens, cookies, authorization headers, secrets e query params sensíveis.
- `dedupeFindings(findings)` mantém o primeiro achado por assinatura.
- `isHighRiskFinding(finding)` identifica banco, segurança, autorização, integração e métricas financeiras.

- [x] Escrever testes vermelhos para assinatura estável, enumeração de estados, deduplicação e redaction.
- [x] Executar `npx vitest run src/lib/loopEngineeringContract.test.ts src/lib/loopEngineeringRedaction.test.ts` e confirmar falha por módulos ausentes.
- [x] Implementar tipos, normalização, assinatura SHA-256 e sanitização recursiva sem vazar valores.
- [x] Executar os testes novamente e confirmar aprovação.
- [x] Executar `git diff --check`.

### Task 2: Detectores e execução de comandos

**Files:**
- Create: `src/lib/loopEngineeringDetectors.ts`
- Create: `src/lib/loopEngineeringDetectors.test.ts`
- Create: `src/lib/loopEngineeringRunner.ts`
- Create: `src/lib/loopEngineeringRunner.test.ts`

**Interfaces:**
- `CommandRunner(command, options) -> Promise<CommandResult>` com timeout, cwd e environment allowlist.
- `detectCommandFailure(result, context) -> Finding | null`.
- `detectDataAvailabilityRegression(text, context) -> Finding[]` para zero falso/loading/timeout.
- `runDetectionSuite(options) -> Promise<LoopRun>` que executa comandos sequencialmente e deduplica achados.

- [x] Escrever testes vermelhos para timeout sem converter em zero, comando com exit code, redaction e execução sequencial.
- [x] Executar os testes e confirmar falha esperada.
- [x] Implementar executor com timeout abortável, ambiente mínimo e saída limitada.
- [x] Implementar detectores para `npm test`, `npm run lint`, `npm run build`, `git diff --check` e contratos de disponibilidade.
- [x] Executar testes específicos e suíte existente.

### Task 3: Reprodução, remediações declarativas e gates

**Files:**
- Create: `src/lib/loopEngineeringRemediation.ts`
- Create: `src/lib/loopEngineeringRemediation.test.ts`
- Create: `src/lib/loopEngineeringGates.ts`
- Create: `src/lib/loopEngineeringGates.test.ts`

**Interfaces:**
- `RemediationPlan` declara `id`, `findingSignatures`, `files`, `commands`, `tests`, `risk`, `backup`, `rollback` e `abortWhen`.
- `validateRemediationPlan(plan, finding) -> GateResult` rejeita plano incompleto.
- `applyRemediationPlan(plan, io) -> RemediationResult` executa apenas comandos allowlisted e retorna diff/artefatos.
- `evaluateReleaseGate(run, repositoryState) -> GateResult` decide `eligible`, `blocked` ou `manual_review`.

- [x] Escrever testes vermelhos para plano de alto risco sem backup/rollback, plano completo aprovado, diff fora da lista, teste ausente e finding desconhecido.
- [x] Executar os testes e confirmar falha esperada.
- [x] Implementar validação declarativa e gate sem executar shell arbitrário.
- [x] Implementar remediação declarativa com backup lógico e restauração segura em erro.
- [x] Executar testes específicos e suíte existente.

### Task 4: CLI e relatórios

**Files:**
- Create: `scripts/loop-engineering.mjs`
- Create: `scripts/loop-engineering-report.mjs`
- Create: `reports/.gitkeep`
- Modify: `package.json`
- Create: `scripts/loop-engineering-cli.test.ts`

**Interfaces:**
- `node scripts/loop-engineering.mjs --mode detect --output reports/loop-engineering.json` executa somente detecção.
- `node scripts/loop-engineering.mjs --mode repair --plan path/to/plan.json` reproduz e prepara patch sem publicar.
- `node scripts/loop-engineering.mjs --mode release --plan path/to/plan.json` exige todos os gates e produz manifesto.
- Relatório Markdown contém implementado, reproduzido, corrigido, validado, bloqueado e pendências.

- [x] Escrever teste vermelho para parsing de argumentos, modo padrão detect, saída JSON sanitizada e exit code bloqueado.
- [x] Executar o teste e confirmar falha esperada.
- [x] Implementar CLI ESM com detecção e aplicação de patches declarativos, sem publicar por padrão.
- [x] Adicionar scripts `loop-engineering` e `loop-engineering:detect` sem alterar scripts existentes.
- [x] Executar CLI em fixture controlada e validar JSON/Markdown.

### Task 5: Workflow GitHub e documentação operacional

**Files:**
- Create: `.github/workflows/loop-engineering.yml`
- Create: `docs/LOOP_ENGINEERING_OPERATIONS.md`
- Modify: `README.md` com seção curta de operação

**Interfaces:**
- Workflow dispara em `schedule` e `workflow_dispatch`, usa Node travado no lockfile, executa modo detect, publica relatório como artifact e falha o job quando o gate bloqueia.
- Nenhuma credencial de produção fica hardcoded; secrets são referenciados apenas pelo nome e nunca impressos.

- [x] Escrever teste/document check para que o YAML contenha schedule/manual, `npm ci`, detect e upload de artifact sem deploy implícito.
- [x] Implementar workflow com permissões mínimas e retenção de artifact.
- [x] Documentar modos, planos de remediação, dados sensíveis, rollback e interpretação de exit codes.
- [x] Validar YAML por conteúdo e `git diff --check`.

### Task 6: Validação integrada e entrega

**Files:**
- Modify: `docs/superpowers/plans/2026-10-23-loop-engineering.md` marcando tarefas concluídas.
- Create: `reports/loop-engineering-final.json` apenas como artefato local não versionado, se necessário.

- [x] Executar teste unitário completo: `npm test` — 137 arquivos / 600 testes aprovados.
- [x] Executar lint e build: `npm run lint`, `npm run build` — 0 erros, 20 avisos preexistentes; build aprovado com alerta de chunks grandes.
- [x] Executar `node scripts/loop-engineering.mjs --mode detect` e `git diff --check` — relatório `detected`, 0 achados.
- [x] Validar smoke visual público e sessão autenticada disponível — `/crm`, `/painel-expert`, `/campanhas`, `/agenda-turmas` e `/saude-dos-dados` abriram sem logs de console; Campanhas saiu de “carregando…” para 48 registros.
- [x] Conferir `git status`, `git fetch origin`, divergência com `origin/main` e deployment Cloudflare antes do commit — branch alinhada antes do push; deployment final conferido pelo domínio.
- [x] Criar commit isolado, fazer push, publicar build validado e confirmar domínio/manifesto/rotas no navegador — commit `48cf617`, deployment `917742cd.growdash.pages.dev`, domínio principal serviu os mesmos assets.
- [x] Registrar no relatório final o que foi implementado, testado, publicado, verificado e o que depende de credenciais/ambiente externo.
