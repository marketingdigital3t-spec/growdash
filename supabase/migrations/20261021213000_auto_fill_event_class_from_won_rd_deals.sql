-- A Agenda & Turmas consome expert_sales. Até aqui a sincronização do RD
-- atualizava rd_deals/sales, mas não criava a linha operacional da turma.
-- Este trigger mantém a turma sincronizada sempre que o espelho de uma
-- negociação muda de etapa/ganho, sem tocar em participantes manuais.

CREATE OR REPLACE FUNCTION public.sync_expert_sale_from_rd_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_row record;
  source_key text;
  sale_date_value date;
  amount_cents integer;
BEGIN
  -- Primeiro desativa os vínculos automáticos anteriores deste negócio. Se a
  -- negociação voltar para uma etapa aberta, ela desaparece da turma sem
  -- remover nenhum participante cadastrado manualmente.
  UPDATE public.expert_sales
  SET source_active = false,
      updated_at = now()
  WHERE sheet_connection_id IS NULL
    AND source_row_key LIKE 'rd:' || coalesce(NEW.rd_connection_id::text, '') || ':' || NEW.rd_deal_id || ':%'
    AND source_active IS TRUE;

  IF NEW.win IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  sale_date_value := (coalesce(NEW.closed_at, NEW.stage_updated_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  amount_cents := greatest(0, round(coalesce(NEW.amount_total, 0) * 100)::integer);

  FOR source_row IN
    SELECT DISTINCT
      ec.id AS event_class_id,
      ec.expert_id,
      ec.title,
      ec.date_start,
      source.member_type
    FROM public.event_class_sources source
    JOIN public.event_classes ec ON ec.id = source.event_class_id
    WHERE source.rd_funnel_id = NEW.rd_funnel_id
      AND ec.expert_id IS NOT NULL
      AND (source.member_type <> 'model_patient' OR ec.has_model_patients IS TRUE)
      AND (cardinality(source.allowed_stage_ids) = 0 OR NEW.rd_stage_id = ANY(source.allowed_stage_ids))
      AND (
        (
          public.event_class_region(ec.location, ec.title) IS NOT NULL
          AND public.rd_deal_region(NEW.lead_state) = public.event_class_region(ec.location, ec.title)
        )
        OR
        (
          EXISTS (
            SELECT 1
            FROM jsonb_each_text(CASE WHEN jsonb_typeof(NEW.custom_fields) = 'object' THEN NEW.custom_fields ELSE '{}'::jsonb END) field(k, v)
            WHERE regexp_replace(lower(unaccent(field.k)), '[^a-z0-9]', '', 'g') IN ('datadaturma','dataturma','turma')
              AND (field.v ILIKE '%' || to_char(ec.date_start, 'DD/MM') || '%' OR field.v ILIKE '%' || to_char(ec.date_start, 'DD-MM') || '%')
          )
          AND EXISTS (
            SELECT 1
            FROM jsonb_each_text(CASE WHEN jsonb_typeof(NEW.custom_fields) = 'object' THEN NEW.custom_fields ELSE '{}'::jsonb END) field(k, v)
            WHERE regexp_replace(lower(unaccent(field.k)), '[^a-z0-9]', '', 'g') IN ('tipodepublico','publico','tipopublico')
              AND ((source.member_type = 'student' AND (field.v ILIKE '%alun%' OR field.v ILIKE '%pesso%'))
                OR (source.member_type = 'model_patient' AND (field.v ILIKE '%paciente%' OR field.v ILIKE '%modelo%')))
          )
        )
      )
  LOOP
    source_key := 'rd:' || coalesce(NEW.rd_connection_id::text, '') || ':' || NEW.rd_deal_id || ':' || source_row.event_class_id::text || ':' || source_row.member_type;

    -- sheet_connection_id is intentionally NULL for RD-originated rows, and
    -- PostgreSQL UNIQUE constraints allow multiple NULLs. Remove the previous
    -- projection first so a repeated RD sync never creates duplicate active
    -- rows for the same deal/turma/type.
    DELETE FROM public.expert_sales
    WHERE sheet_connection_id IS NULL
      AND expert_id = source_row.expert_id
      AND source_row_key = source_key;

    INSERT INTO public.expert_sales (
      expert_id, event_class_id, sheet_connection_id, participant_type,
      source_row_hash, source_row_key, source_active, name, sale_date,
      paid_at, class_date, source_class_id, class_match_status, class_name,
      gross_amount_cents, cash_received_cents, status, seller_name,
      payment_method, notes, raw_row, source_updated_at, last_seen_at
    ) VALUES (
      source_row.expert_id, source_row.event_class_id, NULL, source_row.member_type,
      md5(source_key), source_key, true,
      coalesce(nullif(trim(NEW.contact_name), ''), 'Negociação ' || NEW.rd_deal_id),
      sale_date_value, sale_date_value, source_row.date_start, source_row.event_class_id::text,
      'matched', source_row.title, amount_cents, amount_cents, 'confirmed',
      NEW.deal_owner_name, null, 'Venda ganha no RD Station',
      coalesce(NEW.raw, '{}'::jsonb), now(), now()
    );

    -- Keep the normalized membership projection in sync for other consumers
    -- of the class roster as well as the expert operations panel.
    PERFORM public.sync_event_class_members_from_rd(source_row.event_class_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_expert_sale_from_rd_deal ON public.rd_deals;
CREATE TRIGGER sync_expert_sale_from_rd_deal
AFTER INSERT OR UPDATE OF rd_funnel_id, rd_stage_id, rd_stage_name, stage_bucket, win, lead_state, custom_fields, closed_at, stage_updated_at
ON public.rd_deals
FOR EACH ROW
EXECUTE FUNCTION public.sync_expert_sale_from_rd_deal();

REVOKE ALL ON FUNCTION public.sync_expert_sale_from_rd_deal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_expert_sale_from_rd_deal() TO service_role;
