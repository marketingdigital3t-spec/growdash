-- Photos used by the commercial television ranking.
CREATE TABLE IF NOT EXISTS public.commercial_seller_profiles (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, seller_name)
);
CREATE INDEX IF NOT EXISTS commercial_seller_profiles_workspace_idx ON public.commercial_seller_profiles(workspace_id);
ALTER TABLE public.commercial_seller_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.commercial_seller_profiles TO authenticated;
GRANT ALL ON public.commercial_seller_profiles TO service_role;
DROP POLICY IF EXISTS "Members read commercial seller profiles" ON public.commercial_seller_profiles;
CREATE POLICY "Members read commercial seller profiles" ON public.commercial_seller_profiles FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Managers manage commercial seller profiles" ON public.commercial_seller_profiles;
CREATE POLICY "Managers manage commercial seller profiles" ON public.commercial_seller_profiles FOR INSERT TO authenticated WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Managers update commercial seller profiles" ON public.commercial_seller_profiles FOR UPDATE TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
