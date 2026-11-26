-- Dashboard customizable views
CREATE TABLE public.dashboard_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'global',
  ad_account_id uuid NULL,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_views_user ON public.dashboard_views(user_id);

ALTER TABLE public.dashboard_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own views" ON public.dashboard_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own views" ON public.dashboard_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own views" ON public.dashboard_views FOR UPDATE USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users delete own views" ON public.dashboard_views FOR DELETE USING (auth.uid() = user_id AND is_system = false);

CREATE TRIGGER trg_dashboard_views_updated
  BEFORE UPDATE ON public.dashboard_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dashboard_view_state (
  user_id uuid NOT NULL,
  context_key text NOT NULL,
  view_id uuid NOT NULL REFERENCES public.dashboard_views(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, context_key)
);

ALTER TABLE public.dashboard_view_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own view state" ON public.dashboard_view_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own view state" ON public.dashboard_view_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own view state" ON public.dashboard_view_state FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own view state" ON public.dashboard_view_state FOR DELETE USING (auth.uid() = user_id);