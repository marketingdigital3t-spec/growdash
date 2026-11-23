# STATE — Auditoria Growdash

```yaml
ciclo: 1
timestamp_iso: "2026-11-21T09:55:00-03:00"
branch: "audit/ciclo-1"
pr: "https://github.com/marketingdigital3t-spec/growdash/pull/3"
gate_anterior: "blocked (1 finding: npm run lint exit 1)"
gate_atual: "APROVADO localmente (detect: 0 findings)"
proximo_ciclo_iso: "2026-11-21T10:20:00-03:00"
prazo_iso: "2026-11-21T11:00:00-03:00"
achados: { P0: 1, P1: 3, P2: 5, P3: 2 }
achados_abertos: 9
achados_corrigidos: 3
achados_bloqueados: 0
```

## Achado raiz do ciclo 1 (P0-00 corrigido)

`.next/` (artefato de build do Next.js 16.4.6 que falhou) foi versionado em `ef944b9` e nunca removido. O ESLint varr `.next/types/*.ts` porque o flat config só ignorava `dist`, produzindo 71 erros falsos. `npm run lint` retornava exit 1, o step `detect` do loop-engineering terminava em `blocked`, e todo run agendado falhava ("All jobs have failed"). Correção: `.next/` removido (32 arquivos) e adicionado ao `.gitignore`. Loop local: `blocked` → `detected` (0 findings).

## Incidente — 22/11/2026 — Login indisponível em produção

**Branch:** `fix/backend-defects-2026-11-22` (a partir de `origin/main` = `74cdc5e8`)

**Sintoma:** `growdash.com.br/auth` devolvia "O serviço de acesso está demorando para responder"; o login respondia "Não foi possível entrar — O serviço de autenticação está temporariamente indisponível".

**Fato provado:** `src/pages/Auth.tsx` é byte-a-byte idêntico entre a versão que o usuário confirmou funcionando (19/11, commit `e7290f4`, deploy `c6278f47`) e a restaurada. **O formulário de login nunca foi o defeito.**

**Causa raiz 1 — saturação do pool do Postgres (corrigida):** `rd-sync-deals` lia `rd_field_configs` sem a coluna `id` e atualizava com `.eq("id", existing.id)` → `?id=eq.undefined` → HTTP 400 em toda atualização do catálogo, milhares de vezes por ciclo do cron `growdash-five-minute-sync` (`*/5 * * * *`). O defeito nasceu em `bf957ac4` (12/08/2026) e **nunca foi corrigido na `main`**.

**Causa raiz 2 — gate do loop-engineering travado (corrigida):** os worktrees aninhados em `.claude/worktrees/` trazem o próprio `tsconfig.json`; o ESLint encontra várias raízes candidatas e falha com `multiple candidate TSConfigRootDirs are present` em todo arquivo — **7258 erros**, derrubando `npm run lint` e o gate `detect`. A exclusão existia só no `.git/info/exclude` local, nunca versionada. O fix upstream (`4b47e0dd`, preso num worktree órfão) não chegou à `main`.

**Causa raiz 3 — comparação de segredo por `===` (corrigida):** `reconcile-sales-rd`, `rd-enrich-states`, `send-whatsapp-intelligence-report`, `instagram-automation-run`, `rd-backfill-touches` e `monitor-oauth-health` comparavam segredo com `===` (timing attack), apesar do helper `secretsMatch` já existir e ser o padrão do repositório.

**Evidência de runtime (medida em 22/11):**

| Requisição | Resultado |
|---|---|
| `/` (raiz) | 404 em 67 ms — Kong no ar |
| `/rest/v1/` sem auth | 401 em 77 ms — recusa na borda |
| `/rest/v1/rd_field_configs` (consulta real) | 522 em ~20 s |
| `/graphql/v1` | 522 em ~19,9 s |
| `/auth/v1/health` | 522 em ~19,8 s |
| `/functions/v1/daily-reconciliation` | 401 em 1,5 s — Edge Functions no ar |

O CI confirma pelo lado do servidor: `status 544: Failed to create login role: Connection terminated due to connection timeout` (run `45062487545`, 22/11 19:49 UTC). Última publicação bem-sucedida: 22/11 03:05 UTC.

**Correções aplicadas (branch `fix/backend-defects-2026-11-22`):**

| Arquivo | Correção |
|---|---|
| `supabase/functions/rd-sync-deals/index.ts` | `select` passa a trazer `id` |
| `.gitignore` | `.claude/worktrees/` versionado |
| `supabase/functions/reconcile-sales-rd/index.ts` | `secretsMatch` |
| `supabase/functions/rd-enrich-states/index.ts` | `secretsMatch` |
| `supabase/functions/send-whatsapp-intelligence-report/index.ts` | `secretsMatch` |
| `supabase/functions/instagram-automation-run/index.ts` | `secretsMatch` |
| `supabase/functions/rd-backfill-touches/index.ts` | `secretsMatch` |
| `supabase/functions/monitor-oauth-health/index.ts` | `secretsMatch` |
| `src/lib/rdFieldConfigsIdContract.test.ts` | contrato de regressão (novo) |
| `src/lib/eslintRootDirContract.test.ts` | contrato de regressão (novo) |
| `src/lib/cronSecretConstantTimeContract.test.ts` | contrato de regressão (novo) |

**Validação:** `npm test` → 244 arquivos, 1187 testes aprovados. `npx tsc --noEmit` → sem erros. `npm run lint` → 0 erros, 28 warnings (baseline). `npm run build` → sucesso. `npm run loop-engineering:detect` → **`detected`, 0 findings** (era `blocked`).

**Higiene:** os diretórios órfãos de `.claude/worktrees/` (565 MB, cópias de um checkout movido, não versionados) foram **movidos** para `/tmp/growdash-worktrees-arquivados/`. Nada foi destruído — todos os commits seguem preservados nos branches `worktree-*`.

**Itens bloqueados:**
- **BLOQUEADO:** publicar em `main`. Exige push + PR + deploy, que dependem de autorização do usuário.
- **BLOQUEADO:** o MCP do Supabase exige reautenticação; as ferramentas de logs/advisors do painel ficaram indisponíveis nesta sessão.

## Pendências

Verificadas uma a uma em 22/11/2026 contra o código atual. **O registro original estava desatualizado** — quase tudo já havia sido corrigido em commits posteriores.

- P1-01: ~~`fetch` a provedor externo sem timeout~~ — **RESOLVIDO**. Varredura completa: os 5 `await fetch(` das Edge Functions já usam `AbortSignal.timeout` ou `AbortController` (`validate-meta-totals`, `rd-sync-deals`, `google-drive-files`, `sync-meta-insights`, `_shared/sentrySync`).
- P1-02: ~~comparação de segredo com `===` em `rd-resync-cron`~~ — **RESOLVIDO** (usava `secretsMatch`).
- P1-03: `generate-intelligence-snapshot` chama OpenAI sem timeout e sem `stream: false` explícito — timeout presente; o `stream: false` segue **ABERTO**.
- P2-02: ~~`rd-discover-fields` faz fetch sem timeout~~ — **RESOLVIDO**.
- P2-03: ~~`rd-enrich-states` faz fetch sem timeout~~ — **RESOLVIDO**.
- P2-04: ~~`traffic-agent-analyze` / `traffic-agent-execute-approved`~~ — **RESOLVIDO**.
- P2-05: ~~`meta-manage-entity` faz 4 chamadas Graph API sem timeout~~ — **RESOLVIDO**.
- P3-01: ~~`rd-reconcile-metrics`/`rd-resync-cron` comparam segredo com `===`~~ — **RESOLVIDO**.
- P3-02: `.env.example` não bate com o formato real da publishable key (`sb_publishable_`) — segue **ABERTO**.

### Achados novos do mandato de 22/11

- **NOVO-01:** comparação de segredo por `===` (timing attack) em `reconcile-sales-rd`, `rd-enrich-states`, `send-whatsapp-intelligence-report`, `instagram-automation-run`, `rd-backfill-touches` e `monitor-oauth-health` — **CORRIGIDO** nesta branch. A varredura inicial cobriu apenas `x-cron-secret`; a revisão com regex mais ampla (`bearer && bearer === serviceKey`) revelou os dois casos restantes.
- **NOVO-02:** `.claude/worktrees/` não versionado no `.gitignore` (só no `.git/info/exclude` local) — **CORRIGIDO** nesta branch.
- **NOVO-03:** `rd-sync-deals` sem a coluna `id` no `select` do catálogo — **CORRIGIDO** nesta branch.

### Padrões verificados e sem achado

- **A2** (`select` sem PK seguido de update por PK): as 11 ocorrências de `.eq("id", existing.id)` **todas** leem `id` no `select`. O defeito era exclusivo do `rd-sync-deals`.
- **A5** (query sem escopo): as queries sem `.eq()` são de tabelas de configuração global (`growth_experiments`, `ad_accounts` por id explícito, etc.) ou já filtradas logo abaixo. Sem caso real.
- **A10** (migration sem guarda): as migrations recentes com DDL já usam `IF EXISTS` / `IF NOT EXISTS`. Sem caso real.
- **A8** (placeholder no bundle): os literais `your-project-ref` só aparecem em guardas e testes. Sem caso real.

## Estado da publicação — 23/11/2026

**PRs:** #11 (`5e0b24ad` + `f899c43e`) e #12 (`bfc1708a`) — ambos mergeados na `main`.
**Run:** `45188082141` — **conclusion: success**. Publicou as 83 Edge Functions, o bundle do frontend e o source map no Sentry.
**Produção:** `growdash.com.br` serve `assets/app-C1hAWXOj.js`, idêntico ao do deploy `51a706d6` (commit `363923f`). Smoke pós-deploy: 16 testes visuais aprovados.

### Correção adicional — o errexit do runner

O primeiro run do merge (`45182587373`) ainda falhou, e a causa era o meu próprio ajuste: o runner executa os steps com `bash -e`, então a PRIMEIRA falha aborta o script **antes** do `if`, e o `exit 0` de bloqueio nunca era alcançado. O log provou: imprimiu `MIGRATIONS_BLOCKED=1` e morreu logo depois com `status 544`. Correção em `bfc1708a`: `set +e` nos três steps que já tratam o status de saída manualmente.

### Causa raiz restante — o Postgres não aceita conexão

**O `rd_field_configs` não era a causa da saturação.** Com a função corrigida publicada (v319) e as 83 funções no ar, o pool continua idêntico:

| Requisição | Resultado |
|---|---|
| `/` (raiz) | 404 em 67 ms — Kong no ar |
| `/rest/v1/` sem auth | 401 em 77 ms — recusa na borda |
| `/rest/v1/rd_field_configs` (consulta real) | **522 em ~20 s** |
| `/auth/v1/health` | **522 em ~19,8 s** (consistente em 20+ amostras) |
| `/functions/v1/*` | 401 em 0,2–1,9 s — Edge Functions no ar |

Pelo lado do servidor, o CI mede `Initialising login role` levando **16,2 s** até `status 544: Failed to create login role: Connection terminated due to connection timeout`. O projeto reporta `ACTIVE_HEALTHY` e a região responde — mas o **Postgres não aceita conexão** (5432 e 6543 sem resposta TCP).

A correção de código está publicada e verificada. O que resta é infraestrutura do Supabase: **o banco do projeto não aceita novas conexões**. Isso exige ação no painel do Supabase (verificar/restaurar a conexão do banco) ou contato com o suporte — não há alteração de código capaz de destravar um Postgres que recusa o handshake.

## Itens bloqueados

- **BLOQUEADO:** o Postgres do projeto `cixnvosxqlacjbpymjha` não aceita conexão (status 544 / 522). O código corrigido está publicado e no ar; enquanto o banco recusar o handshake, o login falha por indisponibilidade de infraestrutura, não por defeito do app.
- **BLOQUEADO:** o MCP do Supabase exige reautenticação; logs de função e advisors do painel ficaram indisponíveis nesta sessão.

## Decisões (ver DECISIONS.md)

- D-01, D-02, D-03, D-04.

## Commits do ciclo

- `08a0675` fix(auth): impede que placeholder do .env quebre o login em produção [P0-00]
- `f76c70d` fix(trafego): alinha o trilho de áreas e adota a cor da fase ativa [P2-06]
- `b521f12` fix(ci): destrava o loop-engineering que falhava em todo run [P0-00]
- `88cbb79` chore(repo): remove artefatos de build do Next.js versionados por engano [P0-00]
- `e93da7d` chore(audit): permissões, guia de níveis e primeira leva de correções
- `e4cc6d5` chore(repo): remove cópias scratch versionadas

## Gate do ciclo 1

```
npm run lint                     →  0 errors, 28 warnings
npx tsc --noEmit                 →  0 errors
npx vitest run                   →  1163 passed (239 files)
npm run build                    →  built in 12.39s
npm run loop-engineering:detect  →  status: "detected", findings: 0
```

**gate: APROVADO** (local). Pendente para gate completo: merge do PR #3 na `main`
(dispara o workflow `loop-engineering` em `main`) e verificação em `www.growdash.com.br`.

## Verificação em produção (realizada neste ciclo)

- `www.growdash.com.br/auth` — login funciona; sessão autenticada confirmada no navegador (dashboard carregando dados reais).
- Trilho de áreas vs. sidebar esquerda: ambos `top: 0 → 869`; primeiros ícones ambos em `top: 88` (medição via DOM, não screenshot).
- Cor por fase: `--brand-gold` = `#00a8ff` (Terra) / `#ffc107` (Órbita) / `#a855f7` (Galáxia); verde de identidade eliminado.
