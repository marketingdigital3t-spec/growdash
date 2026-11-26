# Auditoria de backend — Meta Ads, RD Station e automações

Data: 22/10/2026  
Escopo: Edge Functions, migrations, autenticação, idempotência, concorrência e sincronização Meta Ads ↔ RD Station.

## Evidências e limites

- `npm test`: 120 arquivos, 562 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado; apenas aviso de chunks grandes.
- ESLint direcionado às funções alteradas: aprovado.
- `npm run lint` geral não concluiu no tempo de diagnóstico; a configuração já ignora `dist`, portanto não foi classificado como defeito de runtime.
- A verificação de dados reais ficou bloqueada sem sessão/segredo: chamadas a `daily-incremental-sync` e `controlled-realtime-sync` retornaram 401, comportamento esperado.
- O backend não possui estado de tema claro/escuro; essa dimensão é não aplicável às Edge Functions, migrations e políticas. Contratos de erro e payload foram revisados para não depender de apresentação visual.

## Achados confirmados

| ID | Severidade | Arquivo | Evidência | Impacto | Correção | Validação |
|---|---|---|---|---|---|---|
| BE-001 | Alta | `supabase/functions/workflow-webhook/index.ts`; `WorkflowEditor.tsx` | O handler aceitava `secret_hash IS NULL`; o editor permitia publicar webhook sem segredo | Qualquer pessoa com o path podia disparar workflow e efeitos externos | Exigir segredo no editor e rejeitar webhook ativo legado sem segredo; limitar payload a 256 KB | Build, testes e migration; webhook sem segredo retorna 503, segredo ausente/incorreto retorna 401 |
| BE-002 | Alta | `supabase/migrations/20261021160000_growdash_automation_engine.sql` | `authenticated` tinha `SELECT` em `encrypted_payload` sob policy de membro | Cifra de credenciais podia ser extraída pela Data API | Revogar SELECT de `authenticated`; payload continua acessível apenas ao backend/service role | Migration revisável; UI deve usar metadados/Edge Function |
| BE-003 | Alta | `supabase/functions/workflow-scheduler/index.ts` | UPDATE filtrava apenas `id,status` e não verificava linha reivindicada | Duas execuções do cron podiam executar o mesmo workflow | Claim atômico com condição de vencimento, `.select().maybeSingle()` e skip quando já reivindicado | Execução só prossegue com linha retornada |
| BE-004 | Média | `supabase/functions/workflow-webhook/index.ts` | `req.json()` sem limite de corpo | Payload excessivo podia consumir memória/latência | Limite de 256 KB e JSON inválido retorna 400 | Teste manual/local de payload; build aprovado |
| BE-005 | Média, bloqueado | Funções de sync Meta/RD | Produção devolveu 401 sem sessão/segredo | Não foi possível confirmar fila, watermark, token, volume ou divergência real | Reexecutar com acesso autenticado de workspace e segredo de cron | Requer credencial/ambiente de produção; não é falha confirmada no código |

## Arquitetura observada

As funções de sincronização já implementam retries/backoff, locks de sincronização, idempotência e separação de fonte: Meta para entrega/investimento e RD para negócios/receita. Não foi aplicado polling a cada segundo, pois isso aumentaria rate limits e duplicidade.

## Itens não classificados como erro

- `lead_report_share_rate_limits` não tinha RLS, mas possui `REVOKE ALL` para `PUBLIC`, `anon` e `authenticated`, com acesso exclusivo a `service_role`; não há exposição imediata.
- Aviso de chunks do Vite é otimização de build, não falha de backend.

## Auditoria Supabase Advisor (22/10/2026)

Após aplicar `supabase/migrations/20261022191059_harden_internal_rpcs_and_duplicate_indexes.sql`, a migration remota está confirmada (`npx supabase db push --dry-run` retorna `upToDate: true`). A consulta remota de privilégios confirmou:

- `consume_workspace_usage`, `get_workspace_access_state` e `record_legal_consent`: `PUBLIC`/`anon` removidos; execução limitada a `authenticated` e `service_role`.
- `sync_expert_sale_from_rd_deal`: execução limitada a `service_role`.
- `traffic_proposal_requires_approval`: execução revogada para papéis expostos.
- Os dois índices duplicados de campanhas/insights foram removidos.
- A migration `20261022200000_optimize_rls_auth_initplan.sql` substituiu chamadas repetidas de `auth.uid()` nas políticas por `(select auth.uid())`, mantendo os predicados e reduzindo o custo por linha.

Após a correção, o Advisor reporta 104 avisos: 7 funções públicas token-based intencionais, 47 funções `SECURITY DEFINER` internas chamadas por usuários autenticados, 49 grupos de políticas permissivas múltiplas e 1 configuração de proteção contra senhas comprometidas. Os 211 avisos de `auth_rls_initplan` foram eliminados. Os 7 RPCs públicos permanecem porque são endpoints de formulários/compartilhamentos protegidos por token; revogá-los quebraria fluxos externos. Os 47 RPCs autenticados exigem revisão individual de autorização e não foram revogados em massa, pois vários são usados legitimamente pela aplicação. As políticas permissivas múltiplas combinam regras de acesso diferentes e não devem ser fundidas sem testes funcionais por workspace. A proteção contra senhas comprometidas deve ser habilitada no painel de Auth/Password Security (não é uma migration SQL segura).

## Pendências de produção

Migration aplicada no projeto Supabase `cixnvosxqlacjbpymjha` e as funções `workflow-webhook` e `workflow-scheduler` estão ativas. O build está publicado no Cloudflare Pages no deployment `80b5386a`, associado ao commit `8549bf0`.

A execução real do `daily-incremental-sync` não foi considerada aprovada: chamadas sem autenticação retornam 401 corretamente e os valores exibidos pela listagem de secrets não são utilizáveis como credencial de execução. Ainda é necessário executar uma janela controlada com a sessão/segredo operacional real e registrar: conta Meta, período, último sync bem-sucedido, filas, erros 4xx/5xx, token/escopo, volume Meta/RD e divergências comparando o mesmo escopo e definição de evento.
