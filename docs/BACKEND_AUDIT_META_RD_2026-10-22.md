# Auditoria de backend — Meta Ads, RD Station e automações

Data: 22/10/2026  
Escopo: Edge Functions, migrations, autenticação, idempotência, concorrência e sincronização Meta Ads ↔ RD Station.

## Evidências e limites

- `npm test`: 119 arquivos, 561 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado; apenas aviso de chunks grandes.
- ESLint direcionado às funções alteradas: aprovado.
- `npm run lint` geral não concluiu no tempo de diagnóstico; a configuração já ignora `dist`, portanto não foi classificado como defeito de runtime.
- A verificação de dados reais ficou bloqueada sem sessão/segredo: chamadas a `daily-incremental-sync` e `controlled-realtime-sync` retornaram 401, comportamento esperado.

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

## Pendências de produção

Migration aplicada no projeto Supabase `cixnvosxqlacjbpymjha` e as funções `workflow-webhook` e `workflow-scheduler` estão ativas. O build está publicado no Cloudflare Pages no deployment `80b5386a`, associado ao commit `8549bf0`.

A execução real do `daily-incremental-sync` não foi considerada aprovada: chamadas sem autenticação retornam 401 corretamente e os valores exibidos pela listagem de secrets não são utilizáveis como credencial de execução. Ainda é necessário executar uma janela controlada com a sessão/segredo operacional real e registrar: conta Meta, período, último sync bem-sucedido, filas, erros 4xx/5xx, token/escopo, volume Meta/RD e divergências comparando o mesmo escopo e definição de evento.
