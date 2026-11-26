-- Store the public reference image associated with a Kanban card.
-- The image itself lives in the existing workspace-scoped brand-banners bucket.
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

COMMENT ON COLUMN public.kanban_cards.banner_url IS
  'Public URL of the optional reference image shown as the card banner.';
