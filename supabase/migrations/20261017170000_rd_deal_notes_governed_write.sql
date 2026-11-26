-- Notas criadas na Growdash passam pela mesma trilha de escrita auditada do RD.
-- A tabela local continua sendo o histórico rápido da interface; a auditoria
-- registra a chamada ao endpoint /activities antes de ela ocorrer.
ALTER TABLE public.rd_write_audit
  DROP CONSTRAINT IF EXISTS rd_write_audit_acao_check;

ALTER TABLE public.rd_write_audit
  ADD CONSTRAINT rd_write_audit_acao_check
  CHECK (acao IN ('move_stage', 'update_deal', 'update_contact', 'create_contact', 'add_note'));

COMMENT ON COLUMN public.rd_write_audit.acao IS
  'Operação governada no RD Station; add_note usa POST /api/v1/activities.';

-- Troca de pipeline também é uma movimentação de negócio e precisa aparecer
-- na timeline local, mesmo quando a etapa tem o mesmo nome.
CREATE OR REPLACE FUNCTION public.capture_rd_deal_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR old.rd_stage_id IS DISTINCT FROM new.rd_stage_id
     OR old.stage_bucket IS DISTINCT FROM new.stage_bucket
     OR old.rd_funnel_id IS DISTINCT FROM new.rd_funnel_id THEN
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
      CASE WHEN TG_OP = 'INSERT' THEN 'rd_sync' ELSE 'manual_approved' END,
      coalesce(new.stage_updated_at, new.lead_created_at, now()),
      jsonb_build_object(
        'rd_deal_id', new.rd_deal_id,
        'operation', lower(TG_OP),
        'pipeline_changed', CASE WHEN TG_OP = 'INSERT' THEN false ELSE old.rd_funnel_id IS DISTINCT FROM new.rd_funnel_id END
      )
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS capture_rd_deal_stage_history ON public.rd_deals;
CREATE TRIGGER capture_rd_deal_stage_history
AFTER INSERT OR UPDATE OF rd_funnel_id, rd_stage_id, rd_stage_name, stage_bucket ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.capture_rd_deal_stage_history();
