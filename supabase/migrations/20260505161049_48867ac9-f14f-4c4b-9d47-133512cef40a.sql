ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;