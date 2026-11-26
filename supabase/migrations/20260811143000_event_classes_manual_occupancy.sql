-- Manual occupancy complements RD-linked members for classes with offline/manual enrollments.
ALTER TABLE public.event_classes
  ADD COLUMN IF NOT EXISTS manual_student_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_model_patient_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.event_classes
  DROP CONSTRAINT IF EXISTS event_classes_manual_student_count_nonnegative,
  DROP CONSTRAINT IF EXISTS event_classes_manual_model_patient_count_nonnegative;

ALTER TABLE public.event_classes
  ADD CONSTRAINT event_classes_manual_student_count_nonnegative
    CHECK (manual_student_count >= 0),
  ADD CONSTRAINT event_classes_manual_model_patient_count_nonnegative
    CHECK (manual_model_patient_count >= 0);
