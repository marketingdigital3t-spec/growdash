
-- Status enum-like constraint via check
CREATE TABLE public.event_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  rd_funnel_id uuid NOT NULL,
  title text NOT NULL,
  date_start date NOT NULL,
  date_end date,
  location text,
  max_students integer NOT NULL DEFAULT 0,
  max_model_patients integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sold_out','upcoming','cancelled','finished')),
  allowed_student_stage_ids text[] NOT NULL DEFAULT '{}',
  allowed_model_patient_stage_ids text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View event_classes" ON public.event_classes FOR SELECT
USING (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert event_classes" ON public.event_classes FOR INSERT
WITH CHECK (has_role(auth.uid(),'admin') OR (auth.uid() = user_id AND user_owns_ad_account(auth.uid(), ad_account_id)));
CREATE POLICY "Update event_classes" ON public.event_classes FOR UPDATE
USING (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete event_classes" ON public.event_classes FOR DELETE
USING (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TRIGGER trg_event_classes_updated
BEFORE UPDATE ON public.event_classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_classes_funnel ON public.event_classes(rd_funnel_id);
CREATE INDEX idx_event_classes_account ON public.event_classes(ad_account_id);

-- Members
CREATE TABLE public.event_class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  rd_deal_id text NOT NULL,
  member_type text NOT NULL CHECK (member_type IN ('student','model_patient')),
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (event_class_id, rd_deal_id, member_type)
);

ALTER TABLE public.event_class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View event_class_members" ON public.event_class_members FOR SELECT
USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
  AND (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Insert event_class_members" ON public.event_class_members FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
  AND (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Update event_class_members" ON public.event_class_members FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
  AND (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Delete event_class_members" ON public.event_class_members FOR DELETE
USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
  AND (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ec.ad_account_id))));

CREATE INDEX idx_event_class_members_class ON public.event_class_members(event_class_id);
CREATE INDEX idx_event_class_members_deal ON public.event_class_members(rd_deal_id);

-- History
CREATE TABLE public.event_class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_class_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View event_class_history" ON public.event_class_history FOR SELECT
USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
  AND (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Insert event_class_history" ON public.event_class_history FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id
  AND (has_role(auth.uid(),'admin') OR user_owns_ad_account(auth.uid(), ec.ad_account_id))));

CREATE INDEX idx_event_class_history_class ON public.event_class_history(event_class_id, created_at DESC);
