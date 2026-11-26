-- Papéis da interface:
-- owner/admin -> Administrador
-- analyst/financial -> Editor
-- member -> Visualizador

CREATE OR REPLACE FUNCTION public.can_edit_workspace(
  _workspace_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.status = 'active'
      AND wm.role IN ('owner', 'admin', 'analyst', 'financial')
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_edit_workspace_object(
  _object_name text,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  BEGIN
    _workspace_id := split_part(_object_name, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  RETURN public.can_edit_workspace(_workspace_id, _user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.can_edit_workspace_object(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace_object(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members upload workspace files" ON public.workspace_files;
CREATE POLICY "Editors upload workspace files"
ON public.workspace_files FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND public.can_edit_workspace(workspace_id)
);

DROP POLICY IF EXISTS "Members update own files" ON public.workspace_files;
CREATE POLICY "Editors update own files"
ON public.workspace_files FOR UPDATE TO authenticated
USING (
  (owner_id = auth.uid() AND public.can_edit_workspace(workspace_id))
  OR public.can_manage_workspace(workspace_id)
)
WITH CHECK (
  (owner_id = auth.uid() AND public.can_edit_workspace(workspace_id))
  OR public.can_manage_workspace(workspace_id)
);

DROP POLICY IF EXISTS "Admins remove workspace files" ON public.workspace_files;
CREATE POLICY "Editors remove own workspace files"
ON public.workspace_files FOR DELETE TO authenticated
USING (
  (owner_id = auth.uid() AND public.can_edit_workspace(workspace_id))
  OR public.can_manage_workspace(workspace_id)
);

DROP POLICY IF EXISTS "Members create own drafts" ON public.campaign_drafts;
CREATE POLICY "Editors create campaign drafts"
ON public.campaign_drafts FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.can_edit_workspace(workspace_id)
);

DROP POLICY IF EXISTS "Admins review campaign drafts" ON public.campaign_drafts;
CREATE POLICY "Editors update own campaign drafts"
ON public.campaign_drafts FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid() AND public.can_edit_workspace(workspace_id))
  OR public.can_manage_workspace(workspace_id)
)
WITH CHECK (
  (created_by = auth.uid() AND public.can_edit_workspace(workspace_id))
  OR public.can_manage_workspace(workspace_id)
);

DROP POLICY IF EXISTS "Members manage playbooks" ON public.traffic_playbooks;
CREATE POLICY "Editors manage traffic playbooks"
ON public.traffic_playbooks FOR ALL TO authenticated
USING (public.can_edit_workspace(workspace_id))
WITH CHECK (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS "Members upload workspace objects" ON storage.objects;
CREATE POLICY "Editors upload workspace objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workspace-files'
  AND public.can_edit_workspace_object(name)
);

DROP POLICY IF EXISTS "Members update workspace objects" ON storage.objects;
CREATE POLICY "Editors update workspace objects"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'workspace-files'
  AND public.can_edit_workspace_object(name)
)
WITH CHECK (
  bucket_id = 'workspace-files'
  AND public.can_edit_workspace_object(name)
);

DROP POLICY IF EXISTS "Members delete workspace objects" ON storage.objects;
CREATE POLICY "Editors delete workspace objects"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'workspace-files'
  AND public.can_edit_workspace_object(name)
);

DROP POLICY IF EXISTS "Workspace members upload brand banners" ON storage.objects;
CREATE POLICY "Editors upload brand banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-banners'
  AND public.can_edit_workspace_object(name)
);

DROP POLICY IF EXISTS "Workspace members update brand banners" ON storage.objects;
CREATE POLICY "Editors update brand banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brand-banners'
  AND public.can_edit_workspace_object(name)
)
WITH CHECK (
  bucket_id = 'brand-banners'
  AND public.can_edit_workspace_object(name)
);

DROP POLICY IF EXISTS "Workspace members delete brand banners" ON storage.objects;
CREATE POLICY "Editors delete brand banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brand-banners'
  AND public.can_edit_workspace_object(name)
);
