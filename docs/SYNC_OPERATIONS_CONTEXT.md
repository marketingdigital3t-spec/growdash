# Contexto operacional de sincronização

## Grafo atual

```text
Meta Graph (leads/forms, conversas, campanhas, conjuntos, anúncios, insights)
  -> sync-meta-leads / sync-meta-insights / sync-meta-hourly
  -> controlled-realtime-sync / daily-incremental-sync
  -> meta_leads, campaigns, adsets, ads, insights, meta_sync_scope_state
  -> sync-meta-leads -> syncMetaLeadToRD -> crm_leads / rd_deals
RD Station (webhook e paginação)
  -> sync-rd-crm / rd-sync-deals
  -> rd_deals / sales / rd_sync_cursors
Supabase snapshots + sync_execution_runs
  -> Growdash / CRM / Campanhas / Saúde dos Dados
Cloudflare Pages
```

## Operação

- Escopo de conta, período, timezone e janela de atribuição deve acompanhar toda consulta.
- O ciclo controlado usa locks persistidos e não inicia outra execução enquanto a anterior estiver válida.
- O job diário usa overlap temporal e upsert idempotente.
- Meta continua sendo a fonte de entrega; RD continua sendo a fonte de receita.
- Falhas de auxiliar não apagam o snapshot principal.

## Diagnóstico

Começar pelo `sync_run_id`, consultar `sync_execution_runs`, depois `realtime_sync_state`, `meta_sync_scope_state`, cursores e logs da função. Separar falha de autenticação, permissão, rate limit, timeout, contrato e banco. Nunca converter erro em zero.

## Publicação protegida

O workflow `.github/workflows/loop-engineering.yml` só promove uma versão depois de passar pelos testes, contrato, smoke autenticado e gate de observabilidade. Em seguida aplica migrations compatíveis, publica as quatro Edge Functions de Meta/RD, gera o build e publica o Pages com o SHA do commit. O smoke de produção exige HTTP 200 no domínio e HTTP 401 nas funções quando chamado sem credencial.

Para habilitar essa promoção no GitHub, configure `GROWDASH_AUTH_STATE_B64`, `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SUPABASE_ACCESS_TOKEN`, `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. A ausência de qualquer gate mantém a promoção bloqueada; nenhum valor deve ser colocado no repositório.

## Observabilidade e rollback

As Edge Functions enviam para Sentry somente metadados estruturados da execução
(`sync_run_id`, provedor, conta/escopo, estado, `error_code`, duração, tentativa e
versão). Payloads Meta/RD, tokens e PII não entram no evento. Configure `SENTRY_DSN`,
`SENTRY_ENVIRONMENT` e `SENTRY_RELEASE` como secrets das Edge Functions.

O workflow cria o release Sentry, envia source maps privados e remove os mapas do
artefato público. Antes do canário Cloudflare ele registra o deployment de produção;
se o smoke autenticado ou HTTP falhar, solicita rollback para esse deployment e fecha
o job. Migrações Supabase seguem expandir → migrar → contrair e não são revertidas
automaticamente por SQL destrutivo; uma falha de migration bloqueia a promoção antes
do canário.

`sync_reliability_metrics` expõe ao painel a janela móvel de 30 dias: execuções
iniciadas, falhas terminais, parciais, stale, idade do snapshot, retries e latências
p50/p95/p99. Falhas e bloqueios permanecem no denominador do orçamento de 1%.
