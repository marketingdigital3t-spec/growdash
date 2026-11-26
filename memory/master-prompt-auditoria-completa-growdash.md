---
name: master-prompt-auditoria-completa-growdash
description: Prompt mestre unificado para correção de todos os problemas da auditoria Growdash (Meta Ads + RD Station CRM)
metadata:
  type: project
---

# Prompt Master — Correção Completa da Auditoria Growdash

## Objetivo

Aplicar todas as correções da auditoria da Growdash de forma sistemática, um problema por vez, com testes, build e deploy a cada etapa.

## Contexto

A integração Meta Ads + RD Station CRM da Growdash passou por uma auditoria completa em 2026-11-16. Este prompt master unifica os 10 itens do master-prompt anterior (`master-prompt-correcao-final-growdash.md`) mais 3 itens adicionais da auditoria (funis RD, token Instagram expirado, reconciliação Meta↔RD).

O stack é TypeScript/React/Vite/Supabase/Cloudflare Pages. As Edge Functions rodam no Deno. O banco é PostgreSQL (Supabase) com pg_cron e pg_net.

## Regras de execução (obrigatórias)

1. **Um problema por vez.** Nunca execute múltiplos itens em paralelo que toquem nos mesmos dados.
2. **Cada correção deve ter testes unitários.** Crie/escreva teste antes ou junto com a correção.
3. **Menor diff possível.** Não refatore sem necessidade.
4. **Migrations antes do commit:** verifique schemas existentes, nomes reais de colunas, use blocos condicionais defensivos `IF EXISTS` quando apropriado, qualifique extensões explicitamente com seu schema de instalação (ex.: `extensions.gen_random_bytes`).
5. **Não use o GitHub Actions como interpretador de erros SQL.** Teste migrations localmente antes de commitar.
6. **Não declare produção validada enquanto o domínio principal estiver servindo versão anterior.** Verifique Cloudflare Pages + navegador após cada deploy.
7. **Siga o fluxo do AGENTS.md:** código local → GitHub/remoto → Cloudflare Pages → navegador.
8. **Commit e push a cada item concluído.** Nunca deixe trabalho não commitado.

## Fluxo por item (loop obrigatório)

Para cada item:
1. Ler o código existente relacionado
2. Implementar a correção (menor diff possível)
3. Criar/escrever teste unitário
4. Rodar `npx tsc --noEmit` e `npx vitest run`
5. Rodar `npm run build`
6. Commit e push na branch `audit/growdash-completa-2026-11-16`
7. Deploy no Cloudflare Pages (`npx wrangler pages deploy dist --project-name growdash`)
8. Verificar em produção no navegador (sem erros de console)

## Lista de problemas (prioridade → execução)

### Critíco

#### Item A: Cron de daily-reconciliation não agendado (pg_cron)
A função `daily-reconciliation` nunca foi agendada no pg_cron para rodar diariamente às 04:00 BRT (07:00 UTC).

- Arquivo: `supabase/migrations/20261117040000_daily_rd_reconciliation_sync.sql` (já criada, precisa ser aplicada no banco via SQL editor do Supabase)
- Teste: `src/lib/dailyReconciliationCron.test.ts` (já criado)
- Validação: confirmar que o job `growdash-daily-reconciliation` existe em `cron.job` após aplicar a migration

#### Item B: Botão "Executar agora" retorna 401
O `JobRunsCard.tsx` chamava `daily-reconciliation` com JWT do usuário, mas a função só aceita `service_role` ou `x-cron-secret`.

- Arquivo: `src/components/data-health/JobRunsCard.tsx` (já corrigido: chama `trigger-rd-sync`)
- Teste: nenhum específico (coberto por suíte geral)
- Validação: clicar no botão "Executar agora" na UI e confirmar que não retorna 401

### Alto

#### Item C: Enriquecimento de estados — 2.744 deals sem estado
A função `rd-enrich-states` ignorava o parâmetro `limit` e processava sempre os mesmos 800 deals do offset 0.

- Arquivo: `supabase/functions/rd-enrich-states/index.ts` (já corrigido: suporte a `limit`/`offset`, devolve `totalRemaining` e `hasMore`)
- Teste: `src/lib/rdEnrichStatesPagination.test.ts` (já criado)
- Validação: rodar a função múltiplas vezes com offset crescente até `hasMore` ser falso

#### Item D: 5 conexões RD com erro (statement timeout / partial)
Os backoffs de requisição RD (5s/15s/30s/60s) consumiam quase todo o runtime budget de 90s, deixando pouca margem para múltiplas conexões sequenciais.

- Arquivo: `src/lib/rdSyncRuntimeBudget.ts` (já corrigido: backoffs 2s/5s/10s + reserva de 40% do budget)
- Teste: `src/lib/rdSyncRuntimeBudget.test.ts` (já criado, atualizado)
- Validação: rodar sincronização de múltiplos funis e confirmar que nenhum retorna statement timeout

#### Item E: 7 contas Meta sem action_type
Contas Meta ativas não possuem `action_type` configurado na `account_lp_config`, impedindo mapeamento de eventos de site como leads.

- Arquivo: `supabase/migrations/20261117100000_configure_meta_site_lead_action_type.sql` (já criada, precisa ser aplicada no banco)
- Utilitário: `src/lib/metaAccountsWithoutActionType.ts` + teste `src/lib/metaAccountsWithoutActionType.test.ts`
- Validação: consultar `account_lp_config` e confirmar que todas as contas ativas têm `action_type` preenchido

#### Item F: Claims de conformidade — uso de imagem e riscos de comunicação
Documentos legais em `src/pages/LegalPage.tsx` não cobrem "uso de imagem" nem "riscos de comunicação".

- Teste: `src/lib/complianceClaims.test.ts` (já criado — identifica o gap)
- Ação pendente: adicionar cláusulas de uso de imagem e riscos de comunicação aos documentos legais

### Médio

#### Item G: 2 contas RD nunca sincronizadas (CA02-Natália e CA02-Fernanda)
Conexões RD com `status = 'connected'` mas `last_success_at IS NULL`.

- Utilitário: `src/lib/rdNeverSyncedAccounts.ts` + teste `src/lib/rdNeverSyncedAccounts.test.ts` (já criados)
- UI: `src/growdash/IntegrationsPage.tsx` (já atualizado — destaca conexões nunca sincronizadas com badge "Nunca sincronizado")
- Validação: verificar na aba CRM da Central de Integrações se as contas CA02 aparecem com badge de alerta

#### Item H: Bundle de 1,8 MB e CSS de 15k linhas
Imagem `earth-8k-300dpi.jpg` de 3,7 MB inchava o bundle principal.

- Arquivo: `src/components/space/SpacePhaseBackground.tsx` (já corrigido: usa `earth-2k-web.jpg` de 567 KB)
- Teste: `src/components/space/SpacePhaseBackground.test.tsx` (já criado)
- Validação: verificar no build que `earth-8k-300dpi.jpg` não aparece mais nos assets

#### Item I: Observabilidade — correlation ID nas Edge Functions
Edge Functions críticas não propagam correlation ID nem geram logs estruturados.

- Arquivo: `src/lib/observability.ts` + teste `src/lib/observability.test.ts` (já criados)
- Ação pendente: integrar `extractCorrelationId`, `withCorrelationHeaders` e `structuredLog` nas Edge Functions críticas (`daily-reconciliation`, `rd-sync-deals`, `rd-enrich-states`, `sync-meta-insights`)

### Baixo

#### Item J: 4 campanhas com spend sem leads
Campanhas com spend > R$50 e 0 leads nos últimos 30 dias.

- Utilitário: `src/lib/spendNoLeadsDetection.ts` + teste `src/lib/spendNoLeadsDetection.test.ts` (já criados)
- UI: `src/components/data-health/SpendNoLeadsCard.tsx` (já existe)
- Validação: abrir a página Data Health e confirmar que o card lista as campanhas ofensoras

## Itens adicionais da auditoria (fora dos 10 do master-prompt original)

### Item K: Revisar vinculação dos 17 funis RD
Funis ativos podem estar sem `rd_funnel_id` (não vinculados a pipeline real) ou órfãos (sem `ad_account_id` nem `rd_connection_id`).

- Utilitário: `src/lib/rdFunnelLinkageAudit.ts` + teste `src/lib/rdFunnelLinkage.test.ts` (já criados)
- Ação pendente: executar a auditoria nos dados reais e corrigir funis órfãos via migration ou update direto

### Item L: Renovar token Instagram Business expirado
Contas do Instagram com `connection_status = 'expired'` precisam de renovação via OAuth.

- Utilitário: `src/lib/instagramExpiredToken.ts` + teste `src/lib/instagramExpiredToken.test.ts` (já criados)
- Ação pendente: identificar contas expiradas na UI e orientar o usuário a reconectar via OAuth

### Item M: Validar reconciliação Meta ↔ RD (vendas órfãs)
Vendas confirmadas com `rd_deal_id` que não têm deal correspondente em `rd_deals`.

- Utilitário: `src/lib/rdMetaReconciliation.ts` + teste `src/lib/rdMetaReconciliation.test.ts` (já criados)
- UI: `src/components/settings/RDReconcileCard.tsx` (já existe)
- Validação: abrir o card de reconciliação na aba Saúde & Logs da Central de Integrações

## Métricas de sucesso

- Todos os 10 itens do master-prompt original resolvidos e deployados
- Todos os 3 itens adicionais resolvidos e deployados
- 100% dos testes unitários passando (`npx vitest run`)
- TypeScript sem erros (`npx tsc --noEmit`)
- Build de produção sem erros (`npm run build`)
- Produção verificável no navegador sem erros de console

## Como usar este prompt master

Cada item deve ser executado seguindo o loop obrigatório acima. Não pule etapas. Não execute múltiplos itens que toquem nos mesmos dados em paralelo. Após concluir todos os itens, a auditoria está completa.

---

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
🤖 Generated with [Claude Opus 5 Code](https://claude.com/claude-code)
