CREATE TABLE IF NOT EXISTS public.whatsapp_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  access_token text NOT NULL,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disconnected')),
  last_error text,
  last_webhook_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone_number_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  whatsapp_number_id uuid NOT NULL REFERENCES public.whatsapp_numbers(id) ON DELETE CASCADE,
  wa_contact_id text NOT NULL,
  contact_name text,
  contact_phone text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary text,
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (whatsapp_number_id, wa_contact_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wamid text NOT NULL UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL DEFAULT 'text',
  body text,
  status text NOT NULL DEFAULT 'received',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_workspace_last_idx ON public.whatsapp_conversations(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_sent_idx ON public.whatsapp_messages(conversation_id, sent_at);

ALTER TABLE public.whatsapp_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WhatsApp members read numbers" ON public.whatsapp_numbers FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "WhatsApp members read conversations" ON public.whatsapp_conversations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "WhatsApp members read messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "WhatsApp members manage notes" ON public.whatsapp_conversation_notes FOR ALL TO authenticated USING (public.is_workspace_member(workspace_id) AND user_id = auth.uid()) WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

-- The access token is only consumed by Edge Functions. Frontend clients must
-- never be able to select it, even if they know the table name.
REVOKE SELECT (access_token) ON public.whatsapp_numbers FROM anon, authenticated;
GRANT SELECT (id, workspace_id, created_by, waba_id, phone_number_id, display_phone_number, verified_name, status, last_error, last_webhook_at, created_at, updated_at) ON public.whatsapp_numbers TO authenticated;
