-- Keep RD conversions canonical while excluding deals without financial proof
-- from the financial sales table.
UPDATE public.sales s
SET status = 'cancelled',
    attribution_reason = 'rd_won_without_financial_data',
    updated_at = now()
FROM public.rd_deals d
WHERE s.rd_deal_id = d.rd_deal_id
  AND s.user_id = d.user_id
  AND s.rd_funnel_id = d.rd_funnel_id
  AND s.source_provider = 'rd_station'
  AND s.status = 'confirmed'
  AND d.win = true
  AND coalesce(d.amount_total, 0) <= 0
  AND coalesce(s.gross_revenue, 0) <= 0
  AND coalesce(s.net_revenue, 0) <= 0;

CREATE OR REPLACE FUNCTION public.prevent_zero_value_rd_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF coalesce(NEW.win, false) AND coalesce(NEW.amount_total, 0) <= 0 THEN
    UPDATE public.sales
       SET status = 'cancelled',
           attribution_reason = 'rd_won_without_financial_data',
           updated_at = now()
     WHERE rd_deal_id = NEW.rd_deal_id
       AND user_id = NEW.user_id
       AND rd_funnel_id = NEW.rd_funnel_id
       AND status = 'confirmed'
       AND coalesce(gross_revenue, 0) <= 0
       AND coalesce(net_revenue, 0) <= 0;
  END IF;
  RETURN NEW;
END;
$function$;
