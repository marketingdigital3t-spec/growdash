-- Fonte canônica de faturamento RD Station -> Growdash.
--
-- Toda negociação ganha do RD gera exatamente uma linha em `sales`. Isso
-- garante que Dashboard, Tráfego, Comercial, Financeiro e Análise de Funis
-- consumam a mesma receita, sem duplicação e sem mistura entre contas.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_record_id text,
  ADD COLUMN IF NOT EXISTS source_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attribution_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS attribution_reason text;

CREATE INDEX IF NOT EXISTS idx_sales_source_record
  ON public.sales(user_id, source_provider, source_record_id);
CREATE INDEX IF NOT EXISTS idx_sales_account_date_status
  ON public.sales(ad_account_id, sale_date, status);

CREATE OR REPLACE FUNCTION public.growdash_normalize_key(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    translate(
      lower(coalesce(_value, '')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

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
  ON CONFLICT (rd_deal_id) DO UPDATE SET
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
      ELSE EXCLUDED.matched_campaign_id
    END,
    match_method = CASE
      WHEN sales.manual_override THEN sales.match_method
      ELSE EXCLUDED.match_method
    END,
    custom_fields = coalesce(EXCLUDED.custom_fields, sales.custom_fields),
    source_provider = EXCLUDED.source_provider,
    source_record_id = EXCLUDED.source_record_id,
    source_closed_at = EXCLUDED.source_closed_at,
    attribution_confidence = CASE
      WHEN sales.manual_override THEN sales.attribution_confidence
      ELSE EXCLUDED.attribution_confidence
    END,
    attribution_reason = CASE
      WHEN sales.manual_override THEN sales.attribution_reason
      ELSE EXCLUDED.attribution_reason
    END,
    updated_at = now();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rd_deal_to_canonical_sale ON public.rd_deals;
DROP TRIGGER IF EXISTS trg_delete_rd_deal_canonical_sale ON public.rd_deals;
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

CREATE TRIGGER trg_delete_rd_deal_canonical_sale
AFTER DELETE ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.sync_rd_deal_to_canonical_sale();

-- Materializa o histórico já importado e encerra receitas de negócios que
-- deixaram de estar ganhos. A operação é idempotente pelo `rd_deal_id`.
UPDATE public.rd_deals
   SET win = win;
