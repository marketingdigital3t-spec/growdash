# Prompt Master — Correção da Sincronização RD/Meta e Dados do Dashboard

## Contexto

O login da Growdash foi corrigido (timeout do Supabase elevado de 30s para 60s, 3 tentativas) e publicado no Cloudflare Pages (deploy `c7acbb0`). O problema atual é a **sincronização RD Station / Meta** e a **consistência dos dados do Dashboard**.

Sintomas reportados pelo usuário:
1. Login exibia "Não foi possível entrar / serviço temporariamente indisponível" → **RESOLVIDO** (produção já atualizada).
2. Dashboard exibe "Sincronização parcial: RD não concluiu a atualização. Último snapshot válido preservado."
3. Dados inconsistentes: 8 clientes vs 4 oportunidades; R$ 42.000,00 de faturamento vs R$ 622,73 de ticket médio.

## Objetivo

Corrigir o pipeline de sincronização RD Station para que:
- O sync conclua com status `success` (não `partial`).
- O funil reflita o estado real do RD (clientes, oportunidades, leads).
- O faturamento e o ticket médio sejam coerentes com os negócios ganhos do RD.
- O botão "Sincronizar agora" complete sem exceder o orçamento de runtime da Edge Function.

## Arquivos-chave

### 1. Edge Function principal: `supabase/functions/rd-sync-deals/index.ts` (2350 linhas)

Lógica de status (linha 2286):
```ts
const status = metrics.errors > 0 || (analytics_mode && !analyticsRangeComplete) || Boolean(stageSyncWarning) ? "partial" : "success";
```

Orçamento de runtime: 90s (`RD_SYNC_RUNTIME_BUDGET_MS`).
Batch de persistência: `BATCH_SIZE = 2`, `BATCH_PAUSE_MS = 400` (linhas 1810-1811).
Cada deal faz 2 chamadas à API do RD (`/deals/{id}` e `/deals/{id}/contacts`) com 3 tentativas cada.

### 2. Orçamento de runtime: `src/lib/rdSyncRuntimeBudget.ts`

`RD_SYNC_RUNTIME_BUDGET_MS = 90_000`
`safeRDRequestTimeoutMs` reserva ~40% do orçamento.

### 3. Classificação de negócios ganhos: `src/lib/canonicalMetrics.ts`

`isCanonicalWonDeal` usa `rd_stage_name` como fonte de autoridade, com fallback para `win === true`.

### 4. Valor do negócio: `src/lib/rdDealAmount.ts`

`getRDDealAmount` prioriza `amount_total_effective`, depois `amount_total`, depois `productPrice`.

### 5. Agregação de receita: `src/lib/revenueAggregation.ts`

`aggregateRevenueSources` substitui `totalGross`/`totalQuantity` por valores de RD (`rdRevenue`, `rdWonDealsCount`).

### 6. Página do Dashboard: `src/pages/PerformanceSummaryPage.tsx`

Chama `rd-sync-deals` por funil com `analytics_mode: true` e `full_history: true`. Define `rdSyncStatus` com base no `data.partial` da função.

## Pontos de falha identificados

### Falha A: Orçamento de 90s insuficiente para 4 segmentos
O modo analytics percorre won, ongoing, lost, paused. Cada deal gera até 2 chamadas à API do RD com retry de 3x. Com o `BATCH_SIZE = 2` e pausa de 400ms, o throughput é baixo. Quando o orçamento se esgota no meio de um segmento, `analyticsRangeComplete = false` → status `partial` → cursores salvos → próxima invocação reinicia do segmento onde parou, mas o status nunca vira `success` porque o volume excede o orçamento.

### Falha B: Batch de persistência muito pequeno
`BATCH_SIZE = 2` com `BATCH_PAUSE_MS = 400` significa 2 deals a cada 400ms + chamadas de detail/contacts. Para centenas de deals, o orçamento de 90s não é suficiente para concluir todos os 4 segmentos.

### Falha C: `maxAnalyticsDeals` limitado no boundedRealtime
No modo realtime/bounded, o limite é `max(1, min(max_deals || 60, 200))`. Para analytics_mode não-realtime, é infinito, mas o orçamento de 90s ainda trava a execução.

### Falha D: Classificação de negócios ganhos
`isCanonicalWonDeal` confia em `rd_stage_name`. Se o stage name não vier preenchido no payload do RD, cai no fallback `deal.win === true`, que pode estar desatualizado (deal reaberto ou movido para outra etapa). Isso infla ou deflaciona a contagem de vendas.

### Falha E: Valor do negócio
`getRDDealAmount` pode retornar 0 se ambos `amount_total_effective` e `amount_total` forem nulos/zeros, afetando faturamento e ticket médio.

### Falha F: Dados inconsistentes entre funil e KPIs
O Dashboard lê `dashboardDeals` (operational RD deals filtrados por funil) e `glassSales` (agregação de receita). Se o sync estiver parcial, o espelho local não bate com o RD.

## Plano de correção

### Passo 1: Aumentar o orçamento de runtime
Elevar `RD_SYNC_RUNTIME_BUDGET_MS` de 90s para um valor que permita percorrer os 4 segmentos com margem, ou implementar divisão de trabalho por invocation com retomada garantida de cursores.

### Passo 2: Otimizar o batch de persistência
Aumentar `BATCH_SIZE` de 2 para um valor maior (ex: 10-20) e reduzir `BATCH_PAUSE_MS`, mantendo respeito ao rate limit do RD.

### Passo 3: Garantir conclusão dos segmentos
Ajustar a lógica de `analyticsRangeComplete` para que o status só seja `partial` quando houver erro real, não apenas por limite de páginas. Implementar retomada automática de cursores pendentes.

### Passo 4: Revisar classificação de negócios ganhos
Garantir que `isCanonicalWonDeal` use corretamente `rd_stage_name` e não conte negócios reabertos ou em etapas não-terminais como vendas.

### Passo 5: Revisar valor do negócio
Garantir que `getRDDealAmount` não mascare negócios sem valor como zero de forma silenciosa.

### Passo 6: Validar na produção
- Executar o sync manualmente pelo Dashboard.
- Confirmar status `success`.
- Confirmar que funil, clientes, faturamento e ticket médio estão coerentes.
- Verificar console do navegador sem erros de rede no sync.

## Critérios de aceitação

- [ ] `rd-sync-deals` retorna `status: "success"` para o funil da Dra Ranniely Silva (CA02).
- [ ] Nenhum erro de console na tela de sync no navegador.
- [ ] Dashboard mostra números coerentes (clientes == oportunidades fechadas, faturamento >= soma dos negócios ganhos).
- [ ] Botão "Sincronizar agora" completa sem exceder o orçamento da Edge.
- [ ] Build de produção verde.
- [ ] Commit e push na branch `audit/growdash-completa-2026-11-16`.
- [ ] Deploy no Cloudflare Pages publicado.
- [ ] PR aberto para revisão.

## Restrições

- Não alterar o front de login (já corrigido e publicado).
- Não quebrar a tabela `sales` (usa para detalhes financeiros, impostos, reembolsos, chargebacks).
- Não alterar o contrato de `rd_sync_scope_state` e `rd_sync_cursors` de forma a perder retomada de cursores existentes.
- Respeitar o rate limit da API do RD Station.

---
*Gerado com Claude Sonnet 5 Code para correção da sincronização RD/Meta da Growdash.*