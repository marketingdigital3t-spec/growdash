-- Keep class occupancy aligned with confirmed RD Station sales.  Only records
-- created automatically (linked_by IS NULL) are managed here; manual links are
-- never removed by this routine.

CREATE OR REPLACE FUNCTION public.event_class_region(p_location text, p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_location, '') || ' ' || coalesce(p_title, '')) ~ '(são paulo|sao paulo|(^|[^a-z])sp([^a-z]|$))' THEN 'SP'
    WHEN lower(coalesce(p_location, '') || ' ' || coalesce(p_title, '')) ~ '(tocantins|araguaína|araguaina|(^|[^a-z])to([^a-z]|$))' THEN 'TO'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.rd_deal_region(p_state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(p_state, ''))) IN ('sp', 'são paulo', 'sao paulo') THEN 'SP'
    WHEN lower(trim(coalesce(p_state, ''))) IN ('to', 'tocantins') THEN 'TO'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_class_members_from_rd(p_event_class_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT ec.id AS event_class_id, d.rd_deal_id, 'student'::text AS member_type
    FROM public.event_classes ec
    JOIN public.rd_deals d ON d.rd_funnel_id = ec.rd_funnel_id
    WHERE (p_event_class_id IS NULL OR ec.id = p_event_class_id)
      AND d.win IS TRUE
      AND public.event_class_region(ec.location, ec.title) IS NOT NULL
      AND public.rd_deal_region(d.lead_state) = public.event_class_region(ec.location, ec.title)
      AND (cardinality(ec.allowed_student_stage_ids) = 0 OR d.rd_stage_id = ANY(ec.allowed_student_stage_ids))
    UNION ALL
    SELECT ec.id AS event_class_id, d.rd_deal_id, 'model_patient'::text AS member_type
    FROM public.event_classes ec
    JOIN public.rd_deals d ON d.rd_funnel_id = ec.rd_model_patient_funnel_id
    WHERE (p_event_class_id IS NULL OR ec.id = p_event_class_id)
      AND ec.has_model_patients IS TRUE
      AND d.win IS TRUE
      AND public.event_class_region(ec.location, ec.title) IS NOT NULL
      AND public.rd_deal_region(d.lead_state) = public.event_class_region(ec.location, ec.title)
      AND (cardinality(ec.allowed_model_patient_stage_ids) = 0 OR d.rd_stage_id = ANY(ec.allowed_model_patient_stage_ids))
  ), inserted AS (
    INSERT INTO public.event_class_members (event_class_id, rd_deal_id, member_type, linked_by, last_synced_at)
    SELECT event_class_id, rd_deal_id, member_type, NULL, now() FROM candidates
    ON CONFLICT (event_class_id, rd_deal_id, member_type)
    DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
    RETURNING 1
  )
  SELECT count(*) INTO affected_count FROM inserted;

  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_event_class_members_from_rd(uuid) TO authenticated, service_role;

-- Repair the existing Ranniely TO class: it pointed at a deleted funnel.  The
-- two correct funnels and their "Venda Realizada" stages are now explicit.
UPDATE public.event_classes ec
SET rd_funnel_id = 'e46fad80-2d28-4ddc-88d4-d80f0c6de4a5',
    rd_model_patient_funnel_id = 'a138f8f4-11b0-489f-ae85-4fc351562c57',
    allowed_student_stage_ids = ARRAY['6a3154aeae51270026e8d1d8'],
    allowed_model_patient_stage_ids = ARRAY['6a7ca7acbfa2b31070713bab'],
    has_model_patients = true
FROM public.ad_accounts aa
WHERE ec.ad_account_id = aa.id
  AND aa.name ILIKE '%Ranniely%'
  AND public.event_class_region(ec.location, ec.title) = 'TO';

SELECT public.sync_event_class_members_from_rd();
