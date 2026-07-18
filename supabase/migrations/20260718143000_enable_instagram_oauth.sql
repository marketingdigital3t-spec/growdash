-- Instagram OAuth was implemented locally after the original production
-- migration sequence had already diverged. Keep this migration standalone and
-- idempotent so a production deploy can enable the feature without replaying
-- unrelated historical migrations.

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Some production environments predate the workspaces table. Keep the
  -- association nullable without coupling this migration to that schema.
  workspace_id uuid,
  provider text NOT NULL CHECK (provider IN ('instagram','facebook','tiktok','youtube','linkedin')),
  provider_account_id text NOT NULL,
  username text,
  display_name text NOT NULL,
  profile_picture_url text,
  followers_count bigint NOT NULL DEFAULT 0,
  media_count bigint NOT NULL DEFAULT 0,
  connection_status text NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected','expired','error','disconnected')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  provider_media_id text NOT NULL,
  media_type text NOT NULL DEFAULT 'post',
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  published_at timestamptz,
  reach bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  saves bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  video_views bigint NOT NULL DEFAULT 0,
  interactions bigint NOT NULL DEFAULT 0,
  engagement_rate numeric(10,4) NOT NULL DEFAULT 0,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_account_id, provider_media_id)
);

CREATE TABLE IF NOT EXISTS public.social_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  insight_date date NOT NULL,
  followers bigint NOT NULL DEFAULT 0,
  follower_delta bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  profile_views bigint NOT NULL DEFAULT 0,
  website_clicks bigint NOT NULL DEFAULT 0,
  interactions bigint NOT NULL DEFAULT 0,
  UNIQUE (social_account_id, insight_date)
);

CREATE TABLE IF NOT EXISTS public.instagram_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS social_accounts_user_idx ON public.social_accounts(user_id, provider);
CREATE INDEX IF NOT EXISTS social_media_account_published_idx ON public.social_media(social_account_id, published_at DESC);
CREATE INDEX IF NOT EXISTS social_insights_account_date_idx ON public.social_insights_daily(social_account_id, insight_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS integrations_user_provider_account_idx
  ON public.integrations(user_id, provider, provider_account_id)
  WHERE provider_account_id IS NOT NULL;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_oauth_states ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts, public.social_media, public.social_insights_daily TO authenticated;
GRANT ALL ON public.social_accounts, public.social_media, public.social_insights_daily, public.instagram_oauth_states TO service_role;
GRANT SELECT (provider_account_id, token_expires_at) ON public.integrations TO authenticated;

DROP POLICY IF EXISTS "Users manage own social accounts" ON public.social_accounts;
CREATE POLICY "Users manage own social accounts" ON public.social_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own social media" ON public.social_media;
CREATE POLICY "Users view own social media" ON public.social_media FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.social_accounts account
    WHERE account.id = social_account_id
      AND account.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users view own social daily insights" ON public.social_insights_daily;
CREATE POLICY "Users view own social daily insights" ON public.social_insights_daily FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.social_accounts account
    WHERE account.id = social_account_id
      AND account.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.set_social_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_accounts_updated_at ON public.social_accounts;
CREATE TRIGGER social_accounts_updated_at BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_social_updated_at();

COMMENT ON TABLE public.instagram_oauth_states IS
  'Hashed, single-use OAuth state values. Only the service role may access this table.';
