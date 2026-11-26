-- A turma é a capacidade operacional; cada fonte é uma conta/funil RD que a
-- alimenta. Isso permite, por exemplo, Alunas e Pacientes-modelo de contas
-- diferentes preencherem a mesma data sem duplicar a turma.
CREATE TABLE IF NOT EXISTS public.event_class_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  rd_funnel_id uuid NOT NULL REFERENCES public.rd_funnels(id) ON DELETE CASCADE,
  member_type text NOT NULL CHECK (member_type IN ('student', 'model_patient')),
  allowed_stage_ids text[] NOT NULL DEFAULT '{}',
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_class_id, rd_funnel_id, member_type)
);

CREATE INDEX IF NOT EXISTS idx_event_class_sources_class ON public.event_class_sources(event_class_id);
CREATE INDEX IF NOT EXISTS idx_event_class_sources_funnel ON public.event_class_sources(rd_funnel_id);
ALTER TABLE public.event_class_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_class_sources TO authenticated;
GRANT ALL ON public.event_class_sources TO service_role;

CREATE POLICY "View event_class_sources" ON public.event_class_sources FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
    AND (public.has_role(auth.uid(), 'admin') OR ec.user_id = auth.uid() OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))))
);
CREATE POLICY "Insert event_class_sources" ON public.event_class_sources FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
    AND (public.has_role(auth.uid(), 'admin') OR ec.user_id = auth.uid() OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))))
);
CREATE POLICY "Update event_class_sources" ON public.event_class_sources FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
    AND (public.has_role(auth.uid(), 'admin') OR ec.user_id = auth.uid() OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))))
);
CREATE POLICY "Delete event_class_sources" ON public.event_class_sources FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
    AND (public.has_role(auth.uid(), 'admin') OR ec.user_id = auth.uid() OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))))
);
CREATE TRIGGER trg_event_class_sources_updated BEFORE UPDATE ON public.event_class_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bring every pre-existing legacy setup forward as its first source.
INSERT INTO public.event_class_sources (event_class_id, ad_account_id, rd_funnel_id, member_type, allowed_stage_ids)
SELECT id, ad_account_id, rd_funnel_id, 'student', allowed_student_stage_ids
FROM public.event_classes
WHERE rd_funnel_id IS NOT NULL
ON CONFLICT (event_class_id, rd_funnel_id, member_type) DO NOTHING;

INSERT INTO public.event_class_sources (event_class_id, ad_account_id, rd_funnel_id, member_type, allowed_stage_ids)
SELECT id, ad_account_id, rd_model_patient_funnel_id, 'model_patient', allowed_model_patient_stage_ids
FROM public.event_classes
WHERE has_model_patients IS TRUE AND rd_model_patient_funnel_id IS NOT NULL
ON CONFLICT (event_class_id, rd_funnel_id, member_type) DO NOTHING;

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
    SELECT DISTINCT ec.id AS event_class_id, d.rd_deal_id, source.member_type
    FROM public.event_classes ec
    JOIN public.event_class_sources source ON source.event_class_id = ec.id
    JOIN public.rd_deals d ON d.rd_funnel_id = source.rd_funnel_id
    WHERE (p_event_class_id IS NULL OR ec.id = p_event_class_id)
      AND d.win IS TRUE
      AND (source.member_type <> 'model_patient' OR ec.has_model_patients IS TRUE)
      AND public.event_class_region(ec.location, ec.title) IS NOT NULL
      AND public.rd_deal_region(d.lead_state) = public.event_class_region(ec.location, ec.title)
      AND (cardinality(source.allowed_stage_ids) = 0 OR d.rd_stage_id = ANY(source.allowed_stage_ids))
  ), removed AS (
    DELETE FROM public.event_class_members member
    WHERE member.linked_by IS NULL
      AND (p_event_class_id IS NULL OR member.event_class_id = p_event_class_id)
      AND NOT EXISTS (
        SELECT 1 FROM candidates candidate
        WHERE candidate.event_class_id = member.event_class_id
          AND candidate.rd_deal_id = member.rd_deal_id
          AND candidate.member_type = member.member_type
      )
    RETURNING 1
  ), inserted AS (
    INSERT INTO public.event_class_members (event_class_id, rd_deal_id, member_type, linked_by, last_synced_at)
    SELECT event_class_id, rd_deal_id, member_type, NULL, now() FROM candidates
    ON CONFLICT (event_class_id, rd_deal_id, member_type)
    DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM removed) + (SELECT count(*) FROM inserted) INTO affected_count;

  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_event_class_members_from_rd(uuid) TO authenticated, service_role;
