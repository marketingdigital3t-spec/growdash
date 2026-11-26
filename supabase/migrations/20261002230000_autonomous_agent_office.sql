-- Autonomous Agent Office: business directors, persistent conversations and
-- server-side task execution. All writes remain service-role/owner controlled.
ALTER TABLE public.agent_office_agents
  DROP CONSTRAINT IF EXISTS agent_office_agents_role_check;
ALTER TABLE public.agent_office_agents
  ADD CONSTRAINT agent_office_agents_role_check CHECK (role IN (
    'ceo', 'marketing', 'commercial', 'finance', 'legal',
    'backend_security', 'backend_meta_rd', 'frontend', 'designer'
  ));

ALTER TABLE public.agent_office_agents
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.agent_office_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS runtime_status text NOT NULL DEFAULT 'idle';

ALTER TABLE public.agent_office_agents
  DROP CONSTRAINT IF EXISTS agent_office_agents_runtime_status_check;
ALTER TABLE public.agent_office_agents
  ADD CONSTRAINT agent_office_agents_runtime_status_check CHECK (runtime_status IN (
    'working', 'analyzing', 'waiting_approval', 'paused', 'blocked', 'error', 'idle'
  ));

CREATE TABLE IF NOT EXISTS public.agent_office_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agent_office_agents(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_office_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agent_office_agents(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.agent_office_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_office_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agent_office_agents(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_office_messages_conversation_idx ON public.agent_office_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS agent_office_events_workspace_idx ON public.agent_office_events(workspace_id, created_at DESC);

ALTER TABLE public.agent_office_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent office owner conversations" ON public.agent_office_conversations
  FOR SELECT TO authenticated USING (public.agent_office_owner(workspace_id));
CREATE POLICY "Agent office owner messages" ON public.agent_office_messages
  FOR SELECT TO authenticated USING (public.agent_office_owner(workspace_id));
CREATE POLICY "Agent office owner events" ON public.agent_office_events
  FOR SELECT TO authenticated USING (public.agent_office_owner(workspace_id));

REVOKE ALL ON public.agent_office_conversations, public.agent_office_messages, public.agent_office_events FROM authenticated;
GRANT SELECT ON public.agent_office_conversations, public.agent_office_messages, public.agent_office_events TO authenticated;
GRANT ALL ON public.agent_office_conversations, public.agent_office_messages, public.agent_office_events TO service_role;

-- Business directors are the visible front layer. Technical roles remain
-- available as internal specialists and are not deleted.
INSERT INTO public.agent_office_agents (workspace_id, owner_id, role, name, department, is_visible, permissions, config)
SELECT w.id, w.owner_id, seed.role, seed.name, seed.department, true, seed.permissions, seed.config
FROM public.workspaces w
CROSS JOIN (VALUES
  ('ceo', 'CEO · Chief of Staff', 'ceo', '{"audit":true,"dispatch":true,"cross_domain":true,"approve":false}'::jsonb, '{"scope":"all"}'::jsonb),
  ('marketing', 'Gestor de Marketing', 'marketing', '{"audit":true,"prepare":true,"publish":false}'::jsonb, '{"scope":"traffic,funnel,social,strategy"}'::jsonb),
  ('commercial', 'Diretor Comercial', 'commercial', '{"audit":true,"prepare":true,"send_messages":false}'::jsonb, '{"scope":"crm,commercial,kanban,whatsapp"}'::jsonb),
  ('finance', 'CFO', 'finance', '{"audit":true,"prepare":true,"authorize_spend":false}'::jsonb, '{"scope":"finance,products,classes"}'::jsonb),
  ('legal', 'Advogado', 'legal', '{"audit":true,"prepare":true,"legal_advice":false}'::jsonb, '{"scope":"integrations,users,settings,compliance"}'::jsonb)
) AS seed(role, name, department, permissions, config)
ON CONFLICT (workspace_id, role) DO UPDATE SET
  name = EXCLUDED.name, department = EXCLUDED.department, is_visible = true,
  permissions = EXCLUDED.permissions, config = EXCLUDED.config, updated_at = now();

-- Preserve the existing 15-minute server-side execution cadence.
DO $$ DECLARE job_id bigint; BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'growdash-agent-office-15m';
  IF job_id IS NULL THEN
    PERFORM cron.schedule('growdash-agent-office-15m', '*/15 * * * *', $cron$
      SELECT net.http_post(
        url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/agent-office-orchestrator',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)),
        body := jsonb_build_object('trigger', 'cron', 'requested_at', now()), timeout_milliseconds := 120000
      );
    $cron$);
  END IF;
END $$;
