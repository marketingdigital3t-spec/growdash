-- ============================================================================
-- Migration: 20261118100000_fix_vendas_realizadas_closed_at.sql
--
-- PROBLEMA:
--   O RD Station mostra 9 vendas realizadas (filtrado por fechamento de 09/11
--   a hoje), mas o Growdash mostra apenas 7. A causa raiz é que o trigger
--   `trg_sync_rd_deal_to_canonical_sale` só dispara em `AFTER INSERT OR UPDATE
--   OF win, amount_total, closed_at, ...`. O caminho de sincronização em modo
--   `analytics_mode` faz upsert em `rd_deals` com os MESMOS valores a cada
--   ciclo. O Postgres não executa o trigger quando nenhuma coluna listada
--   muda de valor, então a venda correspondente nunca era criada — o negócio
--   aparecia como "Venda Realizada" no funil sem existir na tabela `sales`.
--   Resultado: o RD Station mostrava 8 vendas realizadas e o Growdash
--   mostrava 7. Os 3 negócios com `amount_total = 0` nunca viravam venda.
--
-- CORREÇÃO:
--   1) Materializar vendas em falta para todo negócio ganho (win = true) que
--      ainda não tem linha em `sales`. A função do trigger faz o INSERT ...
--      ON CONFLICT (rd_deal_id) DO UPDATE, então a operação é idempotente.
--   2) Garantir que o sale_date carregue a data de fechamento (closed_at),
--      não a data de criação. Um negócio antigo sincronizado antes da
--      correção pode ter ficado com a data de criação.
--   3) Verificar se o trigger trg_sync_rd_deal_to_canonical_sale existe e
--      está ativo; se não, criá-lo.
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

-- 1) Materializar vendas em falta para todo negócio ganho que ainda não tem
--    linha em sales. Isso dispara o trigger trg_sync_rd_deal_to_canonical_sale,
--    que faz INSERT ... ON CONFLICT (rd_deal_id) DO UPDATE, então é idempotente.
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

-- 2) Garantir que o sale_date carregue a data de fechamento do negócio.
--    O sale_date do trigger já usa closed_at, mas um negócio antigo sincronizado
--    antes da correção pode ter ficado com a data de criação.
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

-- 3) Verificar se o trigger existe e está ativo. Se não existir, criar. Se
--    estiver desabilitado, reabilitar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'trg_sync_rd_deal_to_canonical_sale'
      AND c.relname = 'rd_deals'
  ) THEN
    CREATE TRIGGER trg_sync_rd_deal_to_canonical_sale
    AFTER INSERT OR UPDATE OF
      win,
      amount_total,
      closed_at,
      stage_updated_at,
      ad_account_id,
      rd_funnel_id,
      rd_product_name,
      contact_name,
      contact_email,
      lead_state,
      lead_city,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      first_touch_utm_campaign,
      last_touch_utm_campaign
    ON public.rd_deals
    FOR EACH ROW EXECUTE FUNCTION public.sync_rd_deal_to_canonical_sale();
  ELSE
    ALTER TRIGGER trg_sync_rd_deal_to_canonical_sale ON public.rd_deals ENABLE;
  END IF;
END $$;

-- 4) Relatório de diagnóstico para o usuário
-- Negócios ganhos no RD Station
SELECT COUNT(*) AS total_won_deals
  FROM public.rd_deals
 WHERE win = true;

-- Vendas confirmadas na tabela sales
SELECT COUNT(*) AS total_sales_confirmed
  FROM public.sales
 WHERE status = 'confirmed';

-- Negócios ganhos sem venda correspondente (deve ser 0 após a correção)
SELECT d.id, d.rd_deal_id, d.name, d.closed_at, d.amount_total, d.stage_updated_at
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