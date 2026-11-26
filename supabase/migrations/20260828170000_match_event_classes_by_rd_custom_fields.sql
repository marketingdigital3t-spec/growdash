-- Vincula reservas do RD às turmas usando os campos personalizados da negociação.
-- Mantém a regra anterior (ganho + região) como fallback para registros legados.
CREATE OR REPLACE FUNCTION public.sync_event_class_members_from_rd(p_event_class_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT DISTINCT ec.id AS event_class_id, d.rd_deal_id, source.member_type
    FROM public.event_classes ec
    JOIN public.event_class_sources source ON source.event_class_id = ec.id
    JOIN public.rd_deals d ON d.rd_funnel_id = source.rd_funnel_id
    WHERE (p_event_class_id IS NULL OR ec.id = p_event_class_id)
      AND (source.member_type <> 'model_patient' OR ec.has_model_patients IS TRUE)
      AND (
        (
          d.win IS TRUE
          AND public.event_class_region(ec.location, ec.title) IS NOT NULL
          AND public.rd_deal_region(d.lead_state) = public.event_class_region(ec.location, ec.title)
          AND (cardinality(source.allowed_stage_ids) = 0 OR d.rd_stage_id = ANY(source.allowed_stage_ids))
        )
        OR
        (
          EXISTS (
            SELECT 1 FROM jsonb_each_text(CASE WHEN jsonb_typeof(d.custom_fields) = 'object' THEN d.custom_fields ELSE '{}'::jsonb END) f(k, v)
            WHERE regexp_replace(lower(unaccent(f.k)), '[^a-z0-9]', '', 'g') IN ('datadaturma','dataturma','turma')
              AND (f.v ILIKE '%' || to_char(ec.date_start, 'DD/MM') || '%' OR f.v ILIKE '%' || to_char(ec.date_start, 'DD-MM') || '%')
          )
          AND EXISTS (
            SELECT 1 FROM jsonb_each_text(CASE WHEN jsonb_typeof(d.custom_fields) = 'object' THEN d.custom_fields ELSE '{}'::jsonb END) f(k, v)
            WHERE regexp_replace(lower(unaccent(f.k)), '[^a-z0-9]', '', 'g') IN ('tipodepublico','publico','tipopublico')
              AND ((source.member_type = 'student' AND (f.v ILIKE '%alun%' OR f.v ILIKE '%pesso%'))
                OR (source.member_type = 'model_patient' AND (f.v ILIKE '%paciente%' OR f.v ILIKE '%modelo%')))
          )
        )
      )
  ), removed AS (
    DELETE FROM public.event_class_members member
    WHERE member.linked_by IS NULL
      AND (p_event_class_id IS NULL OR member.event_class_id = p_event_class_id)
      AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.event_class_id = member.event_class_id AND c.rd_deal_id = member.rd_deal_id AND c.member_type = member.member_type)
    RETURNING 1
  ), inserted AS (
    INSERT INTO public.event_class_members (event_class_id, rd_deal_id, member_type, linked_by, last_synced_at)
    SELECT event_class_id, rd_deal_id, member_type, NULL, now() FROM candidates
    ON CONFLICT (event_class_id, rd_deal_id, member_type) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM removed) + (SELECT count(*) FROM inserted) INTO affected_count;
  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_event_class_members_from_rd(uuid) TO authenticated, service_role;
