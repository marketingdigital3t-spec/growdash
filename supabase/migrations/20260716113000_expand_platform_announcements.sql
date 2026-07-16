-- Global announcement manager: multiple scheduled banners, page targeting and
-- deterministic priority. Existing image_data_url records remain valid.
ALTER TABLE public.platform_announcements
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS target_paths text[] NOT NULL DEFAULT ARRAY['*']::text[],
  ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS public.platform_announcements_single_active_idx;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_announcements_valid_window'
  ) THEN
    ALTER TABLE public.platform_announcements
      ADD CONSTRAINT platform_announcements_valid_window
      CHECK (ends_at IS NULL OR ends_at > starts_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_announcements_has_targets'
  ) THEN
    ALTER TABLE public.platform_announcements
      ADD CONSTRAINT platform_announcements_has_targets
      CHECK (cardinality(target_paths) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS platform_announcements_schedule_idx
  ON public.platform_announcements (active, starts_at, ends_at, priority DESC);

COMMENT ON COLUMN public.platform_announcements.target_paths IS
  'Rotas em que o banner aparece. O valor * representa todas as telas.';

