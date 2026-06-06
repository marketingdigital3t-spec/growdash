ALTER TABLE public.event_classes
  ADD COLUMN IF NOT EXISTS max_people integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_model_patients boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rd_model_patient_funnel_id uuid NULL;

UPDATE public.event_classes
  SET max_people = COALESCE(NULLIF(max_people, 0), max_students),
      has_model_patients = (max_model_patients > 0),
      rd_model_patient_funnel_id = CASE WHEN max_model_patients > 0 THEN rd_funnel_id ELSE NULL END
  WHERE max_people = 0 OR has_model_patients = false;