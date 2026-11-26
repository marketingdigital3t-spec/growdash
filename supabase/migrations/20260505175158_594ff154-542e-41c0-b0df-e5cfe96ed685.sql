
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS last_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_status text;

ALTER TABLE public.adsets
  ADD COLUMN IF NOT EXISTS last_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_status text;

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS last_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_status text;

ALTER TABLE public.campaign_changes
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS entity_id text;

CREATE INDEX IF NOT EXISTS idx_campaign_changes_entity
  ON public.campaign_changes(entity_type, entity_id, changed_at DESC);
