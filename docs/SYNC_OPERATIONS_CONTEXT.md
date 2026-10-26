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
