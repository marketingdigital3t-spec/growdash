-- Members with the explicitly granted Finance page can create their own
-- manual entries. Administration and deletion stay restricted to finance
-- managers, so a page checkbox never becomes unrestricted financial access.
CREATE OR REPLACE FUNCTION public.can_manage_finance(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    LEFT JOIN public.user_permissions permission
      ON permission.user_id = wm.user_id
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.status = 'active'
      AND (wm.role IN ('owner', 'admin', 'financial') OR COALESCE(permission.can_finance, false))
  )
$$;

CREATE TABLE IF NOT EXISTS public.workspace_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 3 AND 5000),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'access', 'finance', 'integration', 'data')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_tickets_workspace_created_idx
  ON public.workspace_tickets(workspace_id, created_at DESC);

ALTER TABLE public.workspace_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view workspace tickets" ON public.workspace_tickets
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members create own tickets" ON public.workspace_tickets
  FOR INSERT TO authenticated WITH CHECK (
    public.is_workspace_member(workspace_id) AND created_by = auth.uid()
  );
CREATE POLICY "Managers update workspace tickets" ON public.workspace_tickets
  FOR UPDATE TO authenticated USING (public.can_manage_workspace(workspace_id))
  WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Managers delete workspace tickets" ON public.workspace_tickets
  FOR DELETE TO authenticated USING (public.can_manage_workspace(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_tickets TO authenticated;
