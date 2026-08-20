-- Backfill deals that were already in a terminal "Venda" stage but were not
-- counted because the old synchronizer only recognized "Venda realizada".
-- Preserve every existing sale field; only restore confirmed status for the
-- affected RD deal and create the missing canonical sale when none exists.
WITH won_stage_deals AS (
  UPDATE public.rd_deals
     SET win = true,
         stage_bucket = 'client',
         closed_at = COALESCE(closed_at, stage_updated_at, updated_at)
   WHERE win = false
     AND lower(trim(coalesce(rd_stage_name, ''))) ~ '^(venda|vendas|sale|sales)$|(^| )(venda realizada|venda concluida|venda ganha|fechado ganho|ganho|won|cliente)( |$)'
 RETURNING user_id, rd_deal_id, ad_account_id, rd_funnel_id, amount_total, rd_product_name, utm_campaign, lead_created_at, stage_updated_at, closed_at
), restored AS (
  UPDATE public.sales s
     SET status = 'confirmed',
         sale_date = COALESCE(s.sale_date, (SELECT COALESCE(d.closed_at, d.stage_updated_at, d.lead_created_at, now())::date FROM won_stage_deals d WHERE d.rd_deal_id = s.rd_deal_id LIMIT 1))
    FROM won_stage_deals d
   WHERE s.user_id = d.user_id
     AND s.rd_deal_id = d.rd_deal_id
     AND s.status <> 'confirmed'
 RETURNING s.rd_deal_id
)
INSERT INTO public.sales (
  user_id, rd_deal_id, ad_account_id, rd_funnel_id, rd_product_name,
  sale_date, gross_revenue, net_revenue, tax_amount, payment_method,
  status, quantity, utm_campaign, source_provider, source_record_id, source_closed_at
)
SELECT d.user_id, d.rd_deal_id, d.ad_account_id, d.rd_funnel_id, d.rd_product_name,
       COALESCE(d.closed_at, d.stage_updated_at, d.lead_created_at, now())::date,
       COALESCE(d.amount_total, 0), COALESCE(d.amount_total, 0), 0, 'pix',
       'confirmed', 1, d.utm_campaign, 'rd_station', d.rd_deal_id, d.closed_at
  FROM won_stage_deals d
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sales s WHERE s.user_id = d.user_id AND s.rd_deal_id = d.rd_deal_id
 );
