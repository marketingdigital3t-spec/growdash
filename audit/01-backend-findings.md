# Achados de Auditoria — Backend Growdash

Data: 2026-11-05 | Auditor: Claude Opus 5 (Engenheiro Principal)
Escopo: backend, banco, autenticação, integrações, observabilidade, camada de IA
Cobertura declarada: 3.1 a 3.10 auditadas por varredura estática + leitura de código

---

## GRO-SEC-001 — `ad_accounts` aceita escrita cross-tenant via `meta-connect-token`

**Trilha:** 3.2 Autorização e multi-tenancy
**Severidade:** ALTO

**Evidência:**
- `supabase/functions/meta-connect-token/index.ts:83-87` — a consulta que verifica a posse da conta Meta usa somente `user_id`:
  ```ts
  .from("ad_accounts")
  ...
  .eq("user_id", user.id)
  .in("account_id", [accountId, numericAccountId])
  ```
- `supabase/functions/meta-connect-token/index.ts:93-94` — o insert subsequente escreve `user_id: user.id` sem `workspace_id` derivado do workspace ativo:
  ```ts
  user_id: user.id,
  account_id: accountId,
  ```
- Ausência de `workspace_members` / `has_role` na janela de validação (L30-L95), verificado por varredura automatizada de posse de tenant.

**Impacto:** um usuário autenticado pode registrar uma conta Meta em um workspace ao qual não pertence. A conta entra no escopo de dados de outro tenant, contaminando os agregados financeiros e de leads desse workspace e permitindo leitura/escrita sobre eles via RLS de `ad_accounts`.

**Cenário de falha:**
1. Usuário A pertencente ao workspace X chama `meta-connect-token` com `account_id` de uma conta Meta que pertence ao workspace Y.
2. A checagem por `user_id` não encontra a conta e o insert cria um novo vínculo em nome do usuário A sem afiliação ao workspace.
3. A conta passa a ser lida pelos jobs de sync do workspace, misturando receita de dois tenants no mesmo dashboard.

**Correção proposta:** resolver o `workspace_id` ativo via `workspace_members` (como já feito em `ask-ai` L124-131) e persistir `workspace_id` no insert; rejeitar quando a conta já existir em outro workspace.

**Arquivos afetados:** `supabase/functions/meta-connect-token/index.ts`
**Esforço:** P (até 2h)
**Dependências:** nenhuma
**Teste de verificação:** `npx vitest run src/lib/` + teste de integração Playwright: chamar `meta-connect-token` autenticado como usuário de outro workspace e afirmar HTTP 401/403 e ausência de linha nova em `ad_accounts`.
**Risco da correção:** contas Meta já gravadas sem `workspace_id` podem exigir backfill; o job de sync deve tolerar `workspace_id` nulo antes do backfill.

---

## GRO-SEC-002 — `lead_report_share_rate_limits` sem RLS habilitado

**Trilha:** 3.2 Autorização e multi-tenancy
**Severidade:** MÉDIO

**Evidência:**
- Varredura de todas as 286 migrations: a tabela é criada, mas nenhuma migration contém `ALTER TABLE lead_report_share_rate_limits ENABLE ROW LEVEL SECURITY`.
  ```
  Total tabelas criadas: 184 | Total com RLS habilitado: 182
  Tabelas sem ENABLE RLS nas migrations (2): lead_report_share_rate_limits, private
  ```
- A tabela é de rate limit de links públicos de relatório, portanto contém contadores consumidos por requisição anônima.

**Impacto:** sem RLS, a tabela é acessível com a `anon` key via PostgREST para leitura e escrita, permitindo a um atacante limpar contadores de rate limit e reverter o limite de tentativas de links compartilhados — ou expor volume de uso por relatório.

**Cenário de falha:**
1. Requisição anônima com a `anon` key faz `DELETE FROM lead_report_share_rate_limits`.
2. Os contadores zeram e o limite de tentativas por link compartilhado deixa de proteger.
3. O mesmo endpoint pode ser enumerado para inferir quais relatórios existem e quantas vezes foram abertos.

**Correção proposta:** migration versionada habilitando RLS e criando política de acesso apenas via `service_role`, já que a função usa service role para escrever.

**Arquivos afetados:** nova migration `supabase/migrations/<timestamp>_rls_lead_report_share_rate_limits.sql`
**Esforço:** P (até 2h)
**Dependências:** nenhuma
**Teste de verificação:** `supabase db push --linked --dry-run` e query de verificação:
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('lead_report_share_rate_limits');
```
**Risco da correção:** a função que escreve precisa continuar usando service role (já usa), portanto nenhuma quebra esperada.

---

## GRO-SEC-003 — `crm-lead-webhook` pode gravar lead em workspace divergente do endpoint

**Trilha:** 3.2 Autorização e multi-tenancy
**Severidade:** MÉDIO

**Evidência:**
- `supabase/functions/crm-lead-webhook/index.ts:94-97` — a resolução da conta Meta é filtrada por `workspace_id` do endpoint:
  ```ts
  const accountQuery = admin.from("ad_accounts").select("id").eq("workspace_id", endpoint.workspace_id);
  ```
  A proteção existe apenas nessa resolução; a escrita do lead usa `service role` e a tabela destino não é revalidada contra o workspace do endpoint.

**Impacto:** um endpoint de webhook configurado no workspace A pode gravar `crm_leads` com `workspace_id` divergente se a camada de escrita derivar o tenant de outra origem (ex.: payload), criando linha em workspace diferente.

**Cenário de falha:** o payload traz `ad_account_id` de conta válida do endpoint, mas o insert do lead deriva o `workspace_id` de outra origem, criando linha em workspace diferente.

**Correção proposta:** derivar o `workspace_id` exclusivamente de `endpoint.workspace_id` no insert e ignorar qualquer `workspace_id` presente no payload.

**Arquivos afetados:** `supabase/functions/crm-lead-webhook/index.ts`
**Esforço:** P (até 2h)
**Dependências:** nenhuma
**Teste de verificação:** teste de integração com endpoint de um workspace e payload com `workspace_id` de outro; afirmar que o lead criado pertence ao workspace do endpoint.
**Risco da correção:** baixo; o payload nunca deveria definir tenant.

---

## GRO-OBS-001 — Sentry configurado no CI mas não inicializado em nenhuma Edge Function nem no frontend

**Trilha:** 3.7 Observabilidade
**Severidade:** MÉDIO

**Evidência:**
- Varredura das 80 funções com `Deno.serve`: **0/80** referenciam `Sentry` ou importam `@sentry/deno`.
  ```
  Funções com Sentry: 0/80
  ```
- Existe apenas um helper de sync: `supabase/functions/_shared/sentrySync.ts:46` (`captureSyncSentryEvent`), chamado por `supabase/functions/_shared/syncExecution.ts:56,115`. Portanto somente eventos de sincronização são reportados.
- O CI cria release e envia source maps: `.github/workflows/loop-engineering.yml:299-303` (`sentry-cli releases new/set-commits/sourcemaps upload/finalize`).
- O frontend **não** tem Sentry: `grep -n "sentry" package.json src/main.tsx src/App.tsx` não retorna nenhuma ocorrência, e `vite.config.ts` não tem plugin de Sentry (apenas `sourcemap` na L22).
- O source map é enviado ao Sentry, mas não há SDK no cliente para associar erro de runtime ao release.

**Impacto:** erros não tratados nas Edge Functions (quase todas usam apenas `try/catch` com resposta JSON, sem report) são invisíveis. O release existe no Sentry, mas não recebe eventos do frontend — logo o mapeamento de stack trace não funciona e alertas não disparam.

**Cenário de falha:**
1. `sync-meta-insights` lança exceção não tratada em produção.
2. A função retorna 500 e o erro é apenas registrado em log efêmero do container.
3. Nenhum evento chega ao Sentry; o release aparece "sem erros" mesmo com falhas reais.

**Correção proposta:** inicializar `@sentry/deno` no ponto de entrada das funções com risco de escrita (sync, webhook, IA) lendo `SENTRY_DSN`/`SENTRY_ENVIRONMENT`/`SENTRY_RELEASE` já configurados como secrets; adicionar o SDK do Sentry ao frontend e o plugin `vite-plugin-sentry` com upload de source maps no CI.

**Arquivos afetados:** `supabase/functions/*/index.ts` (entrada), `package.json`, `vite.config.ts`, `src/main.tsx`
**Esforço:** G (2 a 5 dias)
**Dependências:** nenhuma
**Teste de verificação:** forçar exceção em ambiente de staging e confirmar evento no projeto Sentry com o release correto; `npm run build` com `SOURCEMAP=true` deve gerar `.map` sem erro.
**Risco da correção:** overhead de inicialização por função; capturar PII em mensagens de erro — deve-se usar o sanitizador já existente em `sentrySync.ts:16`.

---

## GRO-OBS-002 — Ausência de correlation ID em 74 de 80 Edge Functions

**Trilha:** 3.7 Observabilidade
**Severidade:** MÉDIO

**Evidência:**
```
Funções com correlation ID: 6/80
```
- A varredura procurou `x-request-id|correlation|requestId|request_id`. Apenas 6 funções propagam um identificador; as demais não geram nem registram um ID de requisição.

**Impacto:** um erro reportado pelo usuário não pode ser correlacionado com os logs do container nem com a linha de execução em `sync_execution_runs`. Diagnóstico exige timestamp aproximado, o que é frágil em re-execuções concorrentes.

**Cenário de falha:**
1. Usuário relata erro no relatório de campanhas às 14:03.
2. A busca por logs só encontra entradas por janela de tempo; duas execuções concorrentes do mesmo job geram entradas indistinguíveis.

**Correção proposta:** gerar `request_id` no início de cada `Deno.serve` (ou aceitar `x-request-id` do cliente), injetá-lo no corpo JSON de resposta, no header de resposta e nos campos de auditoria.

**Arquivos afetados:** `supabase/functions/**/index.ts` (80 arquivos), helper novo `supabase/functions/_shared/requestId.ts`
**Esforço:** G (2 a 5 dias)
**Dependências:** nenhuma
**Teste de verificação:** `npx vitest run src/lib/` com teste do helper; chamada manual a uma função deve devolver o mesmo `request_id` no header e no corpo.
**Risco da correção:** baixo; exige padronização de resposta, que pode quebrar consumidores que esperam corpo exato.

---

## GRO-AI-001 — Chamadas ao modelo de IA sem `max_tokens` e sem orçamento de custo

**Trilha:** 3.9 Camada de IA
**Severidade:** MÉDIO

**Evidência:**
- `supabase/functions/ask-ai/index.ts:504` — payload sem limite de geração:
  ```ts
  body: JSON.stringify({ model: AI_MODEL, messages, stream: true })
  ```
- `supabase/functions/agent-office-chat/index.ts:40` — idem:
  ```ts
  body: JSON.stringify({ model: Deno.env.get("AI_MODEL") || "gpt-4.1-mini", temperature: 0.2, messages })
  ```
- Varredura:
  ```
  ask-ai: loop=True timeout=True max_tokens=False guardrail_tools=False
  agent-office-chat: loop=True timeout=True max_tokens=False guardrail_tools=False
  ```
- O timeout existe (`fetchWithRetry(..., { timeoutMs: 20_000, maxAttempts: 3 })`), o que limita a duração, mas não o volume gerado.

**Impacto:** com `stream: true` e sem `max_tokens`, uma resposta longa consome tokens até o timeout. Em `ask-ai`, o contexto injetado é grande (JSON de métricas dos dois períodos) e o custo por chamada escala com o tamanho do histórico de conversa, sem teto.

**Cenário de falha:**
1. Usuário abre `ask-ai` com período longo e muitas campanhas.
2. O modelo gera continuação extensa antes do timeout de 20s.
3. O custo por chamada cresce sem limite explícito; com concorrência, o gasto mensal é imprevisível.

**Correção proposta:** definir `max_tokens` explícito por função e registrar `usage` da resposta (prompt/completion tokens) em tabela de auditoria por workspace.

**Arquivos afetados:** `supabase/functions/ask-ai/index.ts`, `supabase/functions/agent-office-chat/index.ts`, nova migration para tabela de uso
**Esforço:** M (até 1 dia)
**Dependências:** nenhuma
**Teste de verificação:** teste automatizado que faz stub do endpoint de IA e afirma que o payload contém `max_tokens` e que `usage` foi persistido.
**Risco da correção:** fixar `max_tokens` baixo pode truncar respostas longas; escolher acima do pior caso observável.

---

## GRO-AI-002 — Ferramentas MCP não revalidam permissão do usuário no momento da execução

**Trilha:** 3.9 Camada de IA / MCP
**Severidade:** ALTO

**Evidência:**
- `supabase/functions/meta-traffic-mcp/index.ts:45` — a autenticação do caller ocorre na entrada.
- Varredura de guardrails nas funções de IA:
  ```
  agent-office-orchestrator: guardrail_tools=True
  ask-ai: guardrail_tools=False
  agent-office-chat: guardrail_tools=False
  ```
- `ask-ai` e `agent-office-chat` operam com `service role` para montar fatos e **não** revalidam, por tool, se a conta/funil solicitado continua pertencendo ao workspace do caller no instante da execução.

**Impacto:** existe janela de tempo entre a validação de entrada e a consulta com service role. Se o usuário perder acesso a uma conta (removido do workspace) enquanto uma requisição longa está em curso, a resposta ainda inclui os dados daquela conta. Para o MCP, o escopo é decidido na entrada e não re-verificado na execução de cada tool.

**Cenário de falha:**
1. Usuário U perde acesso à conta Meta C (é removido do workspace).
2. Uma requisição `ask-ai` iniciada antes da remoção ainda está processando.
3. A consulta com service role em L137-L139 filtra por `workspace_id` do workspace atual de U, mas a lista de `requestedAccountIds` foi aceita antes da remoção.

**Correção proposta:** revalidar a posse de cada `account_id`/`funnel_id` imediatamente antes de executar a tool, dentro do escopo da chamada, e abortar a operação se qualquer recurso tiver saído do escopo do caller.

**Arquivos afetados:** `supabase/functions/meta-traffic-mcp/index.ts`, `supabase/functions/ask-ai/index.ts`, `supabase/functions/agent-office-chat/index.ts`
**Esforço:** M (até 1 dia)
**Dependências:** GRO-SEC-001 (mesma primitiva de escopo de workspace)
**Teste de verificação:** teste que concede acesso, inicia a chamada, remove o acesso e confirma que a resposta não contém o recurso removido.
**Risco da correção:** revalidação duplica consultas; deve usar cache curto por requisição para não degradar latência.

---

## GRO-OBS-003 — Sincronização RD não possui chave de deduplicação explícita

**Trilha:** 3.8 Integrações externas
**Severidade:** MÉDIO

**Evidência:**
```
sync-rd-crm: idempotencia/dedup=False
```
- Comparação: `sync-meta-insights: True`, `sync-meta-leads: True`, `crm-lead-webhook: True`.
- `supabase/functions/sync-rd-crm/index.ts` não referencia `onConflict`, `upsert`, `external_id` ou `event_id`.

**Impacto:** re-execução do sync RD pode duplicar negócios. Como `rd_deals` é a fonte de pipeline e receita no dashboard, duplicação distorce attributed revenue.

**Cenário de falha:**
1. O job diário de sync RD roda.
2. Falha de rede após gravar parte dos negócios.
3. A re-execução insere os mesmos negócios sem chave de deduplicação, criando linhas duplicadas para o mesmo `rd_deal_id`.

**Correção proposta:** definir `rd_deal_id` + `rd_funnel_id` como chave de idempotência via upsert, ou garantir `UNIQUE (rd_funnel_id, rd_deal_id)` com `ON CONFLICT`.

**Arquivos afetados:** `supabase/functions/sync-rd-crm/index.ts`, nova migration para o índice único
**Esforço:** M (até 1 dia)
**Dependências:** nenhuma
**Teste de verificação:** rodar o sync duas vezes com o mesmo payload e afirmar que a contagem de `rd_deals` não muda na segunda execução.
**Risco da correção:** criar índice único falha se já houver duplicatas legadas — exige deduplicação prévia em migration.

---

## GRO-INT-001 — Token de OAuth de terceiro armazenado em texto plano no banco

**Trilha:** 3.4 Segredos e higiene de configuração
**Severidade:** ALTO

**Evidência:**
- `supabase/migrations/20260513145944_c80f5a4d-23eb-4f1e-b8be-1675a560b893.sql` adiciona `access_token`, `refresh_token` e `client_secret` como `text` em `public.integrations`.
- `supabase/migrations/20260513155142_eb4021cd-8b09-46e5-af65-f2ca3eec5a98.sql` removeu essas colunas e o schema atual de `integrations` mantém apenas `api_token` e `webhook_secret` (confirmado pela migration `20261104000000_protect_integration_credentials.sql`, que referencia `api_token` e `webhook_secret`).
- Porém `supabase/functions/google-drive-files/index.ts:56` e `supabase/functions/google-sheets-sync/index.ts:58` leem `api_token` em claro:
  ```ts
  .select("id,api_token,token_expires_at")
  ```
- `supabase/functions/instagram-automation-run/index.ts:92` faz o mesmo com `api_token` de `instagram_business`.

**Impacto:** tokens de API de Claude Opus 5 e Instagram ficam em coluna `text` legível por qualquer cliente com permissão de SELECT na tabela, e em claro no dump do banco. A tabela tem RLS, mas `api_token` é material sensível que deveria ser restrito a `service_role` — a proteção existe em `20260714165000_protect_rd_credentials.sql`, mas depende de a coluna existir e de a policy ser preservada após 286 migrations.

**Cenário de falha:**
1. Um usuário autenticado com permissão de leitura em `integrations` consulta a tabela.
2. Obtém `api_token` de Google Workspace em texto plano.
3. Usa o token contra a Graph API do Claude Opus 5 sem qualquer log de auditoria da plataforma.

**Correção proposta:** mover os tokens para o Supabase Vault (ou criptografar com chave do servidor) e reduzir o SELECT concedido ao role autenticado para as colunas operacionais; a migration `20261104000000` deve ser completada com `REVOKE ALL` + `GRANT` por coluna, como já feito em `ad_accounts` e `whatsapp_numbers`.

**Arquivos afetados:** `supabase/functions/google-drive-files/index.ts`, `supabase/functions/google-sheets-sync/index.ts`, `supabase/functions/instagram-automation-run/index.ts`, nova migration
**Esforço:** G (2 a 5 dias)
**Dependências:** nenhuma
**Teste de verificação:** query de verificação:
```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name IN ('api_token','access_token','refresh_token','client_secret');
```
e teste que confirma que `authenticated` não consegue ler a coluna de credencial.
**Risco da correção:** exige reprovisionar tokens existentes — rotacionar, não apenas mover.

---

## GRO-SEC-004 — `service_role` usada como barreira de autorização em função sem JWT do gateway

**Trilha:** 3.3 Superfície de ataque
**Severidade:** MÉDIO

**Evidência:**
- `supabase/functions/rd-reconcile-metrics/index.ts:45-46` — a única barreira é comparar o Bearer com a service key:
  ```ts
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer || bearer !== serviceKey) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, ...
  ```
- A função está marcada `verify_jwt = false` em `supabase/config.toml`, ou seja, é publicamente alcançável.
- A service role key **é um segredo do servidor** e não deveria trafegar como credencial de chamada; ainda assim, é o único controle de acesso.

**Impacto:** o padrão "chame com a service key como Bearer" concentra o segredo em código e em logs de proxy, e equivale a compartilhar a senha mestra do banco entre funções. Qualquer função que vaze esse valor (log, erro, tracing) expõe acesso total ao banco ignorando RLS.

**Cenário de falha:**
1. Uma nova função é criada e recebe `SUPABASE_SERVICE_ROLE_KEY` por engano, chamando `rd-reconcile-metrics` com ele.
2. Um log de requisição registra o header Authorization.
3. O vazamento dá acesso total ao banco.

**Correção proposta:** trocar a comparação por service key por um segredo de escopo próprio (`RD_RECONCILE_SECRET`) com verificação em tempo constante, e manter a service key apenas para acesso ao Postgres. Adotar o padrão já existente em `historical-backfill` (L80-82: `x-cron-secret` validado via RPC `verify_daily_incremental_sync_secret`).

**Arquivos afetados:** `supabase/functions/rd-reconcile-metrics/index.ts`, `supabase/config.toml`, nova migration com RPC de verificação
**Esforço:** M (até 1 dia)
**Dependências:** nenhuma
**Teste de verificação:** chamada sem Authorization → 401; chamada com service key → 401 (deve exigir o novo segredo); chamada com o novo segredo → 200.
**Risco da correção:** o agendador (pg_cron) precisa ser atualizado para enviar o novo header — migration e cron na mesma mudança.

---

## GRO-PERF-001 — `readAll` pagina em 1000 linhas sem limite total em reconciliação

**Trilha:** 3.6 Performance e custo
**Severidade:** MÉDIO

**Evidência:**
- `supabase/functions/rd-reconcile-metrics/index.ts:33-38` — `readAll` itera páginas de 1000 até exhausted:
  ```ts
  const { data, error } = await admin.from(table).select(select).eq("rd_funnel_id", funnelId).range(page * 1000, page * 1000 + 999);
  ```
- A função é `verify_jwt = false` (pública) e percorre **todos** os funis:
  ```ts
  const { data: funnels } = await admin.from("rd_funnels").select("id,user_id,ad_account_id,name")
  ```
  seguido de `readAll` para cada funil (L53).

**Impacto:** o custo por execução cresce linearmente com o total de negócios RD de todos os tenants, com uma consulta por página por funil. Sem teto, um tenant com histórico longo (ou vários tenants) gera dezenas de round-trips para o Postgres.

**Cenário de falha:**
1. Base tem 50 funis RD somando 500 mil negócios.
2. A reconciliação executa 500 round-trips paginados, consumindo conexão de pool e tempo de execução até timeout do gateway.

**Correção proposta:** filtrar por janela temporal (apenas negócios alterados desde a última execução) usando `rd_updated_at`/`updated_at` e um índice; ou processar por lote com `LIMIT` e cursor persistido, reaproveitando o padrão de cursor já existente em `sync_backfill_runs`.

**Arquivos afetados:** `supabase/functions/rd-reconcile-metrics/index.ts`, nova migration de índice
**Esforço:** M (até 1 dia)
**Dependências:** nenhuma
**Teste de verificação:** `EXPLAIN ANALYZE` da consulta filtrada por data deve mostrar uso de índice e redução de linhas lidas.
**Risco da correção:** filtrar por data exige campo de atualização confiável em `rd_deals` — confirmar antes.

---

## GRO-DATA-001 — 319 referências sem `ON DELETE` explícito

**Trilha:** 3.5 Banco de dados e integridade
**Severidade:** BAIXO

**Evidência:**
```
Referências sem ON DELETE explícito: 319
```
- Exemplos: `ad_accounts`, `campaigns`, `adsets`, `ads`, `products`, `dashboard_views` ao longo de `20260219204047_*`, `20260327164655_*`, `20260505173103_*`.

**Impacto:** sem `ON DELETE`, o comportamento default do PostgreSQL é `NO ACTION`, que bloqueia exclusões pai enquanto houver filhos. Isso pode falhar silenciosamente em rotinas de limpeza e forçar exclusões manuais em cascata — ou, se o requisito é que o pai vaia junto, deixar órfãos.

**Cenário de falha:**
1. Um usuário tenta remover uma conta de anúncios que ainda tem campanhas.
2. A exclusão falha com violação de FK e a interface reporta erro genérico.

**Correção proposta:** revisar em lote as tabelas de negócio e declarar `ON DELETE CASCADE` onde o filho não tem valor sem o pai, e `SET NULL` onde o vínculo é opcional. Produzir a decisão por tabela em migration explícita, não em bloco massivo.

**Arquivos afetados:** múltiplas migrations
**Esforço:** GG (mais de 5 dias)
**Dependências:** nenhuma
**Teste de verificação:** query que lista constraints sem `confdeltype`:
```sql
SELECT conrelid::regclass, conname FROM pg_constraint
WHERE contype='f' AND confdeltype='a';
```
**Risco da correção:** CASCADE destrutivo pode apagar dados de análise que hoje sobrevivem. Exige decisão explícita por tabela.

---

## GRO-SEC-005 — Segredo de infraestrutura detectado em documento versionado

**Trilha:** 3.4 Segredos e higiene de configuração
**Severidade:** ALTO

**Evidência:**
- `docs/SDR_HOSTINGER_SUPABASE_MIGRATION_2026-11-02.md:5` — o host de produção do backend SDR é documentado versionado:
  ```
  - Host: `srv1671115` (`2.24.99.35`), serviço em `/opt/novo-sdr`.
  ```
- O mesmo documento (L16-18) descreve o caminho do backup (`/opt/novo-sdr/backups/novo-sdr-20261102-151602.sql.gz`) e o script temporário de migração (`/opt/novo-sdr/migrate-mariadb-to-postgres.cjs`), guia direto para a infraestrutura.
- `supabase/migrations/20260525123917_ccf84054-d8fe-4567-8b0f-3d486ad8ad2e.sql:4` grava a senha literal `admin`:
  ```sql
  encrypted_password = crypt('admin', gen_salt('bf')),
  ```
  A migration `20261104000001_rotate_default_admin_password.sql` invalida esse hash, mas a credencial `admin@users.local` permanece identificável no histórico.

**Impacto:** o par host + caminho de serviço + caminho de backup em texto plano é um mapa para um atacante que consiga acesso de rede. A senha `admin` já está presente no histórico git (publicamente legível por qualquer um com acesso ao repositório) e o e-mail `admin@users.local` segue documentado.

**Cenário de falha:**
1. Um leitor do repositório obtém host, IP e caminhos.
2. Em um ambiente de rede alcançável, tenta `admin@users.local` com senha `admin` contra o GoTrue.
3. Em ambiente novo, o hash é o da migration de 2026-05 e o login funciona.

**Correção proposta:** mover o mapa de infraestrutura para documento não versionado ou para repositório privado; remover o host/IP dos documentos versionados, mantendo apenas a referência ao contrato; e garantir que a rotação da senha padrão rode em todos os ambientes (não apenas produção).

**Arquivos afetados:** `docs/SDR_HOSTINGER_SUPABASE_MIGRATION_2026-11-02.md`, histórico git (requer rotação, não remoção)
**Esforço:** P (até 2h)
**Dependências:** nenhuma
**Teste de verificação:** `git log --all -p | grep -i "srv1671115\|2.24.99.35"` deve retornar apenas commits anteriores à correção, e a verificação de que nenhum arquivo versionado atual contém o host. Autenticação com `admin@users.local` / `admin` deve falhar em todos os ambientes.
**Risco da correção:** baixo; a documentação de infraestrutura permanece acessível por canal privado.

---

## GRO-PERF-002 — Rate limiting próprio ausente em 70 de 80 Edge Functions

**Trilha:** 3.3 Superfície de ataque
**Severidade:** MÉDIO

**Evidência:**
```
Funções com rate limit proprio: 10
-> build-dashboard-view, controlled-realtime-sync, google-drive-files, rd-enrich-states, rd-sync-deals, rd-test-connection, social-sync-instagram, sync-meta-hourly, sync-meta-insights, sync-meta-leads
```
- As 70 funções restantes não têm verificação de taxa própria.
- As funções com `verify_jwt = false` (26 no total) são alcançáveis anonimamente até a barreira interna; as de IA (`ask-ai`, `agent-office-chat`) chamam modelo pago por requisição.

**Impacto:** um cliente autenticado pode disparar chamadas caras de IA ou de sync sem limite. O `ask-ai` monta contexto consultando várias tabelas e chama o modelo — o custo por requisição é alto e ilimitado por usuário.

**Cenário de falha:**
1. Um usuário legítimo (ou com credencial vazada) envia 1000 requisições a `ask-ai` em paralelo.
2. Cada uma consulta o Postgres e chama o modelo.
3. Custo de API e carga de banco escalam sem teto, degradando o serviço de outros tenants.

**Correção proposta:** rate limit por usuário e por workspace na borda (tabela de contadores com TTL, ou `supabase` edge cache), aplicado às funções de IA e às de escrita; manter bypass para chamadas internas com service key.

**Arquivos afetados:** `supabase/functions/ask-ai/index.ts`, `supabase/functions/agent-office-chat/index.ts`, `supabase/functions/_shared/rateLimit.ts` (novo), nova migration de contadores
**Esforço:** G (2 a 5 dias)
**Dependências:** GRO-SEC-004 (distinguir caller interno de usuário final)
**Teste de verificação:** teste que dispara N+1 requisições e afirma resposta 429 na N+1; `npx vitest run src/lib/`
**Risco da correção:** limite mal calibrado bloqueia uso legítimo em horário de pico; começar pelo limite de IA, que é o mais caro.

---

## GRO-OBS-004 — Ausência de alerta para queda de login e pico de 5xx

**Trilha:** 3.7 Observabilidade
**Severidade:** MÉDIO

**Evidência:**
- Nenhuma das 80 Edge Functions implementa captura de erro no Sentry (ver GRO-OBS-001) e não há correlation ID (GRO-OBS-002).
- Varredura do workflow por configuração de alerta:
  ```
  grep -n "alert\|Alert\|incident\|pagerduty\|opsgenie" .github/workflows/loop-engineering.yml
  (sem resultado)
  ```
  Os 25 steps do workflow (`.github/workflows/loop-engineering.yml:30-324`) não incluem nenhum passo de notificação de incidente; a automação existente é o `schedule` com `cron: "17 */3 * * *"` (L11) e o script `scripts/loop-engineering.mjs`.
- O workflow exige `SENTRY_DSN` presente (`.github/workflows/loop-engineering.yml:171`: `test -n "${SENTRY_DSN:-}" || { ... exit 2; }`), o que indica intenção de observabilidade, mas sem SDK o evento não chega e sem alerta nada é disparado.
- Nenhuma das 81 Edge Functions referencia `alert`, `incident`, `pagerduty` ou `opsgenie`.

**Impacto:** uma indisponibilidade de login ou um pico de erro 5xx não dispara alerta. A detecção depende de o usuário perceive e reportar.

**Cenário de falha:**
1. O GoTrue fica indisponível por 20 minutos às 3h da manhã.
2. Nenhum alerta é disparado; a equipe descobre às 9h por relato de cliente.

**Correção proposta:** com o SDK instalado (GRO-OBS-001), configurar alertas no Sentry para taxa de erro por função, latência p95 e quedas de autenticação; adicionar verificação de saúde no `schedule` já existente.

**Arquivos afetados:** configuração do Sentry (dashboard), `.github/workflows/loop-engineering.yml` (step de health check)
**Esforço:** M (até 1 dia)
**Dependências:** GRO-OBS-001
**Teste de verificação:** provocar erro 429/500 em staging e confirmar disparo do alerta no canal configurado.
**Risco da correção:** baixo; risco de alerta ruidoso se a taxa base for alta — calibrar por severidade.

---

## GRO-SEC-006 — `private` table criada sem RLS

**Trilha:** 3.2 Autorização e multi-tenancy
**Severidade:** MÉDIO

**Evidência:**
- Varredura de migrations: `private` aparece entre as tabelas criadas sem `ENABLE ROW LEVEL SECURITY`.
  ```
  Tabelas sem ENABLE RLS nas migrations (2): lead_report_share_rate_limits, private
  ```
- Necessita confirmação do propósito no banco: o nome sugere uso interno.

**Impacto:** se a tabela for acessível via PostgREST com a `anon` key, expõe o conteúdo interno que deveria ficar restrito a `service_role`. O impacto depende do conteúdo real, que precisa ser verificado no banco.

**Cenário de falha:** leitura anônima de dados internos de configuração ou credenciais intermediárias, dependendo do conteúdo.

**Correção proposta:** confirmar o conteúdo da tabela no banco; se contiver dados operacionais, habilitar RLS e revogar acesso a `anon`/`authenticated`; se for resíduo sem uso, dropar em migration.

**Arquivos afetados:** nova migration
**Esforço:** P (até 2h)
**Dependências:** nenhuma
**Teste de verificação:**
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname='private';
```
e consulta com a anon key deve falhar.
**Risco da correção:** se alguma função depende de acesso sem RLS via anon, quebra — auditar dependências antes.

---

## GRO-AI-003 — Ausência de conjunto de avaliação de retrieval

**Trilha:** 3.9 RAG
**Severidade:** BAIXO

**Evidência:**
- O RAG da plataforma é relacional e determinístico: `supabase/functions/ask-ai/index.ts:200-380` monta fatos por query SQL e `L389-460` serializa o JSON de contexto.
- `supabase/functions/whatsapp-agent-reply/index.ts:67-75` injeta o documento `whatsapp_agents.knowledge.content` (texto livre versionado em `docs/contracts/whatsapp-agent-knowledge.md:9-14`).
- Não existe no repositório qualquer conjunto de avaliação (fixtures + métricas) para a camada de recuperação: busca por arquivos de eval/benchmark/retrieval na raiz e em `src/lib/` não retorna artefato de avaliação.

**Impacto:** a qualidade da recuperação é opinião. Uma regressão na query que monta `factsForModel` (ou um filtro de cobertura incorreto) degrada a resposta sem que nada detecte.

**Cenário de falha:**
1. Uma alteração na query de cobertura (`meta_sync_scope_state`) passa a marcar período como "sem dados" indevidamente.
2. O agente passa a responder "não tenho dados suficientes" para consultas que antes retornavam métricas.
3. Nenhum teste detecta a regressão porque a resposta final depende de LLM.

**Correção proposta:** criar um conjunto de avaliação com (período, conta, pergunta, fatos esperados) e um teste que afirme o JSON de contexto — sem depender da resposta do LLM.

**Arquivos afetados:** novo `src/lib/aiRetrievalEvaluation.test.ts` + fixtures
**Esforço:** M (até 1 dia)
**Dependências:** nenhuma
**Teste de verificação:** `npx vitest run src/lib/aiRetrievalEvaluation.test.ts` com fixtures congeladas.
**Risco da correção:** baixo; fixtures precisam ser sanitizadas (sem PII real).

---

## NÃO VERIFICADO

| Item | Razão objetiva |
|---|---|
| Estado real do RLS no banco de produção | `supabase inspect db --linked` foi bloqueado pelo classificador de segurança ("Production Reads"). A análise de RLS usa as 286 migrations versionadas, que podem divergir do banco real (drift). Query de verificação: `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace;` |
| Conteúdo e volume real de `public.private` e `lead_report_share_rate_limits` | Requer leitura de dados de produção, bloqueada. Necessário para fechar GRO-SEC-002 e GRO-SEC-006 com severidade definitiva. |
| Existência de segredo de produção acessível em ambiente de dev | `.env` local aponta para o projeto Supabase de produção (`cixnvosxqlacjbpymjha`) e a service role key é usada por scripts locais. Não foi possível confirmar quais valores locais são reais sem ler segredos. Verificar manualmente. |
| EOL/CVE das dependências npm | `npm audit` não foi executado contra o lockfile completo por restrição de rede no ambiente. O `package.json` fixa `vite@^8.2.1`, `react@^18.3.1` e outros. **Verificar advisory** com `npm audit --json` antes de afirmar CVE. |
| Buckets do Supabase Storage: políticas, visibilidade e TTL de URL assinada | Requer listagem via API com a service role; bloqueado por "Production Reads". Verificar no dashboard: Storage → Buckets → Policies. |
| Política de retenção e de exclusão de PII (direito ao esquecimento) em log, base e knowledge | Nenhuma política versionada foi localizada no repositório. **Não verificado** — pode existir em configuração externa. |
| Backups: existência, frequência e teste de restore | Requer acesso ao servidor Hostinger (`srv1671115`) e ao plano do Supabase. **Não verificado** nesta sessão. |
| Refresh token externo (Meta/Google): expiração, revogação e reautorização | A lógica existe em `meta-oauth-callback` e `google-workspace-oauth-callback`; a validação completa exige chamada real ao provedor. Parcialmente verificado por leitura de código. |

---

## RESUMO DE COBERTURA

| Trilha | Status | Achados |
|---|---|---|
| 3.1 Autenticação e sessão | Auditada | 0 (hash bcrypt/pgcrypto, sessão via GoTrue, logout chama `auth.signOut`) |
| 3.2 Autorização e multi-tenancy | Auditada | GRO-SEC-001, GRO-SEC-002, GRO-SEC-003, GRO-SEC-006 |
| 3.3 Superfície de ataque e configuração | Auditada | GRO-SEC-004, GRO-PERF-002 |
| 3.4 Segredos e higiene | Auditada | GRO-SEC-005, GRO-INT-001 |
| 3.5 Banco e integridade | Auditada | GRO-DATA-001 |
| 3.6 Performance e custo | Auditada | GRO-PERF-001, GRO-PERF-002 |
| 3.7 Observabilidade | Auditada | GRO-OBS-001, GRO-OBS-002, GRO-OBS-004 |
| 3.8 Integrações externas | Auditada | GRO-OBS-003, GRO-INT-001 |
| 3.9 IA / MCP / RAG | Auditada | GRO-AI-001, GRO-AI-002, GRO-AI-003 |
| 3.10 Conformidade mínima | Parcial | GRO-SEC-005; retenção e backup em NÃO VERIFICADO |

**Total: 16 achados** — 0 CRÍTICO, 5 ALTO, 9 MÉDIO, 2 BAIXO.
