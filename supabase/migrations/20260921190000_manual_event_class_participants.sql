-- Datas & Turmas is an intentionally local/manual workflow. Existing RD/Meta
-- links are cleared once; legacy tables remain only for compatibility.
ALTER TABLE public.event_classes
  ADD COLUMN IF NOT EXISTS expert_name text;

ALTER TABLE public.event_classes
  ALTER COLUMN ad_account_id DROP NOT NULL,
  ALTER COLUMN rd_funnel_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_class_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  participant_type text NOT NULL CHECK (participant_type IN ('student', 'model_patient')),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  investment_cents bigint NOT NULL DEFAULT 0 CHECK (investment_cents >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_class_participants_unique_name
  ON public.event_class_participants (event_class_id, participant_type, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS event_class_participants_class_idx
  ON public.event_class_participants (event_class_id, participant_type, created_at);

ALTER TABLE public.event_class_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_class_participants TO authenticated;
GRANT ALL ON public.event_class_participants TO service_role;

DROP POLICY IF EXISTS "event_class_participants_select" ON public.event_class_participants;
DROP POLICY IF EXISTS "event_class_participants_insert" ON public.event_class_participants;
DROP POLICY IF EXISTS "event_class_participants_update" ON public.event_class_participants;
DROP POLICY IF EXISTS "event_class_participants_delete" ON public.event_class_participants;
CREATE POLICY "event_class_participants_select" ON public.event_class_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (ec.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "event_class_participants_insert" ON public.event_class_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (ec.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "event_class_participants_update" ON public.event_class_participants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (ec.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (ec.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "event_class_participants_delete" ON public.event_class_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (ec.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP TRIGGER IF EXISTS trg_event_class_participants_updated ON public.event_class_participants;
CREATE TRIGGER trg_event_class_participants_updated BEFORE UPDATE ON public.event_class_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DELETE FROM public.event_class_members;
DELETE FROM public.event_class_sources;
UPDATE public.event_classes
SET ad_account_id = NULL,
    rd_funnel_id = NULL,
    rd_model_patient_funnel_id = NULL,
    allowed_student_stage_ids = '{}',
    allowed_model_patient_stage_ids = '{}',
    manual_student_count = 0,
    manual_model_patient_count = 0;
