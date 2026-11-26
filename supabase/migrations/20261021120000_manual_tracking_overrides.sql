-- Bilateral CRM tracking edits: keep the automatic RD/Meta snapshot intact
-- and persist only explicit user overrides in a separate JSON document.
ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS manual_tracking jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_tracking_updated_at timestamptz;

ALTER TABLE public.rd_deals
  DROP CONSTRAINT IF EXISTS rd_deals_manual_tracking_object;

ALTER TABLE public.rd_deals
  ADD CONSTRAINT rd_deals_manual_tracking_object
  CHECK (jsonb_typeof(manual_tracking) = 'object');

CREATE INDEX IF NOT EXISTS idx_rd_deals_manual_tracking
  ON public.rd_deals USING gin (manual_tracking);
