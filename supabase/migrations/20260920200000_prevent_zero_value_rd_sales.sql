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
       AND source_provider = 'rd_station';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS zz_prevent_zero_value_rd_sale ON public.rd_deals;
CREATE TRIGGER zz_prevent_zero_value_rd_sale
AFTER INSERT OR UPDATE OF win, amount_total ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.prevent_zero_value_rd_sale();
