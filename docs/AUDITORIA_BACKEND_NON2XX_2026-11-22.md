# Auditoria Backend — Erro "Edge Function returned a non-2xx status code"

**Data:** 2026-11-22
**Projeto:** Growdash (`cixnvosxqlacjbpymjha`)
**Deploy analisado:** `ae700c34` (commit `e77873f`)

## Diagnóstico

O erro reportado pelo cliente **não vem de uma Edge Function**. As Edge Functions
responderam 200. O erro é o **PostgREST** respondendo `400` em
`POST /rest/v1/rd_deals?on_conflict=rd_connection_id,rd_deal_id`, porque a
transação por trás foi **morta por timeout** do pool de conexões.

### Evidência direta (logs Supabase)

```
2026-11-22T02:45:50  POST | 400 | .../rest/v1/rd_deals?on_conflict=rd_connection_id,rd_deal_id&columns=...
2026-11-22T02:45:44  POST | 400 | (mesma requisição, 6s antes)
2026-11-22T02:46:32  Warp server error: Thread killed by timeout manager   (postgrest_logs) x 12+
2026-11-22T02:47:02  Warp server error: Thread killed by timeout manager
2026-11-22T02:47:32  Warp server error: Thread killed by timeout manager
2026-11-22T02:48:34  Warp server error: Thread killed by timeout manager
2026-11-22T02:49:35  Warp server error: Thread killed by timeout manager
2026-11-22T02:48:35  checkpoint complete: wrote 1215 buffers (4.2%); write=122.782 s
```

O `Thread killed by timeout manager` do PostgREST significa que a query excedeu o
`statement_timeout` do pool. A requisição morre, o PostgREST devolve 400, e o
cliente Supabase JS traduz para "Edge Function returned a non-2xx status code"
quando a chamada passa por `supabase.functions.invoke` e o wrapper PostgREST.

### Causa raiz: seq scans massivos

| Tabela | Seq scans | Linhas lidas | Linhas vivas | Tamanho | Índice % |
|---|---:|---:|---:|---:|---:|
| `insight_actions` | 757 | **47.389.679** | 107.823 | 47 MB | 31,6 MB |
| `rd_deals` | 242 | **2.353.250** | 9.840 | **102 MB** | ~20 MB |
| `ads` | 0 | 0 | 12 | 11 MB | 74,6 M leituras |
| `ad_accounts` | 797 | 26.301 | 33 | 320 kB | 12,6 M leituras |

`insight_actions` lê **439x** mais linhas do que tem. `rd_deals` lê **239x**.

### Causas amplificadoras

1. **`rd_deals.raw` (jsonb) ocupa 45 MB** — media de **4.772 bytes** por linha
   (max. 119 KB). É o payload bruto do RD Station, nunca consultado, apenas
   gravado. Toda linha da tabela custa ~5,3 KB.
2. **`rd_deals` tem 23 índices** para 9.840 linhas. Varios nunca sao lidos
   (`idx_rd_deals_custom_fields`, `idx_rd_deals_account_email_created`,
   `idx_rd_deals_effective_amount`, `idx_insight_actions_action_type` → 0 leituras).
   Cada índice tambem paga o custo de manutencao no `raw`.
3. **Ausência de indice `ads(ad_account_id)`** — 74,6 milhões de index scans
   numa tabela de 12 linhas sugere lookup por indice primario em loop.
4. **`insight_actions` tem 2 indices de 13 MB + 12 MB** sobre os mesmos dados.

## Correcoes planejadas

| # | Acao | Impacto |
|---|---|---|
| 1 | **Remover o scan sem filtro em `useCustomMetrics`** — filtrar por `ad_account_id` do usuario | −3,6 M ms de tempo de banco |
| 2 | Remover `raw` de `rd_deals` e mover para `rd_deals_raw` | −45 MB, −90% no seq scan |
| 3 | Dropar indices de `rd_deals` com 0 leituras | −5 MB e menos escrita |
| 4 | Indice `ads(ad_account_id, adset_id)` | elimina lookup em loop |
| 5 | Indice parcial em `insight_actions` por periodo recente | corta o seq scan de 47 M |

## Bug principal identificado: `useCustomMetrics` sem filtro de tenant

**Arquivos:** `src/hooks/useCustomMetrics.ts:85` e `:119`

```typescript
// linha 85 — useAvailableActions
supabase.from("insight_actions").select("action_type, value").range(from, from + 999)
// linha 119 — useActionsByAccount
supabase.from("insight_actions").select("ad_id, action_type, value").range(from, from + 999)
```

Nenhuma das duas queries filtra por `ad_account_id`, `date` ou `user_id`.
Com 107.823 linhas em `insight_actions` (47 MB), a paginacao le a tabela
inteira a cada pagina — 108 paginas de 1000 linhas.

### Por que o custo e O(n^2)

A policy de leitura de `insight_actions` e:

```sql
USING (has_role(auth.uid(), 'admin')
       OR (ad_account_id IS NOT NULL AND user_can_view_ad_account(auth.uid(), ad_account_id))
       OR (ad_account_id IS NULL AND user_can_access_ad(auth.uid(), ad_id)))
```

A policy e avaliada **linha a linha**. Com `LIMIT/OFFSET`, cada pagina re-avalia
a policy desde a linha 0. O custo cresce quadraticamente com o offset.

### Evidencia de producao

```
pg_stat_statements
calls=727   total_exec_time=3.633.332 ms   mean_exec_time=4.997,7 ms
query: SELECT action_type, value FROM insight_actions LIMIT $1 OFFSET $2
```

Esta e a **query mais cara do sistema inteiro** — 3,6 milhões de ms de tempo de
banco, contra 623.280 ms da segunda colocada.

### Quem dispara

- `useAvailableActions` → `src/components/settings/CustomMetricsSection.tsx:32`
  (tela de Configuracoes). Cada abertura da tela dispara a varredura completa.
- `useActionsByAccount` → nao consumido atualmente, mas exportado e pronto para
  ser plugado em qualquer tela.

### Impacto no sintoma reportado

Enquanto a varredura roda, ela segura conexoes do pool do PostgREST. Os logs
mostram `Warp server error: Thread killed by timeout manager` (12+ vezes em
02:46:32) e o `POST /rest/v1/rd_deals` do sync do RD morre com **400**. O
cliente Supabase JS reporta isso como "Edge Function returned a non-2xx status
code".

## Estado atual

- Deploy analisado: `ae700c34` (commit `e77873f`) — inclui correcao de renderizacao.
- Nenhuma migration foi aplicada ainda. As correcoes de schema exigem migration
  com `IF EXISTS` conforme AGENTS.md.

