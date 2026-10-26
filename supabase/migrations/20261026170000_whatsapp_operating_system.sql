-- WhatsApp operating system: provider-neutral numbers, seller scope, agents and follow-ups.
-- Keeps the existing Cloud API inbox contract and adds the WAHA/QR path.

ALTER TABLE public.whatsapp_numbers
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'meta_cloud',
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waha_session_name text,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.whatsapp_numbers ADD CONSTRAINT whatsapp_numbers_provider_check
    CHECK (provider IN ('meta_cloud', 'waha'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.whatsapp_numbers ADD CONSTRAINT whatsapp_numbers_mode_check
    CHECK (mode IN ('human', 'ai', 'ai_handoff', 'human_assist'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_numbers_workspace_ad_account_uidx
  ON public.whatsapp_numbers(workspace_id, ad_account_id)
  WHERE ad_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_numbers_waha_session_uidx
  ON public.whatsapp_numbers(waha_session_name)
  WHERE waha_session_name IS NOT NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_status text NOT NULL DEFAULT 'none';

DO $$ BEGIN
  ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_handoff_check
    CHECK (handoff_status IN ('none', 'requested', 'human'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  mode text NOT NULL DEFAULT 'ai_handoff' CHECK (mode IN ('ai','ai_handoff','human_assist')),
  system_prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  knowledge jsonb NOT NULL DEFAULT '{}'::jsonb,
  handoff_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_numbers
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.whatsapp_agents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  whatsapp_number_id uuid NOT NULL REFERENCES public.whatsapp_numbers(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.whatsapp_agents(id) ON DELETE SET NULL,
  sequence_no integer NOT NULL CHECK (sequence_no BETWEEN 1 AND 9),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','cancelled','failed')),
  reason text NOT NULL DEFAULT 'seller_silent',
  message_body text,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text,
  payload_sha256 text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','ignored')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_number_assignee_idx
  ON public.whatsapp_conversations(whatsapp_number_id, assigned_to, last_message_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_followups_due_idx
  ON public.whatsapp_followups(status, scheduled_at);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_workspace_idx
  ON public.whatsapp_webhook_events(workspace_id, received_at DESC);

CREATE OR REPLACE FUNCTION public.whatsapp_is_workspace_admin(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND status = 'active' AND role IN ('owner','admin')
  );
$$;
GRANT EXECUTE ON FUNCTION public.whatsapp_is_workspace_admin(uuid, uuid) TO authenticated;

ALTER TABLE public.whatsapp_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WhatsApp members read numbers" ON public.whatsapp_numbers;
CREATE POLICY "WhatsApp scoped members read numbers" ON public.whatsapp_numbers FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND (public.whatsapp_is_workspace_admin(workspace_id) OR assigned_user_id IS NULL OR assigned_user_id = auth.uid()));
CREATE POLICY "WhatsApp admins manage number settings" ON public.whatsapp_numbers FOR UPDATE TO authenticated
  USING (public.whatsapp_is_workspace_admin(workspace_id))
  WITH CHECK (public.whatsapp_is_workspace_admin(workspace_id));
DROP POLICY IF EXISTS "WhatsApp members read conversations" ON public.whatsapp_conversations;
CREATE POLICY "WhatsApp scoped members read conversations" ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND (public.whatsapp_is_workspace_admin(workspace_id) OR assigned_to = auth.uid() OR EXISTS (
    SELECT 1 FROM public.whatsapp_numbers number WHERE number.id = whatsapp_number_id AND number.assigned_user_id = auth.uid()
  )));
DROP POLICY IF EXISTS "WhatsApp members read messages" ON public.whatsapp_messages;
CREATE POLICY "WhatsApp scoped members read messages" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND (public.whatsapp_is_workspace_admin(workspace_id) OR EXISTS (
    SELECT 1 FROM public.whatsapp_conversations conversation
    WHERE conversation.id = conversation_id AND (conversation.assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM public.whatsapp_numbers number WHERE number.id = conversation.whatsapp_number_id AND number.assigned_user_id = auth.uid()
    ))
  )));

CREATE POLICY "WhatsApp admins manage agents" ON public.whatsapp_agents FOR ALL TO authenticated
  USING (public.whatsapp_is_workspace_admin(workspace_id)) WITH CHECK (public.whatsapp_is_workspace_admin(workspace_id));
CREATE POLICY "WhatsApp scoped members read followups" ON public.whatsapp_followups FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND (public.whatsapp_is_workspace_admin(workspace_id) OR EXISTS (
    SELECT 1 FROM public.whatsapp_conversations conversation WHERE conversation.id = conversation_id AND conversation.assigned_to = auth.uid()
  )));
CREATE POLICY "WhatsApp admins manage followups" ON public.whatsapp_followups FOR ALL TO authenticated
  USING (public.whatsapp_is_workspace_admin(workspace_id)) WITH CHECK (public.whatsapp_is_workspace_admin(workspace_id));
CREATE POLICY "WhatsApp admins read webhook events" ON public.whatsapp_webhook_events FOR SELECT TO authenticated
  USING (public.whatsapp_is_workspace_admin(workspace_id));

GRANT SELECT (id, workspace_id, created_by, waba_id, phone_number_id, display_phone_number, verified_name, status, last_error, last_webhook_at, created_at, updated_at, provider, ad_account_id, assigned_user_id, waha_session_name, mode, provider_metadata, agent_id) ON public.whatsapp_numbers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_agents, public.whatsapp_followups TO authenticated;
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_agents, public.whatsapp_followups, public.whatsapp_webhook_events TO service_role;

-- Processa follow-ups pendentes a cada minuto usando o segredo privado
-- já utilizado pelos jobs pg_cron do projeto. A função também aceita
-- AUTOMATION_INTERNAL_SECRET para disparos internos controlados.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'growdash-whatsapp-followup-sweep';
  IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
  PERFORM cron.schedule('growdash-whatsapp-followup-sweep', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/whatsapp-followup-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)
      ),
      body := jsonb_build_object('requested_at', now()), timeout_milliseconds := 120000
    );
  $cron$);
END $$;
