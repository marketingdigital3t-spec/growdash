-- ============================================================================
-- Migration: 20261117150000_materialize_rd_sales_for_won_deals.sql
--
-- PROBLEMA:
--   O trigger `trg_sync_rd_deal_to_canonical_sale` só dispara em
--   `AFTER INSERT OR UPDATE OF win, amount_total, closed_at, ...`. O caminho
--   de sincronização em modo `analytics_mode` faz upsert em `rd_deals` com
--   os MESMOS valores a cada ciclo. O Postgres não executa o trigger quando
--   nenhuma coluna listada muda de valor, então a venda correspondente
--   nunca era criada — o negócio aparecia como "Venda Realizada" no funil
--   sem existir na tabela `sales`.
--
--   Resultado: o RD Station mostrava 8 vendas realizadas e o Growdash
--   mostrava 7. Os 3 negócios com `amount_total = 0` nunca viravam venda.
--
-- CORREÇÃO:
--   Materializa a venda de todo negócio ganho que ainda não tem linha em
--   `sales`. A função do trigger faz o INSERT ... ON CONFLICT (rd_deal_id)
--   DO UPDATE, então a operação é idempotente.
--
-- Schemas lidos/escritos:
--   - public.rd_deals   (negócios ganhos sem venda correspondente)
--   - public.sales      (venda canônica criada/ atualizada)
--
-- Instrução verbatim do usuário: "as vendas ainda so conta como 7, porem
-- quando filtro a data de fechamento do dia 01 ate hoje ele puxa as 8
-- vendas, eu preciso que na parte de vendas você filtre pela data de
-- fechamento!!!"
-- ============================================================================

-- 1) Materializa as vendas em falta para os negócios ganhos.
WITH won_without_sale AS (
  SELECT d.id
    FROM public.rd_deals d
   WHERE d.win = true
     AND NOT EXISTS (
       SELECT 1
         FROM public.sales s
        WHERE s.rd_deal_id = d.rd_deal_id
          AND s.status = 'confirmed'
     )
)
-- Dispara a função do trigger como um UPDATE. O trigger executa o
-- INSERT ... ON CONFLICT (rd_deal_id) DO UPDATE, então rodar em todos os
-- ganhos é seguro e idempotente.
UPDATE public.rd_deals d
   SET win = d.win,
       updated_at = now()
  FROM won_without_sale missing
 WHERE d.id = missing.id;

-- 2) Garante que a venda carregue a data de fechamento do negócio.
--    O `sale_date` do trigger já usa `closed_at`, mas um negócio antigo
--    sincronizado antes da correção pode ter ficado com a data de criação.
UPDATE public.sales s
   SET sale_date = (
         SELECT (coalesce(d.closed_at, d.stage_updated_at, d.lead_created_at, d.updated_at)
                 AT TIME ZONE 'America/Sao_Paulo')::date
           FROM public.rd_deals d
          WHERE d.rd_deal_id = s.rd_deal_id
            AND d.win = true
       ),
       source_closed_at = (
         SELECT d.closed_at
           FROM public.rd_deals d
          WHERE d.rd_deal_id = s.rd_deal_id
            AND d.win = true
       )
 WHERE s.status = 'confirmed'
   AND s.rd_deal_id IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM public.rd_deals d
      WHERE d.rd_deal_id = s.rd_deal_id
        AND d.win = true
        AND d.closed_at IS NOT NULL
        AND s.sale_date <> (d.closed_at AT TIME ZONE 'America/Sao_Paulo')::date
   );
