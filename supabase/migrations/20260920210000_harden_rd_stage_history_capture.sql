CREATE OR REPLACE FUNCTION public.capture_rd_deal_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR old.rd_stage_id IS DISTINCT FROM new.rd_stage_id
     OR old.stage_bucket IS DISTINCT FROM new.stage_bucket THEN
    INSERT INTO public.rd_deal_stage_history (
      rd_deal_id, user_id, ad_account_id, rd_funnel_id,
      from_stage_id, from_stage_name, from_stage_bucket,
      to_stage_id, to_stage_name, to_stage_bucket,
      source, changed_at, metadata
    ) VALUES (
      new.id, new.user_id, new.ad_account_id, new.rd_funnel_id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE old.rd_stage_id END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE old.rd_stage_name END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE old.stage_bucket END,
      new.rd_stage_id, new.rd_stage_name, new.stage_bucket,
      'rd_sync', coalesce(new.stage_updated_at, new.lead_created_at, now()),
      jsonb_build_object('rd_deal_id', new.rd_deal_id, 'operation', lower(TG_OP))
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS capture_rd_deal_stage_history ON public.rd_deals;
CREATE TRIGGER capture_rd_deal_stage_history
AFTER INSERT OR UPDATE OF rd_stage_id, rd_stage_name, stage_bucket ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.capture_rd_deal_stage_history();

