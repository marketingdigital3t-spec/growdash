CREATE TABLE public.platform_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  parent_platform text,
  match_field text NOT NULL,
  match_mode text NOT NULL DEFAULT 'contains',
  pattern text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own platform rules" ON public.platform_rules FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own platform rules" ON public.platform_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own platform rules" ON public.platform_rules FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own platform rules" ON public.platform_rules FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_platform_rules_updated
BEFORE UPDATE ON public.platform_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_platform_rules_user ON public.platform_rules(user_id, platform, priority);