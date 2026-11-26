-- First-party actions used by the visual workflow engine.
-- These records are workspace-scoped and are written by the executor with
-- service_role after the workflow itself has passed workspace authorization.

CREATE TABLE IF NOT EXISTS public.growdash_automation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.growdash_automations(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.growdash_automation_runs(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growdash_automation_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS growdash_automation_tags_workspace_name_idx
  ON public.growdash_automation_tags (workspace_id, lower(name));

CREATE TABLE IF NOT EXISTS public.growdash_automation_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.growdash_automation_tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 80),
  entity_id text NOT NULL CHECK (length(trim(entity_id)) BETWEEN 1 AND 240),
  automation_id uuid REFERENCES public.growdash_automations(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.growdash_automation_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, tag_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.growdash_automation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.growdash_automations(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.growdash_automation_runs(id) ON DELETE SET NULL,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  message text NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 4000),
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS growdash_automation_tasks_assignee_idx
  ON public.growdash_automation_tasks (workspace_id, assignee_user_id, status, due_at);
CREATE INDEX IF NOT EXISTS growdash_automation_tasks_run_idx
  ON public.growdash_automation_tasks (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS growdash_automation_tag_assignments_entity_idx
  ON public.growdash_automation_tag_assignments (workspace_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS growdash_automation_notifications_recipient_idx
  ON public.growdash_automation_notifications (recipient_user_id, read_at, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_growdash_automation_action_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growdash_automation_tasks_updated_at ON public.growdash_automation_tasks;
CREATE TRIGGER growdash_automation_tasks_updated_at
  BEFORE UPDATE ON public.growdash_automation_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_growdash_automation_action_updated_at();

DROP TRIGGER IF EXISTS growdash_automation_tags_updated_at ON public.growdash_automation_tags;
CREATE TRIGGER growdash_automation_tags_updated_at
  BEFORE UPDATE ON public.growdash_automation_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_growdash_automation_action_updated_at();

ALTER TABLE public.growdash_automation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_automation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_automation_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_automation_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growdash_automation_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growdash_automation_tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.growdash_automation_tag_assignments TO authenticated;
GRANT SELECT, UPDATE ON public.growdash_automation_notifications TO authenticated;
GRANT ALL ON public.growdash_automation_tasks, public.growdash_automation_tags, public.growdash_automation_tag_assignments, public.growdash_automation_notifications TO service_role;

DROP POLICY IF EXISTS "Workspace members read automation tasks" ON public.growdash_automation_tasks;
CREATE POLICY "Workspace members read automation tasks"
  ON public.growdash_automation_tasks FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Workspace editors manage automation tasks" ON public.growdash_automation_tasks;
CREATE POLICY "Workspace editors manage automation tasks"
  ON public.growdash_automation_tasks FOR ALL TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members read automation tags" ON public.growdash_automation_tags;
CREATE POLICY "Workspace members read automation tags"
  ON public.growdash_automation_tags FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Workspace editors manage automation tags" ON public.growdash_automation_tags;
CREATE POLICY "Workspace editors manage automation tags"
  ON public.growdash_automation_tags FOR ALL TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members read automation tag assignments" ON public.growdash_automation_tag_assignments;
CREATE POLICY "Workspace members read automation tag assignments"
  ON public.growdash_automation_tag_assignments FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Workspace editors manage automation tag assignments" ON public.growdash_automation_tag_assignments;
CREATE POLICY "Workspace editors manage automation tag assignments"
  ON public.growdash_automation_tag_assignments FOR ALL TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS "Recipients read automation notifications" ON public.growdash_automation_notifications;
CREATE POLICY "Recipients read automation notifications"
  ON public.growdash_automation_notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS "Recipients update automation notifications" ON public.growdash_automation_notifications;
CREATE POLICY "Recipients update automation notifications"
  ON public.growdash_automation_notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

COMMENT ON TABLE public.growdash_automation_tasks IS 'Tasks created by workspace automations; service-role writes are tied to an auditable run.';
COMMENT ON TABLE public.growdash_automation_tag_assignments IS 'Workspace-scoped tags for CRM entities, including RD deals that do not have a local UUID.';
COMMENT ON TABLE public.growdash_automation_notifications IS 'Private in-app notifications emitted by automations for a specific authenticated recipient.';

-- Poll active schedules once per minute. The cron secret is read from the
-- existing private sync ledger and never exposed to clients.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'growdash-workflow-scheduler';
  IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
  PERFORM cron.schedule('growdash-workflow-scheduler', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/workflow-scheduler',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)),
      body := jsonb_build_object('requested_at', now()), timeout_milliseconds := 120000
    );
  $cron$);
END $$;
