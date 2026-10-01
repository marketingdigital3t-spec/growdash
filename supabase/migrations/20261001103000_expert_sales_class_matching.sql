-- Stable class matching for expert spreadsheet imports.
ALTER TABLE public.event_classes
  ADD COLUMN IF NOT EXISTS expert_id uuid REFERENCES public.experts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_classes_expert_idx ON public.event_classes (expert_id);

ALTER TABLE public.expert_sales
  ADD COLUMN IF NOT EXISTS source_class_id text,
  ADD COLUMN IF NOT EXISTS class_match_status text NOT NULL DEFAULT 'unmatched';

ALTER TABLE public.expert_sales
  DROP CONSTRAINT IF EXISTS expert_sales_class_match_status_check;

ALTER TABLE public.expert_sales
  ADD CONSTRAINT expert_sales_class_match_status_check
  CHECK (class_match_status IN ('matched', 'unmatched', 'ambiguous'));

CREATE INDEX IF NOT EXISTS expert_sales_source_class_idx
  ON public.expert_sales (expert_id, source_class_id, class_match_status);
