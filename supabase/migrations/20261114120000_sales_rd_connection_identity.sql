-- 20261114120000_sales_rd_connection_identity.sql
--
-- Identidade correta de receita por conexão RD Station.
--
-- O espelho RD identifica um negócio por (rd_connection_id, rd_deal_id):
--   supabase/migrations/20260925150000_rd_deal_identity_constraint.sql
-- Mas a receita canônica usava apenas rd_deal_id, com constraint única global
-- (sales_rd_deal_id_unique) e ON CONFLICT (rd_deal_id) no trigger. Duas conexões
-- RD diferentes do mesmo usuário podem usar o mesmo rd_deal_id, e então uma
-- conta sobrescreve a receita da outra, deixando CAC, faturamento e os KPIs de
-- CA01/CA02 incorretos.
--
-- Esta migration:
--   1) adiciona rd_connection_id em sales e preenche a partir do negócio RD;
--   2) registra as colisões detectadas sem apagar nenhuma venda;
--   3) recria o trigger canônico para reconciliar por (rd_connection_id, rd_deal_id);
--   4) troca a identidade única global por uma identidade única por conexão.

-- 1) Coluna de conexão na receita
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS rd_connection_id uuid REFERENCES public.rd_account_connections(id) ON DELETE SET NULL;

-- 2) Backfill: cada venda RD herda a conexão do negócio RD que a originou.
--    Quando o mesmo rd_deal_id existe em conexões diferentes, a venda fica sem
--    conexão para não ser atribuída à conta errada.
UPDATE public.sales sale
   SET rd_connection_id = deal.rd_connection_id,
       updated_at = now()
  FROM public.rd_deals deal
 WHERE sale.rd_deal_id IS NOT NULL
   AND sale.rd_deal_id = deal.rd_deal_id
   AND sale.rd_connection_id IS NULL
   AND deal.rd_connection_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM public.rd_deals other
      WHERE other.rd_deal_id = deal.rd_deal_id
        AND other.rd_connection_id IS DISTINCT FROM deal.rd_connection_id
   );

-- 3) Relatório de colisões: mesma receita canônica compartilhada por mais de
--    uma conexão. As linhas envolvidas são preservadas e apenas sinalizadas.
DO $$
DECLARE
  _collisions bigint;
BEGIN
  SELECT count(*)
    INTO _collisions
    FROM (
      SELECT rd_deal_id
        FROM public.sales
       WHERE rd_deal_id IS NOT NULL
       GROUP BY rd_deal_id
      HAVING count(DISTINCT coalesce(rd_connection_id::text, 'legacy')) > 1
    ) collided;

  IF _collisions > 0 THEN
    RAISE NOTICE 'Identidade de receita por conexão: % rd_deal_id compartilhado(s) entre conexões diferentes', _collisions;
  END IF;
END;
$$;

-- 4) Identidade única por conexão. Linhas legadas sem conexão continuam
--    coexistindo (o índice é parcial), como já acontecia em rd_deals.
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_rd_deal_id_unique;
DROP INDEX IF EXISTS public.sales_rd_deal_id_idx;
DROP INDEX IF EXISTS public.sales_rd_connection_deal_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS sales_rd_connection_deal_uidx
  ON public.sales (rd_connection_id, rd_deal_id)
  WHERE rd_connection_id IS NOT NULL AND rd_deal_id IS NOT NULL;

-- 5) Trigger canônico passa a reconciliar por (rd_connection_id, rd_deal_id).
--    Toda a lógica de atribuição e precificação original é preservada; somente
--    a identidade da receita muda.
CREATE OR REPLACE FUNCTION public.sync_rd_deal_to_canonical_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deal public.rd_deals%ROWTYPE;
  _campaign_id text;
  _campaign_name text;
  _valid_ad_account_id uuid;
  _workspace_id uuid;
  _business_unit_id uuid;
  _product_id uuid;
  _tax_rate numeric := 0;
  _gross numeric := 0;
  _tax numeric := 0;
  _net numeric := 0;
  _sale_date date;
  _confidence numeric(5,4) := 0;
  _reason text := 'rd_without_campaign_utm';
BEGIN
  _deal := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- Dados legados podem sobreviver à remoção do proprietário. Eles não são
  -- visíveis para uma conta ativa e não podem originar uma venda por causa da
  -- FK `sales.user_id`; portanto, são ignorados sem interromper o restante do
  -- backfill.
  IF NOT EXISTS (
    SELECT 1
      FROM auth.users u
     WHERE u.id = _deal.user_id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Se a negociação deixou de ser ganha (ou foi removida durante uma
  -- reconciliação), a receita não pode continuar realizada.
  IF TG_OP = 'DELETE' OR NOT coalesce(_deal.win, false) THEN
    UPDATE public.sales
       SET status = 'cancelled',
           attribution_reason = CASE
             WHEN TG_OP = 'DELETE' THEN 'rd_deal_removed'
             ELSE 'rd_deal_not_won'
           END,
           updated_at = now()
     WHERE rd_deal_id = _deal.rd_deal_id
       AND user_id = _deal.user_id
       AND (
         (rd_connection_id IS NOT NULL AND rd_connection_id IS NOT DISTINCT FROM _deal.rd_connection_id)
         OR (rd_connection_id IS NULL AND _deal.rd_connection_id IS NULL)
       )
       AND (
         source_provider = 'rd_station'
         OR match_method LIKE 'rd_%'
         OR source_record_id = _deal.rd_deal_id
       );
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Importações antigas podem referenciar contas já removidas. Só propaga o
  -- vínculo quando a conta ainda existe; a receita permanece canônica, porém
  -- sem atribuição inventada e sem violar a FK de `sales.ad_account_id`.
  SELECT id, workspace_id, business_unit_id
    INTO _valid_ad_account_id, _workspace_id, _business_unit_id
    FROM public.ad_accounts
   WHERE id = _deal.ad_account_id;

  -- Atribuição estrita: somente campanha da mesma conta. ID exato tem
  -- prioridade; nome exato normalizado é o segundo nível. Nunca há fallback
  -- para outra conta e nunca há aproximação fuzzy para faturamento.
  SELECT c.id, c.name,
         CASE
           WHEN public.growdash_normalize_key(c.id) = ANY (ARRAY[
             public.growdash_normalize_key(_deal.utm_campaign),
             public.growdash_normalize_key(_deal.first_touch_utm_campaign),
             public.growdash_normalize_key(_deal.last_touch_utm_campaign)
           ]) THEN 1
           ELSE 2
         END AS priority
    INTO _campaign_id, _campaign_name, _confidence
    FROM public.campaigns c
   WHERE c.ad_account_id = _valid_ad_account_id
     AND (
       public.growdash_normalize_key(c.id) = ANY (ARRAY[
         public.growdash_normalize_key(_deal.utm_campaign),
         public.growdash_normalize_key(_deal.first_touch_utm_campaign),
         public.growdash_normalize_key(_deal.last_touch_utm_campaign)
       ])
       OR public.growdash_normalize_key(c.name) = ANY (ARRAY[
         public.growdash_normalize_key(_deal.utm_campaign),
         public.growdash_normalize_key(_deal.first_touch_utm_campaign),
         public.growdash_normalize_key(_deal.last_touch_utm_campaign)
       ])
     )
   ORDER BY priority, c.updated_at DESC
   LIMIT 1;

  IF _campaign_id IS NOT NULL THEN
    IF _confidence = 1 THEN
      _confidence := 1.0000;
      _reason := 'rd_utm_campaign_id_exact';
    ELSE
      _confidence := 0.9500;
      _reason := 'rd_utm_campaign_name_exact';
    END IF;
  ELSE
    _confidence := 0.0000;
  END IF;

  IF nullif(trim(coalesce(_deal.rd_product_name, '')), '') IS NOT NULL THEN
    SELECT p.id, coalesce(p.tax_rate, 0)
      INTO _product_id, _tax_rate
      FROM public.products p
     WHERE p.user_id = _deal.user_id
       AND public.growdash_normalize_key(p.name) =
           public.growdash_normalize_key(_deal.rd_product_name)
     ORDER BY p.updated_at DESC
     LIMIT 1;
  END IF;

  _gross := greatest(coalesce(_deal.amount_total, 0), 0);
  _tax := round(_gross * coalesce(_tax_rate, 0) / 100.0, 2);
  _net := _gross - _tax;
  _sale_date := (
    coalesce(
      _deal.closed_at,
      _deal.stage_updated_at,
      _deal.lead_created_at,
      _deal.updated_at,
      now()
    ) AT TIME ZONE 'America/Sao_Paulo'
  )::date;

  INSERT INTO public.sales (
    user_id,
    workspace_id,
    business_unit_id,
    product_id,
    ad_account_id,
    campaign_ids,
    sale_date,
    gross_revenue,
    net_revenue,
    tax_amount,
    refund_amount,
    chargeback_amount,
    payment_method,
    payment_method_source,
    status,
    quantity,
    contact_name,
    contact_email,
    lead_state,
    lead_city,
    lead_entry_date,
    rd_deal_id,
    rd_connection_id,
    rd_campaign_name,
    rd_product_name,
    rd_funnel_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    matched_campaign_id,
    match_method,
    custom_fields,
    source_provider,
    source_record_id,
    source_closed_at,
    attribution_confidence,
    attribution_reason
  ) VALUES (
    _deal.user_id,
    _workspace_id,
    _business_unit_id,
    _product_id,
    _valid_ad_account_id,
    CASE WHEN _campaign_id IS NULL THEN '{}'::text[] ELSE ARRAY[_campaign_id] END,
    _sale_date,
    _gross,
    _net,
    _tax,
    0,
    0,
    'outros',
    'rd',
    'confirmed',
    1,
    _deal.contact_name,
    _deal.contact_email,
    _deal.lead_state,
    _deal.lead_city,
    (_deal.lead_created_at AT TIME ZONE 'America/Sao_Paulo')::date,
    _deal.rd_deal_id,
    _deal.rd_connection_id,
    coalesce(_campaign_name, _deal.utm_campaign),
    _deal.rd_product_name,
    _deal.rd_funnel_id,
    _deal.utm_source,
    _deal.utm_medium,
    _deal.utm_campaign,
    _deal.utm_term,
    _deal.utm_content,
    _campaign_id,
    CASE WHEN _campaign_id IS NULL THEN 'rd_sync' ELSE 'rd_utm_exact' END,
    coalesce(_deal.custom_fields, '{}'::jsonb),
    'rd_station',
    _deal.rd_deal_id,
    _deal.closed_at,
    _confidence,
    _reason
  )
  ON CONFLICT (rd_connection_id, rd_deal_id) WHERE rd_connection_id IS NOT NULL AND rd_deal_id IS NOT NULL
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    workspace_id = coalesce(EXCLUDED.workspace_id, sales.workspace_id),
    business_unit_id = coalesce(EXCLUDED.business_unit_id, sales.business_unit_id),
    product_id = coalesce(sales.product_id, EXCLUDED.product_id),
    ad_account_id = EXCLUDED.ad_account_id,
    campaign_ids = CASE
      WHEN sales.manual_override THEN sales.campaign_ids
      ELSE EXCLUDED.campaign_ids
    END,
    sale_date = EXCLUDED.sale_date,
    gross_revenue = EXCLUDED.gross_revenue,
    net_revenue = EXCLUDED.net_revenue,
    tax_amount = EXCLUDED.tax_amount,
    status = 'confirmed',
    quantity = CASE
      WHEN sales.manual_override THEN greatest(coalesce(sales.quantity, 1), 1)
      ELSE 1
    END,
    contact_name = coalesce(sales.contact_name, EXCLUDED.contact_name),
    contact_email = coalesce(sales.contact_email, EXCLUDED.contact_email),
    lead_state = coalesce(sales.lead_state, EXCLUDED.lead_state),
    lead_city = coalesce(sales.lead_city, EXCLUDED.lead_city),
    lead_entry_date = coalesce(sales.lead_entry_date, EXCLUDED.lead_entry_date),
    rd_campaign_name = EXCLUDED.rd_campaign_name,
    rd_product_name = EXCLUDED.rd_product_name,
    rd_funnel_id = EXCLUDED.rd_funnel_id,
    utm_source = coalesce(EXCLUDED.utm_source, sales.utm_source),
    utm_medium = coalesce(EXCLUDED.utm_medium, sales.utm_medium),
    utm_campaign = coalesce(EXCLUDED.utm_campaign, sales.utm_campaign),
    utm_term = coalesce(EXCLUDED.utm_term, sales.utm_term),
    utm_content = coalesce(EXCLUDED.utm_content, sales.utm_content),
    matched_campaign_id = CASE
      WHEN sales.manual_override THEN sales.matched_campaign_id
      ELSE coalesce(EXCLUDED.matched_campaign_id, sales.matched_campaign_id)
    END,
    match_method = CASE
      WHEN sales.manual_override THEN sales.match_method
      ELSE coalesce(EXCLUDED.match_method, sales.match_method)
    END,
    custom_fields = coalesce(EXCLUDED.custom_fields, sales.custom_fields),
    source_provider = EXCLUDED.source_provider,
    source_record_id = EXCLUDED.source_record_id,
    source_closed_at = EXCLUDED.source_closed_at,
    attribution_confidence = EXCLUDED.attribution_confidence,
    attribution_reason = EXCLUDED.attribution_reason,
    updated_at = now();

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.sales.rd_connection_id IS
  'RD Station connection that produced this sale. Together with rd_deal_id it forms the canonical provider identity, so two connections can never overwrite each other''s revenue.';
