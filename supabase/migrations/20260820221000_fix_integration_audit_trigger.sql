-- The audit trigger is shared by tables with different row shapes. Accessing
-- NEW.workspace_id directly for an integration row aborts writes because that
-- table deliberately has no workspace_id column. JSONB field access is safe
-- for every trigger row and preserves NULL for integrations.
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
    v_workspace_id := NULLIF(to_jsonb(OLD) ->> 'workspace_id', '')::uuid;
    v_subject_user_id := OLD.user_id;
  ELSE
    v_workspace_id := NULLIF(to_jsonb(NEW) ->> 'workspace_id', '')::uuid;
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
