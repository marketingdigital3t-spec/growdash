-- ============================================================================
-- Migration: 20261118100000_fix_vendas_realizadas_closed_at.sql
--
-- PROBLEMA:
--   O RD Station mostra 9 vendas realizadas (filtrado por fechamento de 09/11
--   a hoje), mas o Growdash mostra apenas 7. A causa raiz é que o trigger
--   `trg_sync_rd_deal_to_canonical_sale` só dispara quando colunas listadas
--   mudam de valor. O caminho de sincronização em modo analytics_mode faz
--   upsert em rd_deals com os mesmos valores, então o Postgres não executa o
--   trigger e a venda nunca é criada na tabela sales.
--   Além disso, negócios com amount_total = 0 eram cancelados pelo trigger
--   zz_prevent_zero_value_rd_sale, mesmo sendo vendas válidas no RD Station.
--
-- CORREÇÃO:
--   1) Materializa vendas em falta para todo negócio ganho (win = true) que
--      ainda não tem linha em sales.
--   2) Garante que sale_date carregue a data de fechamento (closed_at), não
--      a data de criação.
--   3) Reativa o trigger trg_sync_rd_deal_to_canonical_sale se estiver
--      desabilitado.
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

-- 1) Materializar vendas em falta para negócios ganhos que ainda não têm
--    linha em sales. Isso dispara o trigger trg_sync_rd_deal_to_canonical_sale,
--    que faz INSERT ... ON CONFLICT (rd_deal_id) DO UPDATE, sendo idempotente.
UPDATE public.rd_deals d
   SET win = d.win,
       updated_at = now()
 FROM (
   SELECT d.id
     FROM public.rd_deals d
    WHERE d.win = true
      AND NOT EXISTS (
        SELECT 1
          FROM public.sales s
         WHERE s.rd_deal_id = d.rd_deal_id
           AND s.status = 'confirmed'
      )
) missing
 WHERE d.id = missing.id;

-- 2) Garantir que o sale_date carregue a data de fechamento (closed_at),
--    não a data de criação. Um negócio antigo sincronizado antes da correção
--    pode ter ficado com a data de criação.
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

-- 3) Relatório de diagnóstico
-- Negócios ganhos no RD Station
SELECT COUNT(*) AS total_won_deals
  FROM public.rd_deals
 WHERE win = true;

-- Vendas confirmadas na tabela sales
SELECT COUNT(*) AS total_sales_confirmed
  FROM public.sales
 WHERE status = 'confirmed';

-- Negócios ganhos sem venda correspondente (deve ser 0 após a correção)
SELECT d.id, d.rd_deal_id, d.name, d.closed_at, d.amount_total
  FROM public.rd_deals d
 WHERE d.win = true
   AND NOT EXISTS (
     SELECT 1
       FROM public.sales s
      WHERE s.rd_deal_id = d.rd_deal_id
        AND s.status = 'confirmed'
   )
 ORDER BY d.closed_at DESC NULLS LAST
 LIMIT 20;

-- Vendas por data de fechamento (09/11/2026 a 17/11/2026)
SELECT COUNT(*) AS vendas_realizadas_no_periodo
  FROM public.sales s
 WHERE s.status = 'confirmed'
   AND s.source_closed_at IS NOT NULL
   AND s.source_closed_at::date >= '2026-11-09'
   AND s.source_closed_at::date <= '2026-11-17';

-- Detalhe das vendas no período
SELECT s.rd_deal_id, d.name, s.sale_date, s.source_closed_at, s.gross_revenue
  FROM public.sales s
  JOIN public.rd_deals d ON s.rd_deal_id = d.rd_deal_id
 WHERE s.status = 'confirmed'
   AND s.source_closed_at IS NOT NULL
   AND s.source_closed_at::date >= '2026-11-09'
   AND s.source_closed_at::date <= '2026-11-17'
 ORDER BY s.sale_date;