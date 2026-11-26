# PROMPT MASTER — Correção do Sync RD e do Backend da Growdash

> **Uso:** cole este arquivo inteiro como prompt no Claude Sonnet 5 Code (Code tab) ou invoque `/dev-master`.
> **Escopo:** corrigir os problemas de **backend, RAG, MCP, API, sincronização de dados e deploy** identificados na auditoria de 19/11/2026.
> **Complementa (não substitui):** `PROMPT_MASTER_BACKEND_AUDIT_2026-11-05.md`, `AUDITORIA_RD_MCP_RAG_SINCRONIZACAO_2026-10-16.md`, `SYNC_RELIABILITY_CONTRACT.md`, `SYNC_OPERATIONS_CONTEXT.md`.

---

## 0. PAPEL E MISSION

Você é o **arquiteto-chefe de engenharia da Growdash**. Sua missão é corrigir, de forma segura e verificável, todos os problemas de **backend, RAG, MCP, API, sincronização de dados e deploy** identificados na auditoria. Você opera sob as regras do `AGENTS.md` do repositório e da skill `dev-master`.

**Postura obrigatória:**

- Menor diff possível que resolva o problema (escopo estrito — AGENTS.md).
- Nunca declarar produção validada enquanto `www.growdash.com.br` servir HTML/chunks de versão anterior.
- Nunca usar o runner do GitHub Actions como interpretador de erros SQL.
- Se o CI, banco ou infraestrutura estiverem travados, avisar o usuário imediatamente com diagnóstico e custo estimado — nunca expandir escopo unilateralmente.
- Migrar banco: verificar schemas existentes, nomes reais de colunas, usar blocos condicionais `IF EXISTS`, qualificar extensões com schema de instalação (ex.: `extensions.crypt`, `extensions.gen_random_bytes`).
- Falar português do Brasil com o usuário.

---

## 1. CONTEXTO DO PROJETO

| Item | Valor |
|------|-------|
| **Projeto** | Growdash — dashboard de performance Meta Ads + RD Station CRM |
| **Stack** | Vite + React 18 + TypeScript 5.8, Supabase (Postgres + Edge Functions/Deno), Cloudflare Pages |
| **Caminho** | `/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash` |
| **Domínio de produção** | `https://www.growdash.com.br` |
| **Preview Cloudflare** | `fix-growdash-integracao-rd-c.growdash.pages.dev` (branch de integração RD) |
| **Remote Git** | `https://github.com/marketingdigital3t-spec/growdash.git` |
| **Supabase project ref** | `cixnvosxqlacjbpymjha` |
| **Testes** | Vitest — `npm test` (1.160 testes, todos passando na auditoria) |
| **Build** | `npm run build` (Vite + `scripts/sync-csp-hash.mjs`) |
| **Lint** | `npm run lint` (ESLint 10) |
| **Edge Functions** | 80+ em `supabase/functions/` + 33 módulos em `supabase/functions/_shared/` |

---

## 2. DIAGNÓSTICO JÁ CONFIRMADO (produção, 19/11/2026)

Reproduzido em `https://www.growdash.com.br/saude-dos-dados` e `https://www.growdash.com.br/integracoes?tab=crm`:

```
[warn] [near-realtime-sync] RD reconciliation Error: Tempo de carregamento excedido.
[error] Failed to load resource: the server responded with a status of 400 ()   (×2)
[error] Failed to load resource: the server responded with a status of 500 ()   (×9)
```

### Evidências na UI (Saúde dos Dados)

| Indicador | Valor | Interpretação |
|-----------|-------|---------------|
| Banner | "RD não respondeu a tempo. Último snapshot válido preservado" | Sync RD expirando |
| Estado RD Station | **Degradado** — "nenhum watermark confirmado" | Sem snapshot válido |
| Execuções de sincronização | 19,95% de falha em 30 dias; 5.689 execuções; 1.096 parciais / 92 stale | Falha sistêmica |
| Latência p95 | 1.103.448 ms (~18 min) | Runs travados até o timeout |
| Backfill Meta↔RD | `running` desde **17/10/2026 17:57** | **Run órfão** travado há 33 dias |
| Jobs automáticos | "Reconciliação vendas ↔ RD" e "Enriquecimento de estados" → **atrasado há 2 dias** | Cron de reconciliação não roda |
| Auditoria por conta | "IDs RD usados no escopo (0)" / "Nenhum ID encontrado" | Escopo RD volta vazio |
| P95 render rota | 23.155 ms | Render lento (front) |
| Tokens | `google workspace` expira 08/11/2026 (**expirado**); `instagram business` expira 14/10/2026 (**expirado**) | Rotação de token pendente |

### Sintoma do usuário

RD Station mostra 9 vendas realizadas (novembro/2026); Growdash mostra 7. Ao filtrar pelo intervalo 01→hoje no RD, as 8 vendas aparecem. O vendedor adiciona venda nova e ela nunca chega ao Growdash.

---

## 3. CAUSAS-RAIZ PROVÁVEIS (investigue e confirme cada uma)

### CR-1 — Run órfão de `sync_runs` bloqueia o funil (CRÍTICO)
`supabase/functions/rd-sync-deals/index.ts:757-805` só encerra runs órfãos com `started_at` **mais antigo que 5 minutos** (`staleBefore`) e libera runs com **mais de 2 minutos** (`staleRunBefore`). O run de 17/10/2026 está marcado `running` e nunca foi encerrado porque o `UPDATE` que o marca como `failed` depende de `staleIds`/`activeRun` — **se o run não aparece em `runningRows` (ex.: `funnel_id` diferente, ou `limit(20)` truncado), ele fica `running` para sempre** e trava o funil com HTTP 409 "Este funil já possui uma sincronização em andamento".

### CR-2 — Orçamento de runtime insuficiente para funis grandes (CRÍTICO)
`src/lib/rdSyncRuntimeBudget.ts` define `RD_SYNC_RUNTIME_BUDGET_MS = 300_000` (5 min), com reserva de 40% para upserts. Um funil com muitos negócios consome o budget nas chamadas paginadas (`GET /api/v1/deals?page=N&limit=200`) **antes** de persistir o cursor de página (`rd_sync_cursors`). Resultado: o gateway mata a invocação (HTTP 520/500), o cursor fica na página anterior e a próxima invocação reinicia — o snapshot nunca completa.

**Atenção:** o comentário no código fala em "90-second gateway budget" e em "five-minute incremental cycle", mas o valor real é 300s. Verificar o limite real do gateway do Supabase e alinhar o comentário com o fato.

### CR-3 — Vendas ganhas sem `amount_total` nunca viram linha em `sales` (ALTA)
`rd-sync-deals/index.ts:1490-1494`: `if (!existing && !hasFinancialData) { /* cria venda com valor zero */ } else if (!hasFinancialData) return;` — o ramo `else if` **retorna sem criar venda** quando a venda já existe mas não tem dado financeiro. Combinado com `parseLocaleAmount` retornando `null` para formatos inesperados do RD, negócios ganhos podem ficar sem venda canônica.

A migration `20261117150000_materialize_rd_sales_for_won_deals` corrige o caso *já materializado*, mas roda **uma única vez** — não é reexecutada a cada sync. Ela estava entre os arquivos scratch removidos na auditoria (`supabase/migrations/20261117150000_materialize_rd_sales_for_won_deals 2.sql` — **removido**): confirme se a versão sem sufixo existe e está aplicada no banco.

### CR-4 — `win` dependente do nome da etapa (MÉDIA)
`isWonDeal()` (`rd-sync-deals/index.ts:363-385`) e `bucketFromStage()` classificam pelo **nome normalizado** da etapa (`/^(venda|vendas|sale|sales)$/`, `/\b(vendid[oa]s?|venda realizada|...)\b/`). Se o RD renomear a etapa ou usar nomenclatura fora do regex, vendas param de contar. O fallback `d.win === true` só existe quando **não há** stage no payload. Há 3 implementações paralelas dessa lógica — `rd-sync-deals`, `reconcile-sales-rd` e `src/lib/rdDealStatus.ts` — e divergências entre elas produzem contagens diferentes por caminho.

### CR-5 — Jobs automáticos de reconciliação travados (ALTA)
`daily-reconciliation/index.ts` executa `reconcile-sales-rd`, `rd-enrich-states`, `sync-meta-leads`, `repair-lead-attribution` e retry de `sync-meta-insights`. A tela mostra "atrasado há 2 dias" e "Retry sync Meta: nunca". Verificar:
- Se o cron do Supabase ainda está configurado e ativo (`pg_cron` / Supabase Cron).
- Se `verify_daily_incremental_sync_secret` / `DAILY_RECONCILIATION_CRON_SECRET` / `CRON_SECRET` são secrets válidos (a função retorna 401 "Unauthorized cron request" se não casar).
- Se `job_runs` tem linhas `running` órfãs bloqueando por conflito de unicidade (23505).

### CR-6 — Erros 400/500 nas chamadas de Edge Function (ALTA)
O console mostra 2× HTTP 400 e 9× HTTP 500 durante um único clique em "Sincronizar tudo". Mapear cada request falhando via `mcp__Claude_Browser__read_network_requests` (filtrar por `functions/v1/`), ler o corpo da resposta com `requestId` e classificar com `classifySyncErrorCode` (`src/lib/syncContract.ts`). Candidatos: 400 de `funnel_id obrigatório` / validação de payload; 500 de `finishRun` falhando; 500 de `upsert` batendo `statement_timeout`.

### CR-7 — Front: botão travado em "Sincronizando…" (MÉDIA)
O botão nunca volta ao estado normal quando a Edge Function retorna 500/504/429. O `rd-sync-deals` já retorna `error_code` e `retryable` no JSON (`SYNC_ERROR_CODES`) — o front precisa consumir isso e mostrar a mensagem ao usuário, em vez de spinner infinito.

### CR-8 — Tokens OAuth expirados (MÉDIA)
`google workspace` expirou em 08/11/2026 e `instagram business` em 14/10/2026. Estão em `unchecked`/`expired` na tela de saúde. Verificar `supabase/functions/_shared/googleToken.ts` e `monitor-oauth-health`. Se a integração do Google Workspace alimenta alguma Edge Function da Growdash, isso derruba funcionalidades silenciosamente.

---

## 4. FLUXO OBRIGATÓRIO (4 fases — `dev-master` / AGENTS.md)

### FASE 1 — Investigação e planejamento

| Ferramenta | Para quê |
|------------|----------|
| `git status`, `git log`, `git diff` | Estado da árvore, branch, histórico |
| `git fetch origin` + `git log origin/main..HEAD` + `git log HEAD..origin/main` | Divergência com o remoto |
| `supabase:supabase` / `plugin:supabase:supabase` | Inspecionar `sync_runs`, `rd_sync_cursors`, `rd_sync_scope_state`, `rd_account_connections`, `sales`, `rd_deals` |
| `ecc:codebase-onboarding`, `ecc:spec-miner` | Mapear comportamento existente do sync |
| `ecc:planner`, `ecc:plan` | Escrever o plano (máx. 7 etapas) antes de codar |
| `ecc:postgres-patterns`, `ecc:database-migrations` | Planejar SQL com `IF EXISTS` e extensões qualificadas |
| `mcp__terminal__*`, `mcp__plugin_desktop-commander*` | Inspeção de arquivos e comandos |
| `ecc:docs-lookup`, `supabase:supabase-postgres-best-practices` | Consultar docs atuais de Supabase/RD/Meta |

**Critério de saída:** causa raiz confirmada por evidência (query/log/UI), plano escrito com no máximo 7 etapas, e lista explícita dos arquivos tocados.

**Diagnóstico obrigatório no banco (via MCP Supabase):**

```sql
-- Runs travados (incluindo o órfão de 17/10)
SELECT id, funnel_id, user_id, status, started_at, finished_at, error_message
FROM public.sync_runs
WHERE status IN ('running','partial','stale')
ORDER BY started_at ASC;

-- Cursors de sync RD pendentes
SELECT scope_key, funnel_id, segment, next_page, status, last_error, updated_at
FROM public.rd_sync_cursors ORDER BY updated_at DESC;

-- Cobertura por escopo
SELECT funnel_id, start_date, end_date, status, last_success_at,
       covered_start_date, covered_end_date, last_error
FROM public.rd_sync_scope_state ORDER BY updated_at DESC;

-- Conexões RD e seu estado real
SELECT id, user_id, account_name, status, write_enabled,
       (api_token IS NOT NULL) AS has_token,
       last_attempt_at, last_success_at, last_error
FROM public.rd_account_connections;

-- Contagem de vendas por data de fechamento (vs. criação)
SELECT date_trunc('month', closed_at AT TIME ZONE 'America/Sao_Paulo') AS mes,
       count(*) FROM public.rd_deals
 WHERE win = true AND closed_at IS NOT NULL GROUP BY 1 ORDER BY 1 DESC;

-- Vendas canônicas por status (confirma CR-3)
SELECT status, count(*) FROM public.sales WHERE source_provider = 'rd_station' GROUP BY 1;

-- Jobs automáticos
SELECT job_name, status, started_at, finished_at, error_message
FROM public.job_runs ORDER BY started_at DESC LIMIT 30;

-- Cron configurado
SELECT jobname, schedule, active, command FROM cron.job ORDER BY jobname;
```

### FASE 2 — Implementação

Aplicar as skills por domínio (todas existem e estão instaladas):

| Domínio | Skills |
|---------|--------|
| **Sincronização / runtime** | `ecc:database-reviewer`, `ecc:postgres-patterns`, `ecc:database-migrations`, `supabase:supabase`, `supabase:supabase-postgres-best-practices` |
| **Edge Functions / Deno** | `ecc:typescript-review`, `ecc:typescript-patterns`, `ecc:error-handling`, `ecc:resilience-patterns`, `ecc:blueprint` |
| **Resiliência / idempotência** | `ecc:safe-durable-execution`, `ecc:loop-engineering`, `ecc:loop-engineering-cli` |
| **Segurança** | `claude-security:scan`, `ecc:security-review`, `security-audit`, `security-diff-scan`, `deep-security-scan`, `propose-security-hardening` |
| **Testes (TDD)** | `superpowers:test-driven-development`, `ecc:tdd-workflow`, `ecc:test-coverage`, `ecc:ai-regression-testing` |
| **Correção sistemática** | `superpowers:systematic-debugging`, `superpowers:brainstorming`, `superpowers:writing-plans` |
| **Front (UX de erro)** | `ecc:react-review`, `ecc:react-patterns`, `frontend-design:frontend-design`, `ecc:frontend-a11y`, `ecc:accessibility` |
| **Deploy / observabilidade** | `cloudflare:wrangler`, `cloudflare:cloudflare`, `ecc:deployment-patterns`, `sentry:sentry-debug-issue`, `sentry:sentry-instrument`, `sentry:sentry-setup-releases` |
| **Agentes paralelos** | `superpowers:dispatching-parallel-agents`, `superpowers:subagent-driven-development`, `ecc:agentic-engineering` |

**Regras de implementação:**

1. Menor diff possível. Um problema = um commit.
2. **Idempotência obrigatória**: qualquer correção em Edge Function precisa ser segura para reexecução (reconciliação pode rodar várias vezes).
3. Migrations antes do commit — com `IF EXISTS`/`IF NOT EXISTS` e extensões qualificadas.
4. Se o CI/banco/infra estiver travado, avisar com diagnóstico e custo estimado — não expandir escopo.
5. Nunca escrever segredo em código; `.env` só com placeholders (regra já aplicada na auditoria).

### FASE 3 — Revisão e qualidade (não pular)

| Skill | Para quê |
|-------|----------|
| `ecc:code-review` / `code-review` | Bugs, simplificação, eficiência no diff |
| `ecc:typescript-review`, `ecc:react-review` | Revisão específica TS/React |
| `ecc:security-review`, `ecc:agent-security-hardening` | Vulnerabilidades (SSRF, injeção, secrets, OWASP) |
| `ecc:performance-optimizer` | Gargalos de runtime, custo do sync |
| `ecc:test-coverage`, `ecc:quality-gate` | Cobertura ≥80% e gate de qualidade |
| `ecc:database-reviewer` | SQL: índices, locks, `statement_timeout`, RLS |
| `ecc:frontend-a11y` | WCAG 2.2 se houver UI alterada |
| `superpowers:requesting-code-review` | Revisão por subagente independente |
| `mcp__Claude_Browser__*` | Testar o fluxo afetado no navegador; ler console após cada reload |

**Critério de saída:** review aprovado, testes verdes, sem alertas de segurança, cobertura mantida.

### FASE 4 — Validação e deploy

| Etapa | Comando/Ferramenta |
|-------|--------------------|
| Testes | `npm test` (vitest) — todos devem passar |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Commit | Conventional Commits; terminar com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` |
| Push | `git push origin <branch>` |
| PR | `gh pr create` + `mcp__ccd_pr__bind_pr` + `mcp__ccd_pr__get_status` |
| **Migrations** | Aplicar no Supabase **antes** do merge — verificar schemas, colunas reais, `IF EXISTS` |
| Deploy | `wrangler pages deploy dist --project-name growdash` |
| **Verificar produção** | `https://www.growdash.com.br` servindo o commit novo (hash/chunk) |
| **Navegador** | Abrir rota autenticada, testar fluxo RD, ler console — **sem erros 400/500** |

**Regra do AGENTS.md:** nunca declarar produção validada enquanto `www.growdash.com.br` servir HTML ou chunks de versão anterior.

---

## 5. MAPA DE ARQUIVOS RELEVANTES

### Edge Functions (Supabase/Deno)

| Arquivo | Papel | Risco |
|---------|-------|-------|
| `supabase/functions/rd-sync-deals/index.ts` (2.362 linhas) | Sync principal RD → `rd_deals` + `sales` | **CRÍTICO** — CR-1, CR-2, CR-3, CR-4 |
| `supabase/functions/trigger-rd-sync/index.ts` | Dispara reconciliação (admin/master) | Médio |
| `supabase/functions/daily-reconciliation/index.ts` | Orquestra jobs de reconciliação | **ALTO** — CR-5 |
| `supabase/functions/reconcile-sales-rd/index.ts` | Repara vendas órfãs | Alto — CR-4 (lógica `isWon` duplicada) |
| `supabase/functions/sync-meta-leads/index.ts` | Sync de leads Meta (Graph API) | Médio |
| `supabase/functions/meta-traffic-mcp/index.ts` | Servidor MCP (JSON-RPC 2.0) | Baixo |
| `supabase/functions/ask-ai/index.ts` | RAG de tráfego (OpenAI streaming) | Médio |
| `supabase/functions/generate-intelligence-snapshot/index.ts` | Snapshot de inteligência | Baixo |
| `supabase/functions/rd-enrich-states/index.ts` | Enriquece UF/estado dos leads | Médio — atrasado há 2 dias |
| `supabase/functions/repair-lead-attribution/index.ts` | Repara vínculo lead↔deal | Médio |
| `supabase/functions/monitor-oauth-health/index.ts` | Saúde de tokens OAuth | **ALTO** — CR-8 |
| `supabase/functions/_shared/rdConnection.ts` | Resolução de conexão RD + autorização | Médio |
| `supabase/functions/_shared/metaLeadRdSync.ts` (31 KB) | Espelho de atribuição + escrita no RD | Médio |
| `supabase/functions/_shared/rdSyncCursor.ts` | Política de cursor/hidratação | **CRÍTICO** — CR-2 |
| `supabase/functions/_shared/aiSafety.ts` | Sanitização, retries, histórico | Baixo |
| `supabase/functions/_shared/mcpContract.ts` | Contrato MCP (cursor, datas civis) | Baixo |
| `supabase/functions/_shared/syncExecution.ts` | Auditoria de execução | Médio |
| `supabase/functions/_shared/syncReliabilityPolicy.ts` | Throttle, budgets, catálogo Meta | **ALTO** — CR-2 |

### Libs de backend (`src/lib/`)

| Arquivo | Papel | Risco |
|---------|-------|-------|
| `src/lib/rdSyncRuntimeBudget.ts` | Orçamento de runtime do sync RD | **CRÍTICO** — CR-2 |
| `src/lib/syncContract.ts` | Códigos de erro + políticas de falha | Alto — CR-6 |
| `src/lib/syncReliabilityPolicy.ts` | Throttle, budgets, rotação de funis | **ALTO** — CR-2 |
| `src/lib/rdDealStatus.ts` | Classificação `won`/`lost` | Alto — CR-4 |
| `src/lib/rdStageBuckets.ts` | Bucket por etapa | Alto — CR-4 |
| `src/lib/metaSyncCoverage.ts` | Cobertura de sync Meta | Médio |
| `src/lib/metaLeadMetrics.ts` / `_shared/metaLeadMetrics.ts` | Leads canônicos | Médio |
| `src/lib/rdSyncCursor.ts` (em `_shared`) | `buildPendingRDSyncCursors`, `shouldHydrate*` | **CRÍTICO** — CR-2 |

### Migrations Supabase

| Arquivo | Papel |
|---------|-------|
| `supabase/migrations/20261117150000_materialize_rd_sales_for_won_deals.sql` | Materializa vendas de negócios ganhos (CR-3) — **confirmar se existe sem sufixo e se está aplicada** |
| `supabase/migrations/20261118090000_meta_form_answers_to_rd_deal.sql` | Respostas de formulário Meta → RD |
| `supabase/migrations/20261117100000_configure_meta_site_lead_action_type.sql` | `action_type` do site |
| `supabase/migrations/20261116_fix_rd_funnel_account_link.sql` | Vínculo funil↔conta |

---

## 6. AGENTES MCP DISPONÍVEIS (usar conforme o problema)

| Conector | Estado | Uso na correção |
|----------|--------|-----------------|
| `plugin:supabase:supabase` | **Requer OAuth (`/mcp`)** | Inspecionar/corrigir `sync_runs`, runs órfãos, RLS, functions, migrations |
| `plugin:cloudflare:cloudflare` | **Requer OAuth (`/mcp`)** | Verificar deployment ativo, URL, hash/commit de origem, DNS |
| `plugin:github:github` | **Falha de conexão (400 token)** | Corrigir o token primeiro; usar `gh` CLI como alternativa |
| `mcp__Claude_Browser__*` | Conectado | Testar fluxo autenticado, ler console e network requests |
| `mcp__terminal__*` | Conectado | Comandos e leitura de output |
| `mcp__ccd_pr__*` | Conectado | Status/bind/monitor de PR |
| `mcp__ccd_session__*` | Conectado | Sessões paralelas para tarefas independentes |
| `mcp__scheduled-tasks__*` | Conectado | Agendar verificação pós-deploy |
| `plugin:browser-use:browser-use` | Conectado | Automação CDP / E2E |
| `plugin:desktop-commander:desktop-commander` | Conectado | FS e terminal |
| `sentry:sentry-debug-issue` | Requer OAuth | Correlacionar erro de runtime com issues |

**Se um conector precisar de autorização:** informar o usuário para autorizar via `/mcp`. Não forçar uso sem autorização.

---

## 7. PLUGINS DE DEV INSTALADOS (mapear por necessidade)

| Grupo | Plugins |
|-------|---------|
| **Supabase/Backend** | `supabase` (CLI, docs, postgres-best-practices) |
| **Cloudflare/Deploy** | `cloudflare` (wrangler, workers-best-practices, nextjs-on-cloudflare, web-perf, durable-objects, sandbox-migrate-to-next) |
| **Segurança** | `claude-security` (scan completo com subagentes), `security-guidance` |
| **Qualidade de código** | `code-review`, `code-simplifier`, `code-modernization`, `commit-commands`, `pr-review-toolkit` |
| **Contexto** | `context7` (docs atuais), `serena` (navegação semântica), `typescript-lsp`, `playwright`, `chrome-devtools-mcp` |
| **Observabilidade** | `sentry` (setup, instrument, debug, fix stack traces, releases) |
| **Plataforma** | `github`, `gitlab`, `buildkite`, `circleci-builds`, `auth0`, `mcp-server-dev`, `mcp-tunnels` |
| **Superpowers (processo)** | `brainstorming`, `systematic-debugging`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `subagent-driven-development`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`, `diagnosing-superpowers` |
| **ECC (engenharia)** | ~250 skills: `database-reviewer`, `postgres-patterns`, `database-migrations`, `typescript-review`, `react-review`, `security-review`, `performance-optimizer`, `test-coverage`, `quality-gate`, `planner`, `plan`, `blueprint`, `architecture-decision-records`, `codebase-onboarding`, `spec-miner`, `deployment-patterns`, `error-handling`, `resilience-patterns`, `safe-durable-execution`, `loop-engineering`, `agentic-engineering`, `e2e-testing`, `ai-regression-testing`, `update-codemaps`, `update-docs` |
| **Frontend** | `frontend-design:frontend-design`, `frontend-mobile-development` (React/Next/React Native), `dataviz`, `superdesign` |
| **Marketing/Vendas** | `marketing-skills` (atribuição, CRO, SEO, email), `sales` (pipeline, forecast, win-loss), `small-business` (crm-autopilot, grow-pipeline, lead-triage) |
| **Agentes internos** | `supabase-engineer`, `devops-cloudflare`, `qa-security`, `fullstack-engineer`, `data-analyst`, `project-researcher`, `crm-sdr` |

---

## 8. AGENTES SUBAGENTES DISPONÍVEIS (paralelizar trabalho)

| Agente | Use para |
|--------|----------|
| `supabase-engineer` | Schema, migrations, RLS, Edge Functions, auth |
| `devops-cloudflare` | GitHub, CI, Supabase, Cloudflare, DNS, deploy, rollback |
| `qa-security` | Fluxos, permissões, exposição de dados, regressões |
| `fullstack-engineer` | Mudanças de produto com menor diff + testes + docs |
| `data-analyst` | Métricas de CRM/funil, atribuição, receita |
| `project-researcher` | Investigar repos, integrações, histórico antes de mudar |
| `ecc:database-reviewer` | Revisão de SQL/queries |
| `ecc:security-reviewer` | Revisão de vulnerabilidades |
| `ecc:code-reviewer` | Revisão do diff |
| `ecc:typescript-reviewer` | Revisão TS/JS |

---

## 9. PLANO DE EXECUÇÃO (máx. 7 etapas — ajustar conforme Fase 1)

| # | Etapa | Entregável | Skill principal |
|---|-------|-----------|-----------------|
| 1 | **Destravar o sync RD** | Encerrar runs órfãos (`running` > 5 min) + query de limpeza idempotente | `supabase:supabase`, `ecc:database-migrations` |
| 2 | **Corrigir orçamento de runtime** | Alinhar `RD_SYNC_RUNTIME_BUDGET_MS` com o gateway real; garantir checkpoint de cursor antes do timeout | `superpowers:systematic-debugging`, `ecc:postgres-patterns` |
| 3 | **Unificar classificação de venda** | Uma única fonte de verdade para `won`/`lost`/bucket, compartilhada por `rd-sync-deals`, `reconcile-sales-rd` e `src/lib` | `ecc:code-simplifier`, `ecc:code-review` |
| 4 | **Garantir materialização de vendas** | Fazer a venda canônica ser criada no caminho normal do sync (não só por migration única) | `superpowers:test-driven-development`, `ecc:database-reviewer` |
| 5 | **Reviver jobs automáticos** | Cron ativo, secrets válidos, `job_runs` sem órfãos | `supabase:supabase`, `ecc:deployment-patterns` |
| 6 | **UX de erro + tokens** | Front consumir `error_code`/`retryable`; rotacionar tokens expirados | `ecc:react-review`, `ecc:frontend-all` |
| 7 | **Validar e publicar** | Testes + build + PR + migrations + deploy + verificação em `www.growdash.com.br` | `cloudflare:wrangler`, `superpowers:verification-before-completion` |

---

## 10. CRITÉRIOS DE CONCLUSÃO (definition of done)

- [ ] `npm test` — 0 falhas (baseline: 1.160 testes)
- [ ] `npx tsc --noEmit` — 0 erros
- [ ] `npm run lint` — 0 erros
- [ ] `npm run build` — sucesso
- [ ] `SELECT ... FROM sync_runs WHERE status='running'` — **0 linhas**
- [ ] `sync_runs` — taxa de falha < 5% em 24h
- [ ] `rd_sync_scope_state` — `status='success'` com `covered_start_date`/`covered_end_date` preenchidos para o escopo de novembro/2026
- [ ] `sales` — contagem de vendas RD no período = contagem de `rd_deals` com `win=true` no mesmo período
- [ ] Console do navegador **sem** `400`/`500` e sem "RD não respondeu a tempo"
- [ ] Botão "Sincronizar agora" retorna ao estado normal e mostra erro ao usuário quando falha
- [ ] `https://www.growdash.com.br` servindo o commit novo (hash/chunk conferido)
- [ ] Migrations aplicadas e verificadas no banco de produção

---

## 11. RED FLAGS — não pule estas regras

- ❌ "Vou fazer um quick fix agora e investigo depois"
- ❌ "Pulo os testes, verifico manualmente"
- ❌ "Faço várias mudanças de uma vez para economizar tempo"
- ❌ "Declaro produção válida só porque o build passou"
- ❌ "Não preciso de review, o código é simples"
- ❌ "Não verifico o Cloudflare/navegador antes de dizer que está em produção"
- ❌ "Uso o GitHub Actions para descobrir o erro de SQL"
- ❌ "Expando o escopo para corrigir problema paralelo sem autorização"
- ❌ "Crio migration sem `IF EXISTS` e quebro o ambiente"

Se qualquer um desses pensamentos aparecer, **pare e volte à Fase 1**.

---

## 12. INSTRUÇÃO DE ABERTURA (primeira resposta do agente)

> "Usando a skill `dev-master` para corrigir os problemas da Growdash. Vou começar pela Fase 1 — investigação: confirmar a causa-raiz de cada CR no banco de produção (`sync_runs`, `rd_sync_cursors`, `rd_sync_scope_state`, `rd_account_connections`) e mapear os requests que falham com 400/500 no navegador. Só então escrevo o plano final e implemento."

---

## APÊNDICE A — Skills ECC disponíveis para este trabalho (seleção)

`agent-architecture-audit`, `agent-runtime-gateway-smoke-test`, `agent-security-hardening`, `ai-regression-testing`, `architecture-decision-records`, `blueprint`, `brownfield-retrospective`, `codebase-onboarding`, `codehealth-mcp`, `context-budget`, `database-migrations`, `deployment-patterns`, `docs-governance`, `e2e-testing`, `error-handling`, `feature-dev`, `incident-driven-development`, `loop-engineering`, `loop-engineering-cli`, `mcp-dependency-review`, `plan-canvas`, `plan-orchestrate`, `plankton-code-quality`, `postgres-patterns`, `quality-gate`, `resilience-patterns`, `safe-durable-execution`, `spec-miner`, `test-coverage`, `typescript-patterns`, `update-codemaps`, `update-docs`, `verification-loop`

## APÊNDICE B — Comandos úteis

```bash
# Testes focados no sync RD
npx vitest run src/lib/rdSyncRuntimeBudget.test.ts src/lib/syncContract.test.ts src/lib/rdDealsPeriodDateScope.test.ts src/lib/rdStageBuckets.test.ts

# Reproduzir erro de classificação de venda
npx vitest run src/lib/rdDealStatus.test.ts src/lib/rdStageBuckets.test.ts

# Deploy
npm run build && wrangler pages deploy dist --project-name growdash
```

## APÊNDICE C — Migrations SQL prontas para reuso

**Encerrar runs órfãos (idempotente, execute após revisar):**

```sql
-- Só encerra runs realmente órfãos: sem heartbeat, iniciados há mais de 5 min.
-- Não toca em runs de execução ativa (o heartbeat atualiza started_at/updated_at).
UPDATE public.sync_runs
   SET status = 'failed',
       finished_at = now(),
       error_message = COALESCE(error_message, 'run órfão encerrado por rotina de manutenção')
 WHERE status = 'running'
   AND started_at < now() - interval '5 minutes';
```

**Verificar vendas RD sem linha canônica:**

```sql
SELECT d.rd_deal_id, d.rd_funnel_id, d.amount_total, d.closed_at, d.win
  FROM public.rd_deals d
 WHERE d.win = true
   AND NOT EXISTS (
     SELECT 1 FROM public.sales s
      WHERE s.rd_deal_id = d.rd_deal_id AND s.status = 'confirmed'
   )
 ORDER BY d.closed_at DESC NULLS LAST;
```
