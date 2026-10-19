# Prompt master — orquestração e reparo de backend Growdash

## Missão

Audite e corrija o backend da Growdash com evidência verificável, preservando
dados existentes e sem inventar paridade. O escopo inclui Supabase/Edge
Functions, PostgreSQL/RLS, sincronização Meta Ads e RD Station, webhooks,
MCP/RAG/IA, OAuth, observabilidade, filas e jobs agendados.

O RD Station é a fonte canônica para negócios, etapas, oportunidades, vendas e
histórico de CRM. Meta é fonte de entrega/atribuição de mídia. CRM próprio,
MCP, RAG e agentes são consumidores analíticos; nunca podem criar, completar
ou substituir fatos canônicos nos cards ou no espelho RD.

## Regras de segurança e escopo

1. Autenticar cada chamada conforme o contrato: sessão do usuário para
   operações do workspace; service role ou segredo rotacionável somente para
   jobs/webhooks internos. Nunca aceitar `user_id`, `workspace_id`, conta ou
   funil sem verificar pertencimento no servidor.
2. Nunca retornar, registrar ou incluir em prompts tokens Meta/RD/Google,
   secrets, payload bruto de webhook ou PII além do necessário. Mensagens
   públicas devem ser sanitizadas; detalhes ficam apenas em logs internos
   mínimos e não sensíveis.
3. Toda leitura de dados deve informar origem, escopo, cobertura e estado
   (`loading`, `fresh`, `syncing`, `partial`, `error`, `unavailable` ou
   `empty_confirmed`). Erro, timeout, lock ou paginação incompleta não pode
   virar zero.
4. Identidade RD é `rd_connection_id + rd_deal_id`; identidade Meta deve usar
   a conta interna e o ID externo persistido. Deduplicar antes de agregar.
5. Datas são civis, inclusivas e interpretadas no timezone da conta. Não usar
   `toISOString()` para decidir o dia do negócio sem conversão explícita.
6. Sincronização é idempotente, paginada e retomável. Falhas preservam o último
   snapshot válido; watermark só avança após sucesso completo. Runs órfãos são
   encerrados de forma auditável e existe no máximo um run ativo por escopo.
7. Webhooks validam método, tamanho, segredo em tempo constante, idempotência e
   escopo. Um 2xx de transporte não pode ser registrado como sucesso de dados
   quando a reconciliação é parcial.
8. MCP/RAG/IA recebem fatos já escopados e não usam memória da conversa,
   `insights.leads`, inferência de UTM ou agregados sem vínculo para preencher
   atributos. Recomendações não executam mutações sem aprovação explícita.

## Orquestração determinística

Trabalhe nesta ordem, registrando evidências no repositório:

1. **Inventário:** Git/branch/remoto, funções e `verify_jwt`, migrations,
   tabelas, RLS, contratos, jobs, MCP/RAG e consumidores Meta/RD.
2. **Type-check de Edge Functions:** executar `deno check` por função; corrigir
   erros reais de símbolos, consultas e tipos antes de alterar comportamento.
3. **Contrato de dados:** localizar a migration/contrato existente antes de
   criar campo, endpoint, evento ou estado. Se faltar contrato, criar migration
   versionada com RLS, grants, idempotência, índices e teste.
4. **Auth/RLS:** conferir escopo por workspace, usuário, conta e funil; revisar
   callbacks OAuth, segredos de cron e webhooks sem JWT.
5. **Sincronização:** verificar cursores, paginação até página curta, retries
   limitados, timeout, locks, watermarks, preservação de snapshot e status
   parcial.
6. **Meta/RD:** comparar somente mesmo escopo (conta/conexão, funil,
   período, timezone e regra de data); validar Meta token/permissions sem
   tentar contornar 2FA/SMS; testar backfill e reconciliação com dados reais
   somente quando autorizados.
7. **MCP/RAG/IA:** validar que leitores consultam snapshots canônicos,
   propagam cobertura e não substituem números da interface; limitar histórico
   e sanitizar entradas.
8. **Jobs e observabilidade:** cada execução grava início/fim, status, páginas,
   linhas, escopo e erro sanitizado. Não declarar “webhook em tempo real” sem
   evento auditável persistido.
9. **Verificação:** TypeScript, ESLint, Vitest, build, `git diff --check`,
   `deno check`, `supabase db lint --linked`, smoke tests HTTP 401/405/413 e
   validação pós-publicação separada para Supabase, Cloudflare e navegador.

## Critérios de aceite

- Nenhuma Edge Function relevante falha no type-check por símbolo inexistente,
  coluna não selecionada ou contrato incompatível.
- Endpoints sem JWT aceitam somente o segredo/assinatura prevista e recusam
  chamadas anônimas.
- Conta, workspace, conexão e funil nunca atravessam o escopo autorizado.
- Paginação não impõe teto silencioso; cobertura incompleta aparece como
  `partial`/`unavailable`.
- Timeout ou falha de Meta/RD preserva o snapshot anterior e o watermark.
- Meta, RD, CRM próprio, MCP e RAG exibem fontes e definições distintas.
- Webhooks repetidos não criam negócio, lead ou venda duplicados.
- Nenhum token ou payload sensível aparece em resposta, prompt ou log.
- O que foi corrigido localmente, commitado, publicado e verificado é relatado
  em camadas separadas; pendências de OAuth, SMS, credenciais ou paridade real
  ficam explícitas.

## Execução inicial — 19/10/2026

- Checkout: `/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash`.
- Branch: `main`, alinhada com `origin/main` antes da alteração.
- Testes existentes: 99 arquivos / 491 testes aprovados.
- `supabase functions list` confirmou as Edge Functions ativas do projeto
  `cixnvosxqlacjbpymjha`; `supabase db lint --linked --level error` não apontou
  erros de schema.
- O type-check encontrou e corrigiu dois defeitos em
  `agent-office-orchestrator`: leitura de `last_error` que não estava no
  `select` (usado o campo persistido `last_sync_error`) e referência a
  `workspaceId` inexistente (substituída por `workspace.id`).
- A execução ainda não autoriza afirmar que todos os tokens, contas Meta/RD,
  backfills ou MCPs estão operacionalmente saudáveis. Isso exige credenciais,
  escopo autenticado e verificação dos dados vivos.

## Evidência pós-publicação — 19/10/2026

- Commit verificado: `bbc177b` (`main` e `origin/main` alinhadas), sem alterações
  pendentes no checkout.
- Cloudflare Pages: `https://d37e30e9.growdash.pages.dev/` publicado e os
  domínios `https://growdash.com.br/` e `https://www.growdash.com.br/` retornam
  HTTP 200, CSP e cabeçalhos de segurança esperados.
- O HTML servido pelos três endereços referencia `/assets/app-BwMBlERs.js` e o
  SHA-256 do bundle remoto é
  `a69beb60bed8244640bbf3752dfe00ac6a6de7267ccf385b8fb822b68771ceb1`, igual ao
  `dist` gerado localmente.
- Smoke sem sessão: `agent-office-orchestrator`, `controlled-realtime-sync`,
  `rd-sync-deals` (com `funnel_id`), `sync-rd-crm`, `meta-traffic-mcp` e
  `sync-meta-transactions` recusaram a chamada com HTTP 401. O callback
  `instagram-oauth-callback` é deliberadamente público para o redirect OAuth e,
  sem `state`, respondeu HTTP 400; isso não é evidência de uma conexão válida.
- Funções publicadas no Supabase `cixnvosxqlacjbpymjha`: versões registradas
  incluem `agent-office-orchestrator` v20, `controlled-realtime-sync` v55,
  `rd-sync-deals` v99, `sync-rd-crm` v32, `meta-traffic-mcp` v19,
  `sync-meta-transactions` v20 e `instagram-oauth-callback` v23.
- Ainda não verificado: login autenticado, tokens atuais Meta/RD/Google,
  desafio SMS, backfill histórico, reconciliação de contagens em
  `meta_leads`/`rd_deals`/CRM, RAG com dados vivos e inspeção visual autenticada.
  Esses itens permanecem pendentes e não devem ser marcados como concluídos
  apenas por causa do build, deploy ou HTTP 200.

## Evidência autenticada pós-deploy — 19/10/2026

- A sessão autenticada do Growdash exibiu 33 contas Meta/RD conectadas; o token
  RD foi validado e há 23 funis ativos vinculados. Meta indicava snapshot há
  cerca de 3 minutos e RD há cerca de 23 minutos no momento da inspeção.
- Uma sincronização RD manual foi disparada pelo diagnóstico. O histórico passou
  a registrar execuções recentes (por exemplo, 60 deals em 78 s), mas o funil
  `Instituto Palazzo RD` continuou com último negócio em `08/10/2026`; portanto
  a sincronização executada não prova que esse funil esteja recebendo dados novos.
- O confronto autenticado continua inconsistente: 27 vendas canônicas RD contra
  15 vendas em campanhas, divergência indicada de 44%, e match de campanhas em
  0% para o conjunto exibido. A receita exibida é R$ 93.700,00 nas duas fontes,
  então a diferença de contagem não deve ser tratada como paridade.
- Diagnóstico de UTMs autenticado: 776/1.000 deals (78%) sem UTM completo,
  262 deals com `utm_campaign` sem correspondência a campanha Meta e 4 funis
  sem deals recentes. Isso exige dados/UTMs reais ou backfill autorizado; não
  pode ser corrigido por inferência de nome de campanha.
- Observabilidade autenticada: base de 6.217 deals em 30 dias, UTMs completos
  em 25%, responsáveis preenchidos em 100%, vitórias com valor em 62%, e
  atribuição multi-touch em 0% (toques e toques casados com Meta). O painel
  recomenda backfill, mas o resultado do backfill ainda não foi comprovado.
- Escritório de agentes autenticado registrou a conversa, porém informa que a
  IA ainda não está configurada no backend e consultou 0 linhas Meta. O
  inventário de segredos do projeto não contém `AI_API_KEY` nem
  `OPENAI_API_KEY`; não criar ou inventar chave. A habilitação depende de uma
  credencial fornecida/rotacionada pelo operador.
- Estado correto após essa inspeção: código, contratos, deploy e autenticação
  básica estão verificados; sincronização parcial ocorreu; reconciliação Meta/RD,
  UTMs, backfill de atribuição, RAG vivo e IA dos agentes permanecem
  `partial`/`unavailable` até haver execução autenticada bem-sucedida e contagens
  persistidas que confirmem a correção.

## Evidência final de Pages — 19/10/2026

- Os builds automáticos do Git para `c753198` e `1bb8e8a` apareceram como
  `Failure` no histórico do Pages, apesar de `npm run build` passar localmente.
  Esse sinal é de integração de build do Pages e não foi mascarado.
- O mesmo `dist` foi publicado manualmente com sucesso no deployment
  `https://c02e2e05.growdash.pages.dev/` (source `1bb8e8a`).
- `growdash.com.br`, `www.growdash.com.br` e `c02e2e05.growdash.pages.dev` retornam
  HTML byte-a-byte igual e o bundle SHA-256
  `a69beb60bed8244640bbf3752dfe00ac6a6de7267ccf385b8fb822b68771ceb1`.
