-- Append-only, privacy-minimised audit records for sensitive access changes.
-- Metadata intentionally excludes API tokens, webhook secrets and raw payloads.
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'workspace_member.created', 'workspace_member.updated', 'workspace_member.deleted',
    'workspace_permission.created', 'workspace_permission.updated', 'workspace_permission.deleted',
    'integration.created', 'integration.updated', 'integration.deleted'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS security_audit_events_workspace_occurred_idx
  ON public.security_audit_events(workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_events_actor_occurred_idx
  ON public.security_audit_events(actor_user_id, occurred_at DESC);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace admins read their security audit" ON public.security_audit_events;
CREATE POLICY "Workspace admins read their security audit"
ON public.security_audit_events FOR SELECT TO authenticated
USING (
  public.is_master(auth.uid())
  OR (workspace_id IS NOT NULL AND public.can_manage_workspace(workspace_id))
  OR (workspace_id IS NULL AND actor_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.capture_security_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_workspace_id uuid;
  v_subject_user_id uuid;
  v_event_type text;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_workspace_id := CASE WHEN TG_TABLE_NAME = 'integrations' THEN NULL ELSE OLD.workspace_id END;
    v_subject_user_id := OLD.user_id;
  ELSE
    v_workspace_id := CASE WHEN TG_TABLE_NAME = 'integrations' THEN NULL ELSE NEW.workspace_id END;
    v_subject_user_id := NEW.user_id;
  END IF;

  v_event_type := CASE TG_TABLE_NAME
    WHEN 'workspace_members' THEN 'workspace_member.' || lower(TG_OP)
    WHEN 'workspace_user_permissions' THEN 'workspace_permission.' || lower(TG_OP)
    WHEN 'integrations' THEN 'integration.' || lower(TG_OP)
  END;

  IF TG_TABLE_NAME = 'integrations' THEN
    v_metadata := jsonb_build_object(
      'provider', CASE WHEN TG_OP = 'DELETE' THEN OLD.provider ELSE NEW.provider END,
      'provider_account_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.provider_account_id ELSE NEW.provider_account_id END
    );
  ELSIF TG_TABLE_NAME = 'workspace_members' THEN
    v_metadata := jsonb_build_object(
      'role', CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END,
      'status', CASE WHEN TG_OP = 'DELETE' THEN OLD.status ELSE NEW.status END
    );
  END IF;

  INSERT INTO public.security_audit_events(actor_user_id, subject_user_id, workspace_id, event_type, metadata)
  VALUES (auth.uid(), v_subject_user_id, v_workspace_id, v_event_type, v_metadata);

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_security_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_workspace_members_changes ON public.workspace_members;
CREATE TRIGGER audit_workspace_members_changes
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.capture_security_audit_event();

DROP TRIGGER IF EXISTS audit_workspace_permissions_changes ON public.workspace_user_permissions;
CREATE TRIGGER audit_workspace_permissions_changes
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_user_permissions
FOR EACH ROW EXECUTE FUNCTION public.capture_security_audit_event();

DROP TRIGGER IF EXISTS audit_integrations_changes ON public.integrations;
CREATE TRIGGER audit_integrations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.capture_security_audit_event();
