# Plano de ação — correção completa do backend

## Fase 1 — Preparação e segurança de mudança

1. Confirmar branch, commit e divergência com `origin/main`.
2. Separar alterações desta correção das mudanças pré-existentes do worktree.
3. Fazer backup/export das migrations e configurações de produção.
4. Confirmar `SUPABASE_URL`, projeto, ambiente e responsáveis autorizados.
5. Nunca registrar tokens, `service_role`, segredos de webhook ou payloads pessoais nos logs.

## Fase 2 — Corrigir vulnerabilidades confirmadas

### 2.1 Webhooks

- Exigir segredo antes de ativar um webhook.
- Rejeitar webhook ativo sem `secret_hash`.
- Pausar registros legados sem segredo.
- Limitar o corpo a 256 KB.
- Rejeitar JSON inválido com erro 400.
- Validar `AUTOMATION_INTERNAL_SECRET` antes de encaminhar a execução.
- Testar segredo correto, ausente, incorreto, payload excedente e workflow pausado.

### 2.2 Credenciais

- Revogar `SELECT` de `authenticated` em `growdash_workflow_credentials`.
- Manter o payload criptografado acessível apenas por Edge Functions/service role.
- Criar view de metadados sem payload secreto se a interface precisar exibir nome, provedor, status e expiração.
- Confirmar que tokens não aparecem em respostas, logs, erros ou histórico de execução.

### 2.3 Scheduler e idempotência

- Fazer claim atômico por `id`, `status` e `next_run_at` vencido.
- Executar o workflow somente quando a instância receber a linha reivindicada.
- Manter índice único de idempotência dos runs.
- Testar duas chamadas simultâneas para o mesmo agendamento e comprovar uma única execução externa.
- Registrar `skipped` quando outra instância já tiver reivindicado a execução.

## Fase 3 — Sincronização Meta Ads ↔ RD Station

1. Executar com sessão autenticada e escopo explícito:
   - conta Meta;
   - período e fuso horário;
   - funil RD;
   - definição de lead/conversa/venda.
2. Verificar última execução, watermark, lock, fila pendente e duração.
3. Classificar erros 4xx, 5xx, timeout, rate limit, token expirado e escopo insuficiente.
4. Aplicar somente retry com backoff, reprocessamento idempotente e refetch de dados stale.
5. Comparar Meta e RD apenas no mesmo escopo, período e definição de evento.
6. Registrar volume recebido, volume persistido, itens rejeitados e motivo.
7. Validar que falha parcial preserve o snapshot anterior e não transforme indisponibilidade em zero.

## Fase 4 — Validação automatizada

Executar obrigatoriamente:

```text
npm test
npx tsc --noEmit
npm run build
npx eslint <arquivos alterados>
git diff --check
```

Adicionar/validar testes para:

- webhook sem segredo;
- webhook com segredo inválido;
- JSON inválido e payload acima do limite;
- scheduler concorrente;
- run duplicado por `idempotency_key`;
- credencial nunca retornada ao cliente;
- token expirado e erro de escopo;
- retry com backoff e limite;
- falha parcial sem apagar o último dado válido;
- isolamento entre workspaces.

## Fase 4.1 — Advisor e privilégios

- Aplicar `20261022191059_harden_internal_rpcs_and_duplicate_indexes.sql`.
- Confirmar por consulta remota que RPCs internos não são executáveis por `anon`/`PUBLIC` e que `sync_expert_sale_from_rd_deal` só é executável por `service_role`.
- Reexecutar o Advisor e separar alertas intencionais de endpoints públicos token-based dos alertas internos e de performance.
- Não revogar em massa funções `SECURITY DEFINER` autenticadas sem mapear todos os consumidores e testar regressão.
- Habilitar a proteção contra senhas comprometidas no painel de Auth/Password Security; registrar essa configuração separadamente da migration.
- Aplicar `20261022200000_optimize_rls_auth_initplan.sql` e confirmar que os predicados continuam idênticos, com `(select auth.uid())` avaliado uma vez por statement.

## Fase 5 — Publicação controlada

1. Aplicar migration no projeto Supabase correto.
2. Publicar somente as Edge Functions alteradas.
3. Confirmar logs de deploy e versão/commit ativo.
4. Executar smoke tests autenticados:
   - webhook protegido;
   - scheduler;
   - workflow de teste;
   - sincronização Meta;
   - sincronização RD.
5. Monitorar por pelo menos uma janela de sincronização completa antes de considerar estável.
6. Em caso de falha, reverter apenas a migration/função correspondente, sem reset destrutivo.

## Critérios de aceite

- Nenhum webhook ativo aceita chamada sem segredo.
- Nenhum usuário autenticado consegue ler `encrypted_payload`.
- Duas chamadas concorrentes do scheduler produzem no máximo um disparo.
- Execuções repetidas não enviam mensagens nem criam negociações duplicadas.
- Meta e RD sincronizam com conta, período e definição de evento documentados.
- Erros aparecem com causa e próximo passo, sem expor credenciais.
- Testes, typecheck, build e lint passam.
- O commit publicado é o mesmo servido pelo ambiente de produção.

## Bloqueios atuais

- A validação real Meta/RD exige sessão autenticada, contas conectadas e segredo de cron.
- A publicação Supabase exige acesso ao projeto e CLI/credenciais de deploy.
- Sem esses acessos, só é possível confirmar a correção estática e a validação local; não declarar produção concluída.
- O Advisor não deve mais reportar `auth_rls_initplan`. As 49 políticas permissivas múltiplas permanecem como regras distintas de autorização e só devem ser consolidadas após testes por workspace, papel e ação.
