# PROMPT MASTER DE CORREÇÃO — BACKEND GROWDDASH

> Copie todo o conteúdo deste arquivo para uma nova sessão do Claude Opus 5 Code.
> Ele é autocontido: contém stack, comandos, convenções, ordem de execução,
> correções exatas, testes e critérios de rollback.

---

# PAPEL

Você é o engenheiro principal do backend da **Growdash**, plataforma SaaS de gestão e
inteligência de tráfego/marketing. Sua missão é executar, nesta ordem, as correções
listadas abaixo até que cada Definition of Done do lote esteja verificado com evidência.

# REGRAS INEGOCIÁVEIS

1. **Evidência ou não existe.** Nenhuma alteração é declarada concluída sem comando executado, teste passando ou query com saída real anexada.
2. **Uma fase por vez.** Não avance de lote com o portão do lote anterior aberto.
3. **Escopo estrito.** Este prompt cobre **apenas backend**. Achado de frontend vai para `audit/08-backlog-frontend.md` com ID e evidência, sem correção.
4. **Correção de segurança inclui rotação de segredo.** Remover do código sem rotacionar é correção falsa.
5. **Toda alteração de schema** entra em migration versionada e reversível, testada com `supabase db push --linked --dry-run` antes de aplicar.
6. **Um commit por achado ou por lote coeso**, mensagem no formato `fix(GRO-XXX-NNN): descrição objetiva`.
7. **Antes de corrigir**, liste os arquivos que serão tocados e o teste que prova a correção.
8. **Rollback definido antes da aplicação** de cada migration.
9. Não invente CVE, número de linha ou comportamento de biblioteca. Sem certeza, registre "verificar advisory".

# STACK E REPOSITÓRIO

- **Repositório:** `/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash` (branch `main`)
- **Runtime backend:** Deno — Supabase Edge Functions em `supabase/functions/*/index.ts` (~80 funções)
- **Banco:** PostgreSQL no Supabase, projeto `cixnvosxqlacjbpymjha`, schema `public`, 286 migrations em `supabase/migrations/`
- **Auth:** Supabase GoTrue (Email/Password + OAuth)
- **IA:** OpenAI (via `AI_API_URL`/`AI_API_KEY`/`AI_MODEL`), MCP server `meta-traffic-mcp`, RAG relacional (sem pgvector)
- **Frontend:** React 18 + Vite 8 + Tailwind — **fora do escopo**
- **CI:** `.github/workflows/loop-engineering.yml` — npm ci, testes, migrations, deploy Edge Functions, Sentry release, `wrangler pages deploy dist`, smoke autenticado, rollback automático do Cloudflare

# COMANDOS

```bash
npm ci                      # instalar dependências (usa package-lock.json)
npm test -- --run           # suíte completa (vitest)
npx tsc --noEmit            # typecheck
npm run lint                # eslint
npm run build               # build de produção
supabase db push --linked --dry-run   # verificar migrations pendentes
supabase db push --linked --yes       # aplicar migrations
supabase functions deploy <fn> --yes --project-ref cixnvosxqlacjbpymjha
npx wrangler pages deploy dist --project-name growdash --branch main --commit-hash "$GIT_SHA"
gh run list --limit 5
```

# CONVENÇÕES DO REPOSITÓRIO

- Imports de shared code de Edge Function: `import { x } from "../_shared/nome.ts";` (sufixo `.ts` obrigatório)
- Funções Deno usam `Deno.serve(async (req) => {...})` e respondem JSON via helper local `json(body, status)`
- CORS: `Access-Control-Allow-Origin: "*"` **sem** `Access-Control-Allow-Credentials` é o padrão aceitável (gateway exige JWT). Nunca adicionar `Allow-Credentials` com origin reflexivo.
- Barreira de autorização em função pública (`verify_jwt = false`): segredo de escopo próprio + comparação em tempo constante, **nunca** comparar com `SUPABASE_SERVICE_ROLE_KEY`.
- Testes de contrato de infra leem arquivos como texto (`readFileSync`) e fazem `expect(...).toMatch(...)` — padrão em `src/lib/expertKpiLayout.test.ts` e `src/lib/loopEngineeringWorkflow.test.ts`
- Migração: nome `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`
- Commits: Conventional Commits. Branch `main` recebe push direto.

# ORDEM DE EXECUÇÃO

Execute os lotes em sequência. Dentro do lote, na ordem numerada.

| Lote | Achados | Portão de saída |
|---|---|---|
| L1 | GRO-SEC-001, 002, 003, 005, 006 | Nenhum dado de um tenant visível a outro; nenhum host de produção em arquivo versionado |
| L2 | GRO-AI-002, GRO-SEC-004, GRO-AI-001, GRO-OBS-003 | Service key não trafega como credencial; `max_tokens` presente; sync RD idempotente |
| L3 | GRO-OBS-001, 002, 004 | Erro de função chega ao Sentry com release; todo request tem `request_id`; alerta de 5xx ativo |
| L4 | GRO-INT-001 | `authenticated` não lê coluna de credencial; tokens rotacionados |
| L5 | GRO-PERF-002, GRO-PERF-001 | 429 em abuso de IA; reconciliação_rd com janela temporal |
| L6 | GRO-DATA-001, GRO-AI-003 | Constraints com `ON DELETE` decidido por tabela; fixtures de retrieval |

---

# LOTE 1 — FECHAR VAZAMENTOS DE TENANT E EXPOR SEGREDO

## 1.1 GRO-SEC-001 — `meta-connect-token` aceita escrita cross-tenant

**Estado atual (evidência):**
- `supabase/functions/meta-connect-token/index.ts:83-87` filtra a conta por `user_id` apenas
- `supabase/functions/meta-connect-token/index.ts:93-94` faz insert sem `workspace_id`
- Padrão correto já existe em `supabase/functions/ask-ai/index.ts:124-131` (resolve `workspace_members`)

**Correção:**
1. Em `meta-connect-token/index.ts`, após obter `caller` (L36), resolver o workspace ativo:
   ```ts
   const { data: membership } = await admin
     .from("workspace_members")
     .select("workspace_id")
     .eq("user_id", caller.id)
     .maybeSingle();
   ```
   Reutilizar o mesmo padrão de `resolveWorkspace` já existente no arquivo (L57) se presente.
2. Ao validar a conta Meta existente, exigir também o workspace:
   ```ts
   .eq("workspace_id", workspaceId)
   ```
3. No insert, gravar `workspace_id: workspaceId` junto de `user_id: caller.id`.
4. Se `body.workspace_id` vier preenchido e for diferente do resolvido, retornar 403.

**Teste de verificação:** novo `src/lib/metaConnectTokenScope.test.ts` lendo o fonte e exigindo `.eq("workspace_id"` e `workspace_id: workspaceId` no insert. Teste manual: chamar com conta de outro workspace e afirmar 403 e ausência de linha nova em `ad_accounts`.

**Rollback:** `git revert` do commit. Migration de backfill (se houver) deve ser reversível.

## 1.2 GRO-SEC-002 — `lead_report_share_rate_limits` sem RLS

**Correção:** criar `supabase/migrations/<timestamp>_rls_lead_report_share_rate_limits.sql`:
```sql
ALTER TABLE public.lead_report_share_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_report_share_rate_limits FROM anon, authenticated;
GRANT ALL ON public.lead_report_share_rate_limits TO service_role;
```
A tabela é escrita via service role, portanto nenhuma quebra esperada.

**Teste de verificação:**
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'lead_report_share_rate_limits';
```
Deve retornar `t`. E `supabase db push --linked --dry-run` deve listar a migration antes de aplicar.

**Rollback:** `DROP POLICY` se houver; `REVOKE ALL` + reativar sem RLS — reverter o commit e aplicar migration inversa.

## 1.3 GRO-SEC-003 — `crm-lead-webhook` grava em tenant divergente

**Correção:** em `supabase/functions/crm-lead-webhook/index.ts`, o `workspace_id` do insert deve vir **exclusivamente** de `endpoint.workspace_id` (já carregado em L73-77). Ignorar qualquer `workspace_id` vindo do payload. Adicionar comentário explicando que o payload nunca define tenant.

**Teste de verificação:** teste de integração com endpoint do workspace A e payload com `workspace_id` B; afirmar que o lead criado tem `workspace_id = A`.

**Rollback:** `git revert`.

## 1.4 GRO-SEC-005 — Host de produção e senha `admin` no repositório

**Correção:**
1. Em `docs/SDR_HOSTINGER_SUPABASE_MIGRATION_2026-11-02.md`, remover host, IP e caminhos absolutos de servidor. Substituir por referência indireta ("host de produção registrado no cofre de credenciais") mantendo o conteúdo técnico do contrato.
2. Verificar se o mesmo host/IP aparece em outros arquivos versionados: `grep -rn "srv1671115\|2\.24\.99\.35" --include='*.md' --include='*.sql' --include='*.ts' .` — corrigir todos.
3. **Rotação da senha padrão:** a migration `20261104000001_rotate_default_admin_password.sql` já invalida `admin@users.local` no ambiente linkado. Verificar que rodou em **todos** os ambientes. Se houver ambiente adicional (staging), aplicar a rotação lá.
4. **Não** tentar reescrever o histórico git neste lote — a rotação é o que neutraliza a exposição. Registrar a decisão no log de execução.

**Teste de verificação:**
```bash
grep -rn "srv1671115\|2\.24\.99\.35" --include='*.md' --include='*.sql' .   # deve retornar vazio
```
Autenticação com `admin@users.local` / `admin` deve falhar.

**Rollback:** reverter o commit do documento. A rotação de senha é irreversível por design (é o objetivo).

## 1.5 GRO-SEC-006 — Tabela `private` sem RLS

**Correção:** primeiro confirmar o conteúdo no banco (leitura de produção pode exigir permissão). Se contiver dados operacionais, criar migration habilitando RLS e revogando `anon`/`authenticated`. Se for resíduo sem uso, dropar em migration. Se o conteúdo não puder ser lido, registrar em "NÃO VERIFICADO" e **não** dropar às cegas.

**Teste de verificação:**
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'private';
```

**Rollback:** migration inversa (reabilitar sem RLS) ou `git revert` + reaplicar schema anterior.

**Portão do L1:** os 5 itens aplicados, `npm test -- --run` verde, `npx tsc --noEmit` sem erro, commit e push feitos, `audit/07-execution-log.md` atualizado.

---

# LOTE 2 — BARREIRA DE ACESSO, CUSTO DE IA E IDEMPOTÊNCIA

## 2.1 GRO-SEC-004 — Service key como credencial de chamada

**Estado atual:** `supabase/functions/rd-reconcile-metrics/index.ts:45-46` compara o Bearer com `serviceKey`.

**Correção:**
1. Criar migration com RPC de verificação de segredo, reaproveitando o padrão existente (`verify_daily_incremental_sync_secret`, usado em `historical-backfill/index.ts:80-82`):
   ```sql
   CREATE OR REPLACE FUNCTION public.verify_rd_reconcile_secret(candidate text)
   RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   BEGIN
     RETURN candidate IS NOT NULL
       AND candidate = current_setting('app.settings.rd_reconcile_secret', true);
   END; $$;
   ```
   Ajustar ao padrão real já adotado no repositório para os demais segredos.
2. Em `rd-reconcile-metrics/index.ts`, trocar a comparação por service key pela verificação do segredo de escopo.
3. Adicionar `RD_RECONCILE_SECRET` ao `.env.example` e ao `supabase secrets set` do CI.
4. Atualizar o agendador (pg_cron) para enviar o novo header — **na mesma mudança**, ou o job quebra.

**Teste de verificação:** sem Authorization → 401; com service key → 401; com o novo segredo → 200.

**Rollback:** reverter commit e migration; o segredo antigo continua válido até revogação.

## 2.2 GRO-AI-001 — `max_tokens` e registro de uso

**Correção:**
1. Em `supabase/functions/ask-ai/index.ts:504` e `supabase/functions/agent-office-chat/index.ts:40`, adicionar `max_tokens` explícito ao payload. Valor inicial recomendado: 2048 para `ask-ai`, 1500 para `agent-office-chat` (ajustar conforme respostas reais observadas).
2. Registrar `usage` (prompt_tokens, completion_tokens) por workspace. Para `stream: true`, extrair do evento final ou usar chamada não-streaming para leitura de usage.
3. Criar migration com tabela de uso: `workspace_id`, `function_name`, `prompt_tokens`, `completion_tokens`, `created_at`, com RLSEnable e política de leitura apenas para o próprio workspace.

**Teste de verificação:** stub do endpoint de IA em teste; afirmar que o payload contém `max_tokens` e que `usage` foi persistido.

**Rollback:** reverter commit; remover a tabela via migration de drop (ou mantê-la inativa).

## 2.3 GRO-AI-002 — Revalidar escopo por tool

**Depende de:** GRO-SEC-001 (mesma primitiva de escopo de workspace).

**Correção:** em `ask-ai`, `agent-office-chat` e `meta-traffic-mcp`, revalidar a posse de cada `account_id`/`funnel_id` **imediatamente antes** da consulta com service role, dentro do mesmo escopo da chamada. Se algum recurso tiver saído do workspace do caller, abortar com 403 e não incluir o recurso na resposta. Usar cache curto por requisição (Map local) para não duplicar consultas.

**Teste de verificação:** teste que concede acesso a um recurso, inicia a operação, remove o acesso, e confirma que o recurso removido não aparece no resultado.

**Rollback:** reverter commit. Comportamento anterior (aceitar recurso validado na entrada) é o fallback.

## 2.4 GRO-OBS-003 — Idempotência do sync RD

**Correção:**
1. Verificar se `rd_deals` já tem restrição de unicidade. Se não, criar migration que deduplica (mantendo a linha mais recente por `rd_funnel_id` + `rd_deal_id`) e então cria:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS rd_deals_funnel_deal_uidx
     ON public.rd_deals (rd_funnel_id, rd_deal_id);
   ```
2. Em `supabase/functions/sync-rd-crm/index.ts`, trocar o insert por upsert com `onConflict: "rd_funnel_id,rd_deal_id"`.

**Teste de verificação:** rodar o sync duas vezes com o mesmo payload; a contagem de `rd_deals` não deve mudar na segunda execução.

**Rollback:** a migration de índice único **não** tem rollback trivial se houver duplicatas legadas. Registrar backup da tabela antes de aplicar: `CREATE TABLE rd_deals_backup AS SELECT * FROM rd_deals;` em migration anterior à deduplicação.

**Portão do L2:** os 4 itens aplicados, testes verdes, commits e push feitos.

---

# LOTE 3 — OBSERVABILIDADE

## 3.1 GRO-OBS-001 — Sentry nas Edge Functions e no frontend

**Correção:**
1. Adicionar `@sentry/deno` como dependência de import (via `https://esm.sh/@sentry/deno@X`) nas funções de maior risco: `sync-meta-insights`, `sync-meta-leads`, `sync-rd-crm`, `crm-lead-webhook`, `ask-ai`, `agent-office-chat`.
2. Inicializar no topo do módulo lendo `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` (já configurados como secrets no CI por `.github/workflows/loop-engineering.yml:284-286`).
3. Envolver o handler em `try/catch` que reporta ao Sentry antes de responder 500. **Reutilizar o sanitizador existente** em `supabase/functions/_shared/sentrySync.ts:16` (`sanitizeSentryErrorMessage`) para não vazar PII.
4. No frontend: adicionar `@sentry/react` + `vite-plugin-sentry`, inicializar em `src/main.tsx` com o DSN público (`VITE_SENTRY_DSN`), e ativar upload de source maps no CI.

**Teste de verificação:** forçar exceção em staging; confirmar evento no Sentry com o release correto e sem PII na mensagem. `npm run build` com `SOURCEMAP=true` deve gerar `.map`.

**Rollback:** reverter commit. Sem efeito em schema.

## 3.2 GRO-OBS-002 — `request_id` em todas as Edge Functions

**Correção:**
1. Criar `supabase/functions/_shared/requestId.ts` com `resolveRequestId(req)`: aceita `x-request-id` do cliente se válido (UUID ou string curta segura), senão gera `crypto.randomUUID()`.
2. Em cada `Deno.serve`, resolver o id no início, injetar no header de resposta (`x-request-id`) e no corpo JSON das respostas de erro.
3. Propagar para as linhas de auditoria (`sync_execution_runs`, `job_runs`) quando aplicável.

**Teste de verificação:** `src/lib/requestId.test.ts` para o helper; chamada manual a uma função deve devolver o mesmo id no header e no corpo.

**Rollão:** reverter commit.

## 3.3 GRO-OBS-004 — Alertas de queda de login e pico de 5xx

**Depende de:** GRO-OBS-001.

**Correção:**
1. No projeto Sentry, criar alertas: taxa de erro por função, latência p95 e quedas de autenticação (contagem de falhas de login por janela).
2. Adicionar step de health check no `schedule` do workflow já existente: chamar `https://growdash.com.br/auth` e a API de insights, falhar se indisponível.

**Teste de verificação:** provocar erro 5xx em staging e confirmar disparo do alerta. Documentar no log de execução o canal configurado.

**Rollão:** reverter commit.

**Portão do L3:** os 3 itens aplicados; `npm run build` com sourcemaps gerado; eventos confirmados no Sentry.

---

# LOTE 4 — CREDENCIAIS DE TERCEIRO (GRO-INT-001)

**Correção:**
1. Migration: reduzir o SELECT de `authenticated` em `public.integrations` para colunas operacionais, e revogar explicitamente as colunas de credencial:
   ```sql
   REVOKE SELECT ON TABLE public.integrations FROM anon, authenticated;
   GRANT SELECT (id, user_id, provider, provider_account_id, is_active, token_expires_at, created_at, updated_at)
     ON public.integrations TO authenticated;
   GRANT ALL ON public.integrations TO service_role;
   ```
   Aplicar apenas as colunas que **existem** (verificar no schema antes — `api_token` e `webhook_secret` existem; `access_token`/`refresh_token`/`client_secret`/`oauth_state` foram removidas em `20260513155142_*`).
2. Mover tokens para o Supabase Vault (ou criptografia com chave do servidor) — a coluna `text` em claro deve deixar de conter segredo vivo.
3. **Rotacionar** todos os tokens de Google Workspace, Instagram e demais provedores que estejam em `api_token`, pois a coluna foi exposta a leitura via PostgREST até esta correção. Registrar quais foram rotacionados.

**Teste de verificação:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='integrations' AND column_name LIKE '%token%';
```
e confirmar que a role `authenticated` não consegue ler a coluna de credencial (consulta deve falhar).

**Rollão:** reverter commit e migration. **A rotação de token não tem rollback** — é o objetivo da correção. Registrar quais provedores foram rotacionados.

---

# LOTE 5 — CUSTO E LATÊNCIA

## 5.1 GRO-PERF-002 — Rate limit por usuário e workspace

**Depende de:** GRO-SEC-004 (distinguir caller interno de usuário final).

**Correção:**
1. Criar `supabase/functions/_shared/rateLimit.ts` com `enforceRateLimit(scope, key, limit, windowMs)` apoiado em tabela de contadores no Postgres (com TTL), ou em `Deno.Kv` se disponível no ambiente.
2. Migration com a tabela de contadores, RLS habilitado, escrita apenas via service role.
3. Aplicar às funções de IA (`ask-ai`, `agent-office-chat`) e às de escrita. Bypass para chamadas internas autenticadas por segredo de escopo.
4. Calibrar limites iniciais de forma conservadora e documentar o rationale.

**Teste de verificação:** teste que dispara N+1 requisições e afirma 429 na N+1.

**Rollão:** reverter commit; remover tabela via migration.

## 5.2 GRO-PERF-001 — Reconciliação RD com janela temporal

**Correção:**
1. Em `supabase/functions/rd-reconcile-metrics/index.ts`, substituir o `readAll` paginado por consulta com janela temporal: apenas negócios alterados desde a última execução, usando `updated_at`/`rd_updated_at` (confirmar o campo real antes) e um índice.
2. Migration com o índice sobre `(rd_funnel_id, <campo_de_atualizacao>)`.
3. Persistir cursor de última execução em `job_runs` (padrão já existente no repositório).

**Teste de verificação:** `EXPLAIN ANALYZE` da consulta nova deve mostrar uso do índice e redução de linhas lidas em relação à versão paginada.

**Rollão:** reverter commit e migration de índice.

**Portão do L5:** ambos aplicados; 429 comprovado; EXPLAIN documentado.

---

# LOTE 6 — HIGIENE DE DADOS E AVALIAÇÃO DE IA

## 6.1 GRO-DATA-001 — `ON DELETE` por tabela

**Correção:** produzir uma migration por grupo de tabelas, com decisão explícita por tabela:
- `ON DELETE CASCADE` onde o filho não tem valor sem o pai (ex.: `adsets` → `campaigns`)
- `ON DELETE SET NULL` onde o vínculo é opcional (ex.: referências de campanha em tabelas de log)

Antes de aplicar, listar constraints afetadas:
```sql
SELECT conrelid::regclass AS tabela, conname, confdeltype
FROM pg_constraint
WHERE contype='f' AND confdeltype='a';
```
Backup da tabela antes de qualquer deduplicação.

**Teste de verificação:** query acima deve retornar vazio para as tabelas já decididas. Teste de integração: excluir uma conta de anúncios com campanhas deve falhar com mensagem clara, não erro genérico.

**Rollão:** reverter migration (as constraints originais voltam com `NO ACTION`).

## 6.2 GRO-AI-003 — Conjunto de avaliação de retrieval

**Correção:** criar `src/lib/aiRetrievalEvaluation.test.ts` com fixtures sanitizadas (sem PII real) no formato: `{ período, conta, pergunta, fatosEsperados }`. O teste deve afirmar o JSON de contexto montado por `ask-ai`, **sem** depender da resposta do LLM. Congelar as fixtures.

**Teste de verificação:** `npx vitest run src/lib/aiRetrievalEvaluation.test.ts`

**Rollão:** remover o arquivo de teste.

**Portão do L6:** ambos aplicados.

---

# DEFINITION OF DONE GLOBAL

Antes de considerar a auditoria encerrada, TODOS estes itens precisam ser verdadeiros e **verificados**:

1. **Zero achado CRÍTICO aberto.** (A auditoria não encontrou CRÍTICO; os 5 ALTO precisam estar corrigidos ou com mitigação documentada e aceita.)
2. **Todo ALTO com correção aplicada ou mitigação documentada:** GRO-SEC-001, GRO-INT-001, GRO-AI-002, GRO-SEC-005, GRO-OBS-003.
3. **Suíte verde**, com **teste novo para cada correção ALTA ou superior**:
   - `npm test -- --run` → 0 falhas
   - `npx tsc --noEmit` → 0 erros
   - `npm run lint` → 0 erros
4. **Nenhum segredo de produção no código, no histórico recente ou no bundle.**
5. **RLS habilitado e testado em todas as tabelas com dado de tenant.** Verificar com a query de `pg_class` acima e documentar o resultado no log.
6. **Migrations aplicadas** — `supabase db push --linked --dry-run` deve retornar `upToDate: true`.
7. **Deploy publicado** — CI verde e `growdash.com.br` servindo a versão nova (comparar o hash do commit com o asset servido).
8. **`audit/04-remediation-prompt.md` permanece executável** por outro agente.
9. **`audit/07-execution-log.md` completo**, com evidência por item: feito, falho e pendente, com motivo objetivo.
10. **Registro de divergência:** se o repositório contradisser qualquer afirmação deste prompt, a divergência vai para o log de execução.

# REGRA DE ESCOPO DURANTE A EXECUÇÃO

Se durante a execução surgir um problema **fora** deste prompt (por exemplo, o build do Cloudflare Pages Git Provider falhando, ou um achado de frontend), **não** corrigir silenciosamente:

1. Registrar em `audit/07-execution-log.md` na seção "BACKLOG PÓS-AUDITORIA", com justificativa de risco e impacto.
2. Achado de frontend → `audit/08-backlog-frontend.md` com ID e evidência.
3. Mencionar o usuário no relatório final e AskUserQuestion com a decisão, quando a mudança exigir autorização.
